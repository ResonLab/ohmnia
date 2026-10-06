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

/**
 * Les statuts d'une facture.
 *
 * Même règle que pour les devis : la colonne `factures.statut` contient
 * littéralement « Brouillon », « Envoyée », « Payée » ou « Annulée ». Traduire la
 * valeur fausserait le tableau de bord, qui compte les factures envoyées et en
 * retard en comparant cette chaîne.
 */
/**
 * La valeur « Envoyée », pour les écrans qui comparent un statut : un écran
 * traduit n'écrit aucune chaîne accentuée, la valeur vient donc d'ici.
 */
export const STATUT_FACTURE_ENVOYEE: StatutFacture = 'Envoyée'

export const STATUTS_FACTURE: { valeur: StatutFacture; cle: CleTraduction }[] = [
  { valeur: 'Brouillon', cle: 'facture.statutBrouillon' },
  { valeur: 'Envoyée', cle: 'facture.statutEnvoyee' },
  { valeur: 'Payée', cle: 'facture.statutPayee' },
  { valeur: 'Annulée', cle: 'facture.statutAnnulee' }
]
