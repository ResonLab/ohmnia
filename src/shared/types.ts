export interface Entreprise {
  nom: string
  adresse: string
  email: string
  telephone: string
  iban: string
  titulaireCompte: string
  tvaDefautPct: number
  logoPath: string | null
  prefixeFacture: string
  prefixeDevis: string
  /** Faux = aucune TVA facturée et mention légale imprimée sur les documents. */
  assujettiTva: boolean
  /** Identifiant fiscal, dont le format dépend du pays (IDE, SIRET, USt-IdNr…). */
  numeroIde: string
  conditionsGenerales: string
  mentionsPied: string
  /** Code ISO du pays : pilote devise, taux de taxe et mentions légales. */
  pays: string
}

export interface EtatConditions {
  versionCourante: string
  versionAcceptee: string
  accepteeLe: string
  /** Vrai tant que la version courante des conditions n'a pas été acceptée. */
  doitAccepter: boolean
}

export interface PointConformite {
  cle: string
  libelle: string
  statut: 'ok' | 'avertissement' | 'manquant'
  explication: string
}

export type Theme = 'sombre' | 'clair' | 'auto'

export interface ParametresApp {
  dossierDocuments: string | null
  nbSauvegardes: number
  theme: Theme
  /** Langue de l'interface et des documents : 'fr' ou 'en'. */
  langue: string
  couleurAccent: string
  delaiPaiementDefaut: number
  validiteDevisDefaut: number
  seuilAlerteFactureJours: number
}

export interface InfosSysteme {
  version: string
  versionElectron: string
  versionNode: string
  dossierDonnees: string
  cheminBase: string
  tailleBaseOctets: number
  dossierDocumentsEffectif: string
  nbSauvegardes: number
  dossierSauvegardes: string
}

export interface SauvegardeFichier {
  nom: string
  dateIso: string
  tailleOctets: number
}

export interface ChargeFixe {
  id: number
  libelle: string
  montantMensuel: number
  categorie: string
  actif: boolean
}

export interface ParametresMarge {
  heuresFacturablesMois: number
  caEstimeMensuel: number
}

export interface ParametresDeplacement {
  consoL100km: number
  prixEssence: number
  entretienKm: number
  margeLivraisonPct: number
}

