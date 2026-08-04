import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { tracerAudit } from '../db/audit'
import type { Rappel } from '../../shared/types'

interface LigneRappel {
  id: number
  facture_id: number
  niveau: number
  date: string
  frais: number
}

function versRappel(ligne: LigneRappel): Rappel {
  return {
    id: ligne.id,
    factureId: ligne.facture_id,
    niveau: ligne.niveau,
    date: ligne.date,
    frais: ligne.frais
  }
}

/** Frais suggérés par niveau de rappel (usage courant pour un indépendant en Suisse). */
const FRAIS_PAR_NIVEAU: Record<number, number> = { 1: 0, 2: 10, 3: 20 }

export function enregistrerHandlersRappels(): void {
  ipcMain.handle('rappels:lister', (_e, factureId: number) => {
    const lignes = getDb()
      .prepare('SELECT * FROM rappels WHERE facture_id = ? ORDER BY niveau')
      .all(factureId) as unknown as LigneRappel[]
    return lignes.map(versRappel)
  })

  /** Prépare le prochain rappel sans l'enregistrer : sert à proposer niveau et frais. */
  ipcMain.handle('rappels:prochainNiveau', (_e, factureId: number) => {
    const ligne = getDb()
      .prepare('SELECT MAX(niveau) AS maxi FROM rappels WHERE facture_id = ?')
      .get(factureId) as { maxi: number | null }
    const niveau = (ligne.maxi ?? 0) + 1
    return { niveau, fraisSuggeres: FRAIS_PAR_NIVEAU[niveau] ?? 20 }
  })

  ipcMain.handle('rappels:creer', (_e, factureId: number, niveau: number, frais: number) => {
    const facture = getDb()
      .prepare('SELECT numero, statut FROM factures WHERE id = ?')
      .get(factureId) as { numero: string; statut: string } | undefined
    if (!facture) throw new Error("Cette facture n'existe pas.")
    if (facture.statut === 'Payée') {
      throw new Error('Cette facture est déjà marquée comme payée : aucun rappel nécessaire.')
    }
    if (facture.statut === 'Annulée') {
      throw new Error('Cette facture est annulée : aucun rappel ne peut être émis.')
    }
    if (frais < 0) throw new Error('Les frais de rappel ne peuvent pas être négatifs.')

    const resultat = getDb()
      .prepare("INSERT INTO rappels (facture_id, niveau, date, frais) VALUES (?, ?, date('now'), ?)")
      .run(factureId, niveau, frais)

    tracerAudit('rappel', 'facture', facture.numero, `Rappel niveau ${niveau}, frais ${frais} CHF`)

    const ligne = getDb()
      .prepare('SELECT * FROM rappels WHERE id = ?')
      .get(resultat.lastInsertRowid) as unknown as LigneRappel
    return versRappel(ligne)
  })

  ipcMain.handle('rappels:supprimer', (_e, id: number) => {
    getDb().prepare('DELETE FROM rappels WHERE id = ?').run(id)
  })
}
