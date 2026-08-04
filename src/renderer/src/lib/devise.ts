import { formaterMontant as formaterAvecPays, PAYS_PAR_DEFAUT, profilPays } from '../../../shared/pays'

/**
 * Devise courante de l'interface.
 *
 * Stockée dans un module plutôt que passée en propriété à chaque écran :
 * elle ne change qu'au moment où l'utilisateur change le pays de son entreprise,
 * et elle est utilisée dans quasiment tous les affichages de montants.
 */
let paysCourant: string = PAYS_PAR_DEFAUT

export function definirPaysCourant(pays: string): void {
  paysCourant = pays
}

/** Formate un montant avec la devise du pays configuré, jamais « NaN ». */
export function formaterMontant(valeur: number): string {
  return formaterAvecPays(valeur, paysCourant)
}

/** Symbole seul, pour les libellés du type « CHF/h » ou « CHF/km ». */
export function symboleDevise(): string {
  return profilPays(paysCourant).symboleDevise
}

/** Nom local de la taxe (TVA, USt…) pour les libellés d'interface. */
export function nomTaxe(): string {
  return profilPays(paysCourant).nomTaxe
}
