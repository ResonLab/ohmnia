import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { tracerAudit } from '../db/audit'
import type { EntreeAudit, ExerciceCloture } from '../../shared/types'

interface LigneAudit {
  id: number
  horodatage: string
  action: string
  entite: string
  reference: string
  details: string
}

export function enregistrerHandlersAudit(): void {
  ipcMain.handle('audit:lister', (_e, limite = 300) => {
    const lignes = getDb()
      .prepare('SELECT * FROM journal_audit ORDER BY id DESC LIMIT ?')
      .all(Math.min(Math.max(limite, 1), 2000)) as unknown as LigneAudit[]
    return lignes as EntreeAudit[]
  })

  ipcMain.handle('audit:vider', () => {
    // On garde une trace de la purge elle-même : le journal ne devient jamais
    // totalement muet sur ce qui s'est passé.
    getDb().prepare('DELETE FROM journal_audit').run()
    tracerAudit('purge', 'journal_audit', '', "Journal d'audit vidé par l'utilisateur")
  })

  ipcMain.handle('exercices:lister', () => {
    const lignes = getDb()
      .prepare('SELECT annee, cloture_le FROM exercices_clotures ORDER BY annee DESC')
      .all() as unknown as { annee: number; cloture_le: string }[]
    return lignes.map((l) => ({ annee: l.annee, clotureLe: l.cloture_le })) satisfies ExerciceCloture[]
  })

  ipcMain.handle('exercices:cloturer', (_e, annee: number) => {
    const anneeCourante = new Date().getFullYear()
    if (annee > anneeCourante) {
      throw new Error("Impossible de clôturer une année qui n'est pas terminée.")
    }

    const nbEcritures = getDb()
      .prepare("SELECT COUNT(*) AS n FROM journal WHERE CAST(strftime('%Y', date) AS INTEGER) = ?")
      .get(annee) as { n: number }

    getDb().prepare('INSERT OR IGNORE INTO exercices_clotures (annee) VALUES (?)').run(annee)
    tracerAudit('cloture', 'exercice', String(annee), `${nbEcritures.n} écriture(s) verrouillée(s)`)
    return nbEcritures.n
  })

  ipcMain.handle('exercices:reouvrir', (_e, annee: number) => {
    getDb().prepare('DELETE FROM exercices_clotures WHERE annee = ?').run(annee)
    tracerAudit('reouverture', 'exercice', String(annee))
  })
}
