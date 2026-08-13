import type { CleTraduction } from './i18n'
import type { StatutDevis, StatutFacture } from './types'

/**
 * Les statuts d'un devis.
 *
 * **`valeur` est enregistrée en base, `cle` sert à l'affichage.** La colonne
 * `devis.statut` contient littéralement « En attente », « Accepté » ou
 * « Refusé ». Traduire la valeur couperait l'historique en deux : les devis
 * saisis en anglais ne remonteraient plus dans un filtre français, et le compte
 * des devis en attente du tableau de bord deviendrait faux sans rien signaler.
 *
 * **Ne jamais changer une `valeur`.** Elle est dans les données de quelqu'un.
 *
 * Même procédé que `shared/inventaire.ts`, `shared/journal.ts` et
 * `shared/charges.ts`.
 */
export const STATUTS_DEVIS: { valeur: StatutDevis; cle: CleTraduction }[] = [
  { valeur: 'En attente', cle: 'devis.statutEnAttente' },
  { valeur: 'Accepté', cle: 'devis.statutAccepte' },
  { valeur: 'Refusé', cle: 'devis.statutRefuse' }
]

/** Le libellé à afficher pour un statut enregistré. */
export function cleStatutDevis(valeur: StatutDevis): CleTraduction {
  return STATUTS_DEVIS.find((s) => s.valeur === valeur)?.cle ?? 'devis.statutEnAttente'
}

/**
 * Les statuts d'une facture.
 *
 * Même règle que pour les devis : la colonne `factures.statut` contient
 * littéralement « En attente », « Payée » ou « Annulée ». Traduire la valeur
 * fausserait le tableau de bord, qui compte les factures en attente et en
 * retard en comparant cette chaîne.
 */
export const STATUTS_FACTURE: { valeur: StatutFacture; cle: CleTraduction }[] = [
  { valeur: 'En attente', cle: 'facture.statutEnAttente' },
  { valeur: 'Payée', cle: 'facture.statutPayee' },
  { valeur: 'Annulée', cle: 'facture.statutAnnulee' }
]

/** Le libellé à afficher pour un statut enregistré. */
export function cleStatutFacture(valeur: StatutFacture): CleTraduction {
  return STATUTS_FACTURE.find((s) => s.valeur === valeur)?.cle ?? 'facture.statutEnAttente'
}