export interface ParametresImpressionDb {
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

export interface TarifProduit {
  id: number
  designation: string
  prixAchat: number
  margePct: number | null
  referenceInventaire: string | null
}

export interface TarifMainOeuvre {
  id: number
  description: string
  heures: number
  tauxHoraire: number | null
}

export interface TarifDeplacement {
  id: number
  description: string
  distanceKm: number
  prixKm: number | null
}

export type TypeMouvement = 'Entrée' | 'Dépense'

export interface CategorieJournal {
  id: number
  libelle: string
}

export interface EcritureJournal {
  id: number
  date: string
  annee: number
  type: TypeMouvement
  categorieId: number | null
  categorieLibelle: string | null
  description: string
  montant: number
  numeroFacture: string | null
  notes: string
  tvaPct: number | null
  montantTva: number
}

export interface FiltresJournal {
  annee?: number
  type?: TypeMouvement
  categorieId?: number
}

export interface RepartitionCategorie {
  categorie: string
  total: number
}

export interface EvolutionAnnuelle {
  annee: number
  entrees: number
  depenses: number
}

export interface Client {
  id: number
  nom: string
  adresse: string
  email: string
  telephone: string
}

export interface FactureDuClient {
  id: number
  numero: string
  date: string
  statut: 'Payée' | 'En attente' | 'Annulée'
  montant: number | null
  joursEnAttente: number | null
}

export interface DevisDuClient {
  id: number
  numero: string
  date: string
  statut: 'Accepté' | 'En attente' | 'Refusé'
  total: number
}

export interface ClientDetail extends Client {
  factures: FactureDuClient[]
  devis: DevisDuClient[]
  totalFacture: number
  totalEnAttente: number
}

export type StatutFacture = 'Payée' | 'En attente' | 'Annulée'
export type StatutDevis = 'Accepté' | 'En attente' | 'Refusé'

export interface FactureLigne {
  id: number
  designation: string
  referenceInventaire: string | null
  quantite: number
  prixUnitaire: number
}

export interface Facture {
  id: number
  numero: string
  date: string
  clientId: number
  delaiPaiementJours: number
  remisePct: number
  impressionIncluse: boolean
  tvaPct: number
  statut: StatutFacture
  notesInternes: string
  stockDeduit: boolean
}

export interface FactureDetail extends Facture {
  lignes: FactureLigne[]
}

export interface HistoriqueFacture extends Facture {
  clientNom: string
  montant: number | null
  joursEnAttente: number | null
}

export interface DevisLigne {
  id: number
  designation: string
  quantite: number
  prixUnitaire: number
}

export interface Devis {
  id: number
  numero: string
  date: string
  clientId: number
  validiteJours: number
  remisePct: number
  tvaPct: number
  statut: StatutDevis
}

export interface DevisDetail extends Devis {
  lignes: DevisLigne[]
}

export interface HistoriqueDevis extends Devis {
  clientNom: string
  total: number
  factureLiee: string | null
}

export interface ArticleInventaire {
  reference: string
  designation: string
  categorie: string
  quantiteStock: number
  seuilAlerte: number
  prixAchatUnitaire: number
  prixVenteUnitaire: number
  fournisseur: string
  emplacement: string
  derniereMaj: string
}

export interface ResumeInventaire {
  valeurTotaleStock: number
  nbReferencesSousSeuil: number
}

export interface ResumeAnnuel {
  annee: number
  entrees: number
  depenses: number
  beneficeNet: number
  tvaCollectee: number
  tvaDeductible: number
  tvaNette: number
}

export type SourceMaj = 'github' | 'url'

export interface ConfigurationMaj {
  source: SourceMaj
  /** Dépôt GitHub au format « proprietaire/depot ». */
  depot: string
  /** Adresse HTTP d'un dossier de publication (source « url »). */
  url: string | null
  auto: boolean
}

export interface EtatMaj {
  statut: 'inactif' | 'verification' | 'aJour' | 'disponible' | 'telechargement' | 'telechargee' | 'erreur'
  versionActuelle: string
  versionDisponible?: string
  pourcentage?: number
  notes?: string
  message?: string
}

export type TypeResultatRecherche =
  | 'client'
  | 'facture'
  | 'devis'
  | 'article'
  | 'ecriture'
  | 'modele'

export interface ResultatRecherche {
  type: TypeResultatRecherche
  /** Module à ouvrir quand on sélectionne ce résultat. */
  module: string
  titre: string
  sousTitre: string
}

export interface EntreeAudit {
  id: number
  horodatage: string
  action: string
  entite: string
  reference: string
  details: string
}

export interface ExerciceCloture {
  annee: number
  clotureLe: string
}

export interface MouvementBancaire {
  date: string
  libelle: string
  montant: number
  /** Vrai si une écriture du Journal correspond déjà (même date et même montant). */
  dejaRapproche: boolean
  ecritureExistanteId: number | null
}

export interface ResultatImport {
  fichier: string
  mouvements: MouvementBancaire[]
  format: 'CSV' | 'CAMT.053'
}

export interface Justificatif {
  id: number
  journalId: number
  nomFichier: string
  ajouteLe: string
}

export interface Intervention {
  id: number
  description: string
  clientId: number | null
  clientNom: string | null
  debut: string
  fin: string | null
  secondesEcoulees: number
  factureId: number | null
  tauxHoraire: number | null
}

export interface FactureEcheance {
  id: number
  numero: string
  clientNom: string
  dateEcheance: string
  joursRestants: number
  montant: number | null
}

export interface TableauDeBord {
  moisCourant: string
  caMois: number
  depensesMois: number
  beneficeMois: number
  caAnnee: number
  objectifAnnee: number
  nbFacturesEnAttente: number
  montantEnAttente: number
  nbFacturesEnRetard: number
  montantEnRetard: number
  articlesSousSeuil: { reference: string; designation: string; quantiteStock: number; seuilAlerte: number }[]
  prochainesEcheances: FactureEcheance[]
  nbDevisEnAttente: number
  valeurStock: number
}

export interface ModeleLigne {
  id: number
  designation: string
  referenceInventaire: string | null
  quantite: number
  prixUnitaire: number
}

export interface ModelePrestation {
  id: number
  nom: string
  lignes: ModeleLigne[]
}

export interface Rappel {
  id: number
  factureId: number
  niveau: number
  date: string
  frais: number
}

export interface LigneDocumentImpression {
  designation: string
  quantite: number
  prixUnitaire: number
  total: number
}

export interface DocumentImpression {
  typeDocument: 'facture' | 'devis' | 'rappel'
  /** Pays de l'émetteur : pilote devise, nom de la taxe et mentions légales. */
  pays: string
  numeroIde: string
  libelleIdentifiant: string
  nomTaxe: string
  assujettiTva: boolean
  mentionNonAssujetti: string
  conditionsGenerales: string
  mentionsPied: string
  /** Rappels uniquement : niveau, frais et date d'échéance dépassée. */
  rappelNiveau?: number
  rappelFrais?: number
  joursDeRetard?: number
  entrepriseNom: string
  entrepriseAdresse: string
  entrepriseEmail: string
  entrepriseTelephone: string
  logoDataUrl: string | null
  iban: string
  titulaireCompte: string
  clientNom: string
  clientAdresse: string
  numero: string
  date: string
  /** Clé de traduction du libellé d'échéance (le renderer la traduit). */
  labelEcheance: string
  dateEcheance: string
  /** Clé de traduction du libellé de total. */
  labelTotal: string
  lignes: LigneDocumentImpression[]
  remisePct: number
  tvaPct: number
  sousTotal: number
  totalApresRemise: number
  montantTva: number
  total: number
  codeVerification: string
}
