import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { getDb } from '../db/database'
import { profilPays } from '../../shared/pays'
import {
  calculerEcheance,
  calculerPrixFactureImpression,
  calculerTotalDocument,
  ordinalFrancais
} from '../../shared/calculs'
import type { DocumentImpression } from '../../shared/types'

/**
 * Données imprimées sur une facture, un devis ou un rappel — sans Electron.
 *
 * Ce code vivait dans `../pdf.ts`, qui lisait la base directement. En mode
 * multi-postes la base n'est plus sur le poste : les PDF seraient sortis vides.
 * Ici, la même fonction sert les deux modes — localement, ou par le réseau via
 * le canal `documents:donnees`.
 *
 * **Le logo voyage en data URL**, pas en chemin de fichier : un chemin du
 * serveur ne veut rien dire sur le poste qui imprime.
 */

function calculerCodeVerification(numero: string, total: number, date: string): string {
  return createHash('sha256')
    .update(`${numero}|${total.toFixed(2)}|${date}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase()
}

function lireLogoDataUrl(cheminLogo: string | null): string | null {
  if (!cheminLogo || !existsSync(cheminLogo)) return null
  const extension = cheminLogo.slice(cheminLogo.lastIndexOf('.')).toLowerCase()
  const mimeParExtension: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
  }
  const mime = mimeParExtension[extension]
  if (!mime) return null
  return `data:${mime};base64,${readFileSync(cheminLogo).toString('base64')}`
}

interface EntrepriseImpression {
  nom: string
  adresse: string
  email: string
  telephone: string
  iban: string
  titulaireCompte: string
  logoDataUrl: string | null
  pays: string
  numeroIde: string
  assujettiTva: boolean
  conditionsGenerales: string
  mentionsPied: string
}

function chargerEntreprise(): EntrepriseImpression {
  const e = getDb().prepare('SELECT * FROM entreprise WHERE id = 1').get() as {
    nom: string
    adresse: string
    email: string
    telephone: string
    iban: string
    titulaire_compte: string
    logo_path: string | null
    pays: string
    numero_ide: string
    assujetti_tva: number
    conditions_generales: string
    mentions_pied: string
  }
  return {
    nom: e.nom,
    adresse: e.adresse,
    email: e.email,
    telephone: e.telephone,
    iban: e.iban,
    titulaireCompte: e.titulaire_compte,
    logoDataUrl: lireLogoDataUrl(e.logo_path),
    pays: e.pays,
    numeroIde: e.numero_ide,
    assujettiTva: e.assujetti_tva === 1,
    conditionsGenerales: e.conditions_generales,
    mentionsPied: e.mentions_pied
  }
}

/** Champs identiques sur facture, devis et rappel : émetteur et cadre légal. */
function champsCommuns(entreprise: EntrepriseImpression): Pick<
  DocumentImpression,
  | 'entrepriseNom'
  | 'entrepriseAdresse'
  | 'entrepriseEmail'
  | 'entrepriseTelephone'
  | 'logoDataUrl'
  | 'iban'
  | 'titulaireCompte'
  | 'pays'
  | 'numeroIde'
  | 'libelleIdentifiant'
  | 'nomTaxe'
  | 'assujettiTva'
  | 'mentionNonAssujetti'
  | 'conditionsGenerales'
  | 'mentionsPied'
> {
  const profil = profilPays(entreprise.pays)
  return {
    entrepriseNom: entreprise.nom,
    entrepriseAdresse: entreprise.adresse,
    entrepriseEmail: entreprise.email,
    entrepriseTelephone: entreprise.telephone,
    logoDataUrl: entreprise.logoDataUrl,
    iban: entreprise.iban,
    titulaireCompte: entreprise.titulaireCompte,
    pays: entreprise.pays,
    numeroIde: entreprise.numeroIde,
    libelleIdentifiant: profil.libelleIdentifiant,
    nomTaxe: profil.nomTaxe,
    assujettiTva: entreprise.assujettiTva,
    // La mention n'est imprimée que si l'entreprise n'est pas assujettie.
    mentionNonAssujetti: entreprise.assujettiTva ? '' : profil.mentionNonAssujetti,
    conditionsGenerales: entreprise.conditionsGenerales,
    mentionsPied: entreprise.mentionsPied
  }
}

function construireDonneesFacture(id: number): DocumentImpression {
  const facture = getDb().prepare('SELECT * FROM factures WHERE id = ?').get(id) as {
    id: number
    numero: string
    date: string
    client_id: number
    delai_paiement_jours: number
    remise_pct: number
    impression_incluse: number
    tva_pct: number
  }
  if (!facture) throw new Error("Cette facture n'existe pas.")

  const client = getDb().prepare('SELECT * FROM clients WHERE id = ?').get(facture.client_id) as {
    nom: string
    adresse: string
  }

  const lignesDb = getDb()
    .prepare('SELECT designation, quantite, prix_unitaire FROM facture_lignes WHERE facture_id = ?')
    .all(id) as { designation: string; quantite: number; prix_unitaire: number }[]
  const lignes = lignesDb.map((l) => ({
    designation: l.designation,
    quantite: l.quantite,
    prixUnitaire: l.prix_unitaire,
    total: l.quantite * l.prix_unitaire
  }))

  let fraisImpression = 0
  if (facture.impression_incluse) {
    const p = getDb().prepare('SELECT * FROM parametres_impression WHERE id = 1').get() as {
      prix_sachet_a4: number
      feuilles_par_sachet: number
      feuilles_par_facture: number
      prix_imprimante: number
      nb_factures_avant_remplacement: number
      prix_encre: number
      feuilles_par_cartouche: number
      prix_timbre: number
      prix_sachet_enveloppes: number
      nb_enveloppes_par_sachet: number
      marge_impression_pct: number
    }
    fraisImpression = calculerPrixFactureImpression({
      prixSachetA4: p.prix_sachet_a4,
      feuillesParSachet: p.feuilles_par_sachet,
      feuillesParFacture: p.feuilles_par_facture,
      prixImprimante: p.prix_imprimante,
      nbFacturesAvantRemplacement: p.nb_factures_avant_remplacement,
      prixEncre: p.prix_encre,
      feuillesParCartouche: p.feuilles_par_cartouche,
      prixTimbre: p.prix_timbre,
      prixSachetEnveloppes: p.prix_sachet_enveloppes,
      nbEnveloppesParSachet: p.nb_enveloppes_par_sachet,
      margeImpressionPct: p.marge_impression_pct
    })
    lignes.push({
      // Libellé métier fixe : il apparaît tel quel sur le document client.
      designation: "Frais d'impression et d'envoi",
      quantite: 1,
      prixUnitaire: fraisImpression,
      total: fraisImpression
    })
    fraisImpression = 0 // déjà inclus comme ligne, ne pas l'ajouter une 2e fois au total
  }

  const totaux = calculerTotalDocument(lignes, facture.remise_pct, facture.tva_pct, fraisImpression)
  const entreprise = chargerEntreprise()

  return {
    typeDocument: 'facture',
    ...champsCommuns(entreprise),
    clientNom: client?.nom ?? 'Client supprimé',
    clientAdresse: client?.adresse ?? '',
    numero: facture.numero,
    date: facture.date,
    labelEcheance: 'doc.echeance',
    dateEcheance: calculerEcheance(facture.date, facture.delai_paiement_jours),
    labelTotal: 'doc.totalAPayer',
    lignes,
    remisePct: facture.remise_pct,
    tvaPct: facture.tva_pct,
    ...totaux,
    codeVerification: calculerCodeVerification(facture.numero, totaux.total, facture.date)
  }
}

function construireDonneesDevis(id: number): DocumentImpression {
  const devis = getDb().prepare('SELECT * FROM devis WHERE id = ?').get(id) as {
    id: number
    numero: string
    date: string
    client_id: number
    validite_jours: number
    remise_pct: number
    tva_pct: number
  }
  if (!devis) throw new Error("Ce devis n'existe pas.")

  const client = getDb().prepare('SELECT * FROM clients WHERE id = ?').get(devis.client_id) as {
    nom: string
    adresse: string
  }

  const lignesDb = getDb()
    .prepare('SELECT designation, quantite, prix_unitaire FROM devis_lignes WHERE devis_id = ?')
    .all(id) as { designation: string; quantite: number; prix_unitaire: number }[]
  const lignes = lignesDb.map((l) => ({
    designation: l.designation,
    quantite: l.quantite,
    prixUnitaire: l.prix_unitaire,
    total: l.quantite * l.prix_unitaire
  }))

  const totaux = calculerTotalDocument(lignes, devis.remise_pct, devis.tva_pct)
  const entreprise = chargerEntreprise()

  return {
    typeDocument: 'devis',
    ...champsCommuns(entreprise),
    clientNom: client?.nom ?? 'Client supprimé',
    clientAdresse: client?.adresse ?? '',
    numero: devis.numero,
    date: devis.date,
    labelEcheance: 'doc.valableJusquau',
    dateEcheance: calculerEcheance(devis.date, devis.validite_jours),
    labelTotal: 'doc.totalDevis',
    lignes,
    remisePct: devis.remise_pct,
    tvaPct: devis.tva_pct,
    ...totaux,
    codeVerification: calculerCodeVerification(devis.numero, totaux.total, devis.date)
  }
}

/**
 * Rappel de paiement : reprend la facture, ajoute les frais de rappel
 * et remplace l'échéance par le nombre de jours de retard.
 */
function construireDonneesRappel(factureId: number, rappelId: number): DocumentImpression {
  const base = construireDonneesFacture(factureId)

  const rappel = getDb()
    .prepare('SELECT niveau, date, frais FROM rappels WHERE id = ?')
    .get(rappelId) as { niveau: number; date: string; frais: number } | undefined
  if (!rappel) throw new Error("Ce rappel n'existe pas.")

  const lignes = [...base.lignes]
  if (rappel.frais > 0) {
    lignes.push({
      designation: `Frais de rappel (${ordinalFrancais(rappel.niveau)} rappel)`,
      quantite: 1,
      prixUnitaire: rappel.frais,
      total: rappel.frais
    })
  }

  const totaux = calculerTotalDocument(lignes, base.remisePct, base.tvaPct)
  const joursDeRetard = Math.max(
    0,
    Math.floor((new Date(rappel.date).getTime() - new Date(base.dateEcheance).getTime()) / 86400000)
  )

  return {
    ...base,
    typeDocument: 'rappel',
    rappelNiveau: rappel.niveau,
    rappelFrais: rappel.frais,
    joursDeRetard,
    date: rappel.date,
    labelEcheance: 'doc.factureEchueLe',
    dateEcheance: base.dateEcheance,
    labelTotal: 'doc.montantTotalDu',
    lignes,
    ...totaux,
    codeVerification: calculerCodeVerification(
      `${base.numero}-R${rappel.niveau}`,
      totaux.total,
      rappel.date
    )
  }
}

export type TypeDocument = 'facture' | 'devis' | 'rappel'

/** Point d'entrée unique : un seul canal sert les trois documents. */
export function donneesDocument(
  type: TypeDocument,
  id: number,
  rappelId?: number
): DocumentImpression {
  if (type === 'facture') return construireDonneesFacture(id)
  if (type === 'devis') return construireDonneesDevis(id)
  if (rappelId === undefined) throw new Error("Un rappel exige l'identifiant du rappel.")
  return construireDonneesRappel(id, rappelId)
}
