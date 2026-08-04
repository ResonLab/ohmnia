/**
 * Toutes les formules métier de l'application, centralisées ici pour être
 * utilisées à l'identique dans le main process et dans le renderer.
 * Chaque division est protégée : jamais de NaN/Infinity affiché à l'utilisateur.
 */

export function diviserSansErreur(numerateur: number, denominateur: number, defaut = 0): number {
  if (!denominateur) return defaut
  return numerateur / denominateur
}

// --- Charges & Marge ---

export function calculerMargeSuggeree(chargesFixesTotalMensuel: number, caEstimeMensuel: number): number {
  if (chargesFixesTotalMensuel <= 0) return 0.3
  return diviserSansErreur(chargesFixesTotalMensuel, caEstimeMensuel, 0.3)
}

export function calculerCoutHoraireRevient(
  chargesFixesTotalMensuel: number,
  heuresFacturablesMois: number
): number {
  return diviserSansErreur(chargesFixesTotalMensuel, heuresFacturablesMois)
}

export function calculerTauxHoraireSuggere(coutHoraireRevient: number, margeSuggeree: number): number {
  return coutHoraireRevient * (1 + margeSuggeree)
}

// --- Déplacement ---

export function calculerCoutCarburantKm(consoL100km: number, prixEssence: number): number {
  return (consoL100km / 100) * prixEssence
}

export function calculerCoutRevientKm(coutCarburantKm: number, entretienKm: number): number {
  return coutCarburantKm + entretienKm
}

export function calculerPrixVenteKm(coutRevientKm: number, margeLivraisonPct: number): number {
  return coutRevientKm * (1 + margeLivraisonPct / 100)
}

// --- Impression / envoi de facture ---

export interface ParametresImpression {
  prixSachetA4: number
  feuillesParSachet: number
  feuillesParFacture: number
  prixImprimante: number
  nbFacturesAvantRemplacement: number
  prixEncre: number
  feuillesParCartouche: number
  prixTimbre: number
  prixSachetEnveloppes: number
  nbEnveloppesParSachet: number
  margeImpressionPct: number
}

export function calculerCoutPapierFacture(params: ParametresImpression): number {
  const prixFeuille = diviserSansErreur(params.prixSachetA4, params.feuillesParSachet)
  return prixFeuille * params.feuillesParFacture
}

export function calculerCoutAmortissementImprimanteFacture(params: ParametresImpression): number {
  return diviserSansErreur(params.prixImprimante, params.nbFacturesAvantRemplacement)
}

export function calculerCoutEncreFacture(params: ParametresImpression): number {
  const prixFeuilleEncre = diviserSansErreur(params.prixEncre, params.feuillesParCartouche)
  return prixFeuilleEncre * params.feuillesParFacture
}

export function calculerCoutEnveloppeFacture(params: ParametresImpression): number {
  return diviserSansErreur(params.prixSachetEnveloppes, params.nbEnveloppesParSachet)
}

export function calculerCoutRevientFacture(params: ParametresImpression): number {
  return (
    calculerCoutPapierFacture(params) +
    calculerCoutAmortissementImprimanteFacture(params) +
    calculerCoutEncreFacture(params) +
    calculerCoutEnveloppeFacture(params) +
    params.prixTimbre
  )
}

export function calculerPrixFactureImpression(params: ParametresImpression): number {
  return calculerCoutRevientFacture(params) * (1 + params.margeImpressionPct / 100)
}

// --- Tarifs & Marge ---

export function calculerPrixVenteProduit(prixAchat: number, margePct: number): number {
  return prixAchat * (1 + margePct / 100)
}

export function calculerTotalLigne(quantite: number, prixUnitaire: number): number {
  return quantite * prixUnitaire
}

// --- TVA ---

export function calculerMontantTva(montantHT: number, tvaPct: number): number {
  return montantHT * (tvaPct / 100)
}

// --- Facture / Devis ---

export function calculerSousTotal(lignes: { quantite: number; prixUnitaire: number }[]): number {
  return lignes.reduce((total, ligne) => total + calculerTotalLigne(ligne.quantite, ligne.prixUnitaire), 0)
}

export function calculerTotalApresRemise(sousTotal: number, remisePct: number): number {
  return sousTotal * (1 - remisePct / 100)
}

export function calculerEcheance(dateFacture: string, delaiJours: number): string {
  const date = new Date(dateFacture)
  date.setDate(date.getDate() + delaiJours)
  return date.toISOString().slice(0, 10)
}

export function calculerDateValidite(dateDevis: string, validiteJours: number): string {
  return calculerEcheance(dateDevis, validiteJours)
}

/** Ordinal français : 1 → « 1er », 2 → « 2e ». */
export function ordinalFrancais(nombre: number): string {
  return nombre === 1 ? '1er' : `${nombre}e`
}

export interface ResultatTotalDocument {
  sousTotal: number
  totalApresRemise: number
  montantTva: number
  total: number
}

export function calculerTotalDocument(
  lignes: { quantite: number; prixUnitaire: number }[],
  remisePct: number,
  tvaPct: number,
  fraisSupplementaires = 0
): ResultatTotalDocument {
  const sousTotal = calculerSousTotal(lignes)
  const totalApresRemise = calculerTotalApresRemise(sousTotal, remisePct) + fraisSupplementaires
  const montantTva = calculerMontantTva(totalApresRemise, tvaPct)
  return { sousTotal, totalApresRemise, montantTva, total: totalApresRemise + montantTva }
}
