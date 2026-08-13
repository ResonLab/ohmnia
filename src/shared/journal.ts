import type { CleTraduction } from './i18n'
import type { TypeMouvement } from './types'

/**
 * Les deux sens d'un mouvement du Journal.
 *
 * **`valeur` est enregistrée en base, `cle` sert à l'affichage.** La colonne
 * `journal.type` contient littéralement « Entrée » ou « Dépense » dans les
 * données de l'utilisateur. Traduire la valeur écrirait « Expense » dans les
 * écritures saisies en anglais : le filtre par type ne les retrouverait plus
 * ensemble, les totaux se sépareraient en deux, et rien ne le signalerait.
 *
 * **Ne jamais changer une `valeur`.** Elle est dans les données de quelqu'un.
 * Un libellé se corrige dans `i18n.ts` sans rien casser ; une valeur, non.
 *
 * Ce fichier vit hors des écrans exprès : `tests/traductions.mjs` refuse toute
 * chaîne accentuée dans un écran déclaré traduit, et il a raison de le faire.
 * Ici, l'accent appartient à une donnée, pas à du texte qu'on lit.
 *
 * Même procédé que `src/shared/inventaire.ts` pour les catégories d'articles.
 */
export const TYPES_MOUVEMENT: { valeur: TypeMouvement; cle: CleTraduction }[] = [
  { valeur: 'Entrée', cle: 'journal.entree' },
  { valeur: 'Dépense', cle: 'journal.depense' }
]

/** Le type par défaut d'une nouvelle écriture : une dépense, la plus fréquente. */
export const TYPE_PAR_DEFAUT: TypeMouvement = TYPES_MOUVEMENT[1].valeur

/** Le libellé à afficher pour une valeur enregistrée. */
export function cleTypeMouvement(valeur: TypeMouvement): CleTraduction {
  return TYPES_MOUVEMENT.find((t) => t.valeur === valeur)?.cle ?? 'journal.depense'
}
