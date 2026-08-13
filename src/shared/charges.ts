import type { CleTraduction } from './i18n'

/**
 * Les catégories d'une charge fixe.
 *
 * **`valeur` est enregistrée en base, `cle` sert à l'affichage.** La colonne
 * `charges_fixes.categorie` contient littéralement « Loyer » ou « Véhicule »
 * dans les données de l'utilisateur. Traduire la valeur répartirait les mêmes
 * charges dans deux catégories selon la langue du jour où on les a saisies, et
 * le total par catégorie se séparerait en deux sans que rien ne le signale.
 *
 * **Ne jamais changer une `valeur`.** Elle est dans les données de quelqu'un.
 *
 * Même procédé que `src/shared/inventaire.ts` et `src/shared/journal.ts`.
 */
export const CATEGORIES_CHARGES: { valeur: string; cle: CleTraduction }[] = [
  { valeur: 'Loyer', cle: 'charge.catLoyer' },
  { valeur: 'Assurances', cle: 'charge.catAssurances' },
  { valeur: 'Matériel/Amortissement', cle: 'charge.catMateriel' },
  { valeur: 'Véhicule', cle: 'charge.catVehicule' },
  { valeur: 'Abonnements', cle: 'charge.catAbonnements' },
  { valeur: 'Comptabilité', cle: 'charge.catComptabilite' },
  { valeur: 'Divers', cle: 'charge.catDivers' }
]

/** Les valeurs seules, pour tester l'appartenance. */
export const VALEURS_CATEGORIES_CHARGES = CATEGORIES_CHARGES.map((c) => c.valeur)
