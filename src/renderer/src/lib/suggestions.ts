import {
  calculerCoutCarburantKm,
  calculerCoutHoraireRevient,
  calculerCoutRevientKm,
  calculerMargeSuggeree,
  calculerPrixVenteKm,
  calculerTauxHoraireSuggere
} from '../../../shared/calculs'

export interface ValeursSuggerees {
  chargesFixesTotalMensuel: number
  margeSuggeree: number
  coutHoraireRevient: number
  tauxHoraireSuggere: number
  prixVenteKmSuggere: number
}

/**
 * Recalcule à la volée les valeurs "suggérées" (jamais stockées) à partir des
 * charges fixes actives, du CA estimé et des paramètres de déplacement.
 */
export async function chargerValeursSuggerees(): Promise<ValeursSuggerees> {
  const [charges, margeParams, deplacementParams] = await Promise.all([
    window.api.chargesFixes.lister(),
    window.api.parametresMarge.lire(),
    window.api.parametresDeplacement.lire()
  ])

  const chargesFixesTotalMensuel = charges
    .filter((c) => c.actif)
    .reduce((total, c) => total + c.montantMensuel, 0)

  const margeSuggeree = calculerMargeSuggeree(chargesFixesTotalMensuel, margeParams.caEstimeMensuel)
  const coutHoraireRevient = calculerCoutHoraireRevient(
    chargesFixesTotalMensuel,
    margeParams.heuresFacturablesMois
  )
  const tauxHoraireSuggere = calculerTauxHoraireSuggere(coutHoraireRevient, margeSuggeree)

  const coutCarburantKm = calculerCoutCarburantKm(
    deplacementParams.consoL100km,
    deplacementParams.prixEssence
  )
  const coutRevientKm = calculerCoutRevientKm(coutCarburantKm, deplacementParams.entretienKm)
  const prixVenteKmSuggere = calculerPrixVenteKm(coutRevientKm, deplacementParams.margeLivraisonPct)

  return {
    chargesFixesTotalMensuel,
    margeSuggeree,
    coutHoraireRevient,
    tauxHoraireSuggere,
    prixVenteKmSuggere
  }
}
