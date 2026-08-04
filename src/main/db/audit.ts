import { getDb } from './database'

/**
 * Enregistre une trace dans le journal d'audit.
 *
 * Ne doit jamais faire échouer l'opération métier qu'elle accompagne :
 * une trace manquante est moins grave qu'une facture perdue.
 */
export function tracerAudit(action: string, entite: string, reference = '', details = ''): void {
  try {
    getDb()
      .prepare('INSERT INTO journal_audit (action, entite, reference, details) VALUES (?, ?, ?, ?)')
      .run(action, entite, reference, details)
  } catch (erreur) {
    console.error("Écriture dans le journal d'audit impossible :", erreur)
  }
}

/**
 * Refuse toute modification touchant une année comptable clôturée.
 * À appeler avant chaque écriture sur le Journal (ajout, modification, suppression).
 */
export function verifierExerciceOuvert(date: string): void {
  const annee = Number(date.slice(0, 4))
  if (!Number.isFinite(annee)) return

  const cloture = getDb().prepare('SELECT annee FROM exercices_clotures WHERE annee = ?').get(annee)
  if (cloture) {
    throw new Error(
      `L'exercice ${annee} est clôturé : aucune écriture ne peut plus y être ajoutée ou modifiée. ` +
        "Réouvre l'exercice dans les paramètres si tu dois vraiment le corriger."
    )
  }
}
