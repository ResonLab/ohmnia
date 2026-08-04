import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { calculerMontantTva } from '../../shared/calculs'
import type { ResumeAnnuel } from '../../shared/types'

interface LigneMouvement {
  annee: number
  type: 'Entrée' | 'Dépense'
  montant: number
  tva_pct: number | null
}

export function enregistrerHandlersResume(): void {
  ipcMain.handle('resume:parAnnee', () => {
    const lignes = getDb()
      .prepare(
        `SELECT CAST(strftime('%Y', date) AS INTEGER) AS annee, type, montant, tva_pct FROM journal`
      )
      .all() as unknown as LigneMouvement[]

    const parAnnee = new Map<number, ResumeAnnuel>()

    for (const ligne of lignes) {
      const resume =
        parAnnee.get(ligne.annee) ??
        {
          annee: ligne.annee,
          entrees: 0,
          depenses: 0,
          beneficeNet: 0,
          tvaCollectee: 0,
          tvaDeductible: 0,
          tvaNette: 0
        }

      const montantTva = ligne.tva_pct ? calculerMontantTva(ligne.montant, ligne.tva_pct) : 0

      if (ligne.type === 'Entrée') {
        resume.entrees += ligne.montant
        resume.tvaCollectee += montantTva
      } else {
        resume.depenses += ligne.montant
        resume.tvaDeductible += montantTva
      }

      parAnnee.set(ligne.annee, resume)
    }

    for (const resume of parAnnee.values()) {
      resume.beneficeNet = resume.entrees - resume.depenses
      resume.tvaNette = resume.tvaCollectee - resume.tvaDeductible
    }

    return Array.from(parAnnee.values()).sort((a, b) => b.annee - a.annee)
  })

  ipcMain.handle('objectifAnnuel:lire', (_e, annee: number) => {
    const ligne = getDb()
      .prepare('SELECT objectif_ca FROM objectifs_annuels WHERE annee = ?')
      .get(annee) as { objectif_ca: number } | undefined
    return ligne?.objectif_ca ?? 0
  })

  ipcMain.handle('objectifAnnuel:enregistrer', (_e, annee: number, objectifCa: number) => {
    if (objectifCa < 0) throw new Error("L'objectif de chiffre d'affaires ne peut pas être négatif.")

    getDb()
      .prepare(
        `INSERT INTO objectifs_annuels (annee, objectif_ca) VALUES (?, ?)
         ON CONFLICT(annee) DO UPDATE SET objectif_ca = excluded.objectif_ca`
      )
      .run(annee, objectifCa)
    return objectifCa
  })
}
