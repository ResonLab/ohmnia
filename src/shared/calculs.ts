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

function calculerCoutPapierFacture(params: ParametresImpression): number {
  const prixFeuille = diviserSansErreur(params.prixSachetA4, params.feuillesParSachet)
  return prixFeuille * params.feuillesParFacture
}

function calculerCoutAmortissementImprimanteFacture(params: ParametresImpression): number {
  return diviserSansErreur(params.prixImprimante, params.nbFacturesAvantRemplacement)
}

function calculerCoutEncreFacture(params: ParametresImpression): number {
  const prixFeuilleEncre = diviserSansErreur(params.prixEncre, params.feuillesParCartouche)
  return prixFeuilleEncre * params.feuillesParFacture
}

function calculerCoutEnveloppeFacture(params: ParametresImpression): number {
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

function calculerTotalApresRemise(sousTotal: number, remisePct: number): number {
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

/**
 * Les relances à envoyer aujourd'hui.
 *
 * **Le problème que ceci résout.** Les rappels existaient déjà, mais il fallait
 * y penser : ouvrir la Facturation, parcourir l'historique, se souvenir de qui
 * avait déjà reçu quoi et quand. Une fonction dont il faut se souvenir n'est pas
 * une fonction, c'est une intention. Le calcul est le même que celui déjà fait à
 * la main ; ce qui change, c'est qu'il est fait *pour* l'utilisateur.
 *
 * **Deux délais, et ils ne disent pas la même chose :**
 *
 * · `seuilPremiereRelance` — combien de jours après l'échéance on relance une
 *   première fois. C'est le réglage « alerte facture en attente » que
 *   l'utilisateur a déjà choisi dans les paramètres : on ne lui en impose pas un
 *   second, il serait forcément incohérent avec le premier.
 * · `delaiEntreRelances` — combien de jours entre deux relances. Relancer un
 *   client deux jours de suite ne fait pas payer plus vite, ça fâche.
 *
 * **Au-delà de `niveauMax`, on cesse de proposer.** Trois rappels sans effet ne
 * deviennent pas efficaces au quatrième : c'est le moment d'un appel, d'une mise
 * en demeure ou d'un abandon de créance — des décisions qu'un logiciel de
 * facturation n'a pas à prendre. La facture est signalée `epuisee`, et l'écran
 * le dit au lieu de proposer indéfiniment un bouton qui ne sert plus.
 *
 * **Aucune relance n'est envoyée automatiquement.** Cette fonction propose une
 * liste ; l'envoi reste un geste de l'utilisateur. Un logiciel qui écrit tout
 * seul à un client au nom de quelqu'un est un logiciel qu'on n'ose plus laisser
 * tourner.
 */
export interface FacturePourRelance {
  id: number
  numero: string
  clientNom: string
  statut: string
  /** Date d'échéance au format `YYYY-MM-DD`. */
  dateEcheance: string
  /** Nombre de rappels déjà émis. */
  nombreRappels: number
  /** Date du dernier rappel émis, `YYYY-MM-DD`, ou `null` s'il n'y en a aucun. */
  dernierRappelLe: string | null
}

export interface RelanceProposee {
  factureId: number
  numero: string
  clientNom: string
  /** Le niveau du rappel à émettre : 1 pour un premier rappel. */
  niveau: number
  /** Jours écoulés depuis l'échéance. Toujours positif. */
  joursDeRetard: number
  /** Jours depuis le dernier rappel, ou `null` s'il n'y en a jamais eu. */
  joursDepuisDernierRappel: number | null
  /** `true` quand le nombre maximal de rappels est atteint : ne plus relancer. */
  epuisee: boolean
}

/** Au-delà, un rappel de plus ne sert plus à rien. */
export const NIVEAU_MAX_RELANCE = 3
/** Jours à laisser entre deux relances d'une même facture. */
export const DELAI_ENTRE_RELANCES = 14

/**
 * @param aujourdhui Date du jour au format `YYYY-MM-DD`. Passée en paramètre
 *   plutôt que lue de l'horloge : une fonction qui lit l'heure ne se teste pas.
 */
export function calculerRelances(
  factures: FacturePourRelance[],
  aujourdhui: string,
  seuilPremiereRelance: number,
  delaiEntreRelances: number = DELAI_ENTRE_RELANCES
): RelanceProposee[] {
  const jourEnMs = 1000 * 60 * 60 * 24
  const maintenant = new Date(aujourdhui).getTime()
  const ecartEnJours = (depuis: string): number =>
    Math.floor((maintenant - new Date(depuis).getTime()) / jourEnMs)

  const proposees: RelanceProposee[] = []

  for (const facture of factures) {
    // Une facture payée ou annulée ne se relance pas. C'est le premier filtre,
    // et il doit le rester : relancer un client qui a payé coûte la confiance
    // que toute la facturation sert à construire.
    if (facture.statut !== 'En attente') continue

    const joursDeRetard = ecartEnJours(facture.dateEcheance)
    if (joursDeRetard < seuilPremiereRelance) continue

    const joursDepuisDernierRappel =
      facture.dernierRappelLe === null ? null : ecartEnJours(facture.dernierRappelLe)

    // Un rappel émis récemment suspend la proposition, quel que soit le retard.
    if (joursDepuisDernierRappel !== null && joursDepuisDernierRappel < delaiEntreRelances) {
      continue
    }

    proposees.push({
      factureId: facture.id,
      numero: facture.numero,
      clientNom: facture.clientNom,
      niveau: facture.nombreRappels + 1,
      joursDeRetard,
      joursDepuisDernierRappel,
      epuisee: facture.nombreRappels >= NIVEAU_MAX_RELANCE
    })
  }

  // Le plus en retard d'abord : c'est l'ordre dans lequel on veut agir.
  return proposees.sort((a, b) => b.joursDeRetard - a.joursDeRetard)
}

/** Ordinal français : 1 → « 1er », 2 → « 2e ». */
export function ordinalFrancais(nombre: number): string {
  return nombre === 1 ? '1er' : `${nombre}e`
}

/** Ordinal anglais : 1 → « 1st », 2 → « 2nd », 3 → « 3rd », 4 → « 4th ». */
export function ordinalAnglais(nombre: number): string {
  // 11, 12 et 13 sont l'exception à connaître : « 11th », pas « 11st ».
  const deuxDerniers = nombre % 100
  if (deuxDerniers >= 11 && deuxDerniers <= 13) return `${nombre}th`
  const dernier = nombre % 10
  if (dernier === 1) return `${nombre}st`
  if (dernier === 2) return `${nombre}nd`
  if (dernier === 3) return `${nombre}rd`
  return `${nombre}th`
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
