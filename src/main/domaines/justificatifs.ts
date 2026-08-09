import { getDb } from '../db/database'
import type { Justificatif } from '../../shared/types'

/**
 * Justificatifs — la partie qui ne dépend pas d'Electron : ce que la base sait.
 *
 * Ce qui reste dans `../ipc/justificatifs.ts` : tout ce qui touche aux fichiers
 * (ajout par sélecteur, lecture en data URL, ouverture, suppression du fichier).
 * Ces opérations lisent le disque du poste ; sur un serveur elles devront viser
 * le dossier du serveur, ce qui est une décision de l'étape 3, pas d'ici.
 */

interface LigneJustificatif {
  id: number
  journal_id: number
  nom_fichier: string
  ajoute_le: string
}

function versJustificatif(ligne: LigneJustificatif): Justificatif {
  return {
    id: ligne.id,
    journalId: ligne.journal_id,
    nomFichier: ligne.nom_fichier,
    ajouteLe: ligne.ajoute_le
  }
}

export function listerJustificatifs(journalId: number): Justificatif[] {
  const lignes = getDb()
    .prepare('SELECT * FROM justificatifs WHERE journal_id = ? ORDER BY id')
    .all(journalId) as unknown as LigneJustificatif[]
  return lignes.map(versJustificatif)
}

/** Combien de justificatifs par écriture, pour afficher une pastille dans la liste. */
export function compterJustificatifsParEcriture(): Record<number, number> {
  const lignes = getDb()
    .prepare('SELECT journal_id, COUNT(*) AS n FROM justificatifs GROUP BY journal_id')
    .all() as unknown as { journal_id: number; n: number }[]
  return Object.fromEntries(lignes.map((l) => [l.journal_id, l.n])) as Record<number, number>
}
