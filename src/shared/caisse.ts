import { calculerMontantTva, calculerSousTotal } from './calculs'
import type { ModePaiement, VenteCaisse } from './types'

/**
 * Les valeurs stockées en base, nommées une fois. Un écran les compare à ces
 * constantes plutôt qu'à un mot français écrit en dur, que le contrôle de
 * traduction prendrait pour du texte d'interface.
 */
export const MODE_ESPECES: ModePaiement = 'Espèces'
export const MODE_CARTE: ModePaiement = 'Carte'
export const STATUT_VENTE_ANNULEE: VenteCaisse['statut'] = 'Annulée'

/**
 * Calcul d'un règlement en caisse. Pur : aucun accès à la base ni à la fenêtre,
 * pour que l'écran (qui affiche le rendu en direct) et le main process (qui
 * enregistre la vente) fassent exactement le même calcul.
 */

const auCentime = (montant: number): number => Math.round(montant * 100 + 1e-9) / 100

/**
 * Arrondi suisse aux 5 centimes (les pièces de 1 et 2 centimes n'existent plus).
 * On passe par les centimes entiers : arrondir directement un flottant donne
 * 12.32499… pour 12.325 et fait tomber le demi du mauvais côté.
 */
export function arrondirCinqCentimes(montant: number): number {
  const centimes = Math.round(montant * 100 + 1e-9)
  return (Math.round(centimes / 5) * 5) / 100
}

export interface TotalCaisse {
  sousTotal: number
  montantTva: number
  total: number
}

/** Les prix de l'inventaire sont hors taxe, comme sur les lignes de facture. */
export function calculerTotalCaisse(
  lignes: { quantite: number; prixUnitaire: number }[],
  assujetti: boolean,
  tvaPct: number
): TotalCaisse {
  const sousTotal = auCentime(calculerSousTotal(lignes))
  const montantTva = assujetti ? auCentime(calculerMontantTva(sousTotal, tvaPct)) : 0
  return { sousTotal, montantTva, total: auCentime(sousTotal + montantTva) }
}

export interface ParametresReglement {
  total: number
  partCarte: number
  /** Devise dans laquelle le client remet ses espèces. */
  devise: string
  deviseEntreprise: string
  /** Valeur d'une unité de `devise` exprimée dans la devise de l'entreprise. */
  taux: number
  /** Espèces remises, dans `devise`. */
  montantRecuEspeces: number
  arrondiSuisse: boolean
}

export interface Reglement {
  carte: number
  /** Part en espèces, dans la devise de l'entreprise, arrondi suisse inclus. */
  especes: number
  arrondi: number
  /** Ce que le client doit remettre, dans la devise qu'il a choisie. */
  aEncaisserDeviseRecue: number
  /** Monnaie rendue, dans la devise de l'entreprise. */
  rendu: number
}

export function calculerReglement(p: ParametresReglement): Reglement {
  if (!(p.total > 0)) throw new Error('Le total de la vente doit être supérieur à zéro.')
  if (p.partCarte < 0) throw new Error('La part payée par carte ne peut pas être négative.')
  if (p.partCarte > p.total) throw new Error('La part payée par carte dépasse le total de la vente.')

  const carte = auCentime(p.partCarte)
  const especesExactes = auCentime(p.total - carte)
  if (especesExactes === 0) {
    return { carte, especes: 0, arrondi: 0, aEncaisserDeviseRecue: 0, rendu: 0 }
  }

  const especes = p.arrondiSuisse ? arrondirCinqCentimes(especesExactes) : especesExactes
  const arrondi = auCentime(especes - especesExactes)

  const etranger = p.devise !== p.deviseEntreprise
  if (etranger && !(p.taux > 0)) throw new Error('Le taux de change doit être supérieur à zéro.')
  const taux = etranger ? p.taux : 1

  const aEncaisserDeviseRecue = auCentime(especes / taux)
  if (!(p.montantRecuEspeces >= aEncaisserDeviseRecue)) {
    throw new Error('Les espèces remises ne couvrent pas la somme à encaisser.')
  }
  const rendu = auCentime(p.montantRecuEspeces * taux - especes)

  return { carte, especes, arrondi, aEncaisserDeviseRecue, rendu }
}
