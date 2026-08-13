import type { CleTraduction } from './i18n'

/**
 * Les catégories d'articles de l'inventaire.
 *
 * **`valeur` est enregistrée en base, `cle` sert à l'affichage.** La
 * distinction n'est pas une élégance : la catégorie d'un article vit dans la
 * colonne `inventaire.categorie` de la base de l'utilisateur. Traduire la
 * liste, c'est écrire « Cables/Connectors » dans les fiches saisies en anglais
 * — et les mêmes articles se retrouveraient répartis dans deux catégories
 * différentes selon la langue du jour où on les a créés. Un filtre ne les
 * retrouverait plus ensemble, et rien ne le signalerait.
 *
 * **Ne jamais changer une `valeur`.** Elle est dans les données de quelqu'un.
 * Un libellé se corrige dans `i18n.ts` sans rien casser ; une valeur, non.
 *
 * Ce fichier vit hors des écrans exprès. `tests/traductions.mjs` refuse toute
 * chaîne accentuée dans un écran déclaré traduit, et il a raison de le faire :
 * ici, l'accent appartient à une donnée, pas à du texte qu'on lit.
 */
export const CATEGORIES_INVENTAIRE: { valeur: string; cle: CleTraduction }[] = [
  { valeur: 'Composants', cle: 'inventaire.catComposants' },
  { valeur: 'Câbles/Connectique', cle: 'inventaire.catCables' },
  { valeur: 'Outillage', cle: 'inventaire.catOutillage' },
  { valeur: 'Consommables', cle: 'inventaire.catConsommables' },
  { valeur: 'Appareils', cle: 'inventaire.catAppareils' },
  { valeur: 'Divers', cle: 'inventaire.catDivers' }
]

/** Les valeurs seules, pour tester l'appartenance. */
export const VALEURS_CATEGORIES = CATEGORIES_INVENTAIRE.map((c) => c.valeur)
