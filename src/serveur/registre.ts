import {
  cloturerExercice,
  listerAudit,
  listerExercices,
  reouvrirExercice,
  viderAudit
} from '../main/domaines/audit'
import {
  creerRappel,
  listerRappels,
  prochainNiveauRappel,
  relancesAFaire,
  supprimerRappel
} from '../main/domaines/rappels'
import {
  enregistrerObjectifAnnuel,
  lireObjectifAnnuel,
  resumeParAnnee
} from '../main/domaines/resume'
import { chargerTableauDeBord } from '../main/domaines/tableauDeBord'
import {
  enregistrerParametresApp,
  lireParametresApp,
  verifierIntegrite
} from '../main/domaines/parametresApp'
import {
  ajouterCategorieJournal,
  ajouterEcritureJournal,
  evolutionAnnuelle,
  listerCategoriesJournal,
  listerJournal,
  modifierEcritureJournal,
  renommerCategorieJournal,
  repartitionParCategorie,
  supprimerCategorieJournal,
  supprimerEcritureJournal
} from '../main/domaines/journal'
import {
  ajouterChargeFixe,
  enregistrerParametresDeplacement,
  enregistrerParametresImpression,
  enregistrerParametresMarge,
  lireParametresDeplacement,
  lireParametresImpression,
  lireParametresMarge,
  listerChargesFixes,
  modifierChargeFixe,
  supprimerChargeFixe
} from '../main/domaines/parametres'
import {
  ajouterClient,
  listerClients,
  modifierClient,
  obtenirDetailClient,
  supprimerClient
} from '../main/domaines/clients'
import {
  creerModele,
  creerModeleDepuisFacture,
  enregistrerModele,
  listerModeles,
  supprimerModele
} from '../main/domaines/modeles'
import {
  ajouterTarifDeplacement,
  ajouterTarifMainOeuvre,
  ajouterTarifProduit,
  listerTarifsDeplacement,
  listerTarifsMainOeuvre,
  listerTarifsProduits,
  modifierTarifDeplacement,
  modifierTarifMainOeuvre,
  modifierTarifProduit,
  supprimerTarifDeplacement,
  supprimerTarifMainOeuvre,
  supprimerTarifProduit
} from '../main/domaines/tarifs'
import {
  ajouterArticle,
  listerInventaire,
  modifierArticle,
  referenceSuggeree,
  resumeInventaire,
  supprimerArticle
} from '../main/domaines/inventaire'
import { rechercheGlobale } from '../main/domaines/recherche'
import { verifierConformite } from '../main/domaines/conformite'
import { accepterConditions, etatConditions } from '../main/domaines/conditions'
import {
  definirLogo,
  enregistrerEntreprise,
  lireEntreprise,
  lireLogo,
  retirerLogo
} from '../main/domaines/entreprise'
import {
  ajouterJustificatif,
  compterJustificatifsParEcriture,
  contenuJustificatif,
  listerJustificatifs,
  supprimerJustificatif
} from '../main/domaines/justificatifs'
import {
  analyserReleve,
  construireCsvComptable,
  importerMouvements
} from '../main/domaines/comptabilite'
import { donneesDocument, type TypeDocument } from '../main/domaines/documents'
import {
  changerStatutDevis,
  chargerDetailDevis,
  creerBrouillonDevis,
  dupliquerDevis,
  enregistrerDevis,
  historiqueDevis,
  supprimerDevis
} from '../main/domaines/devis'
import {
  changerStatutFacture,
  chargerDetailFacture,
  confirmerEnregistrementHistorique,
  creerBrouillonFacture,
  creerFactureDepuisDevis,
  dupliquerFacture,
  enregistrerFacture,
  historiqueFactures,
  supprimerFacture
} from '../main/domaines/factures'
import {
  arreterIntervention,
  demarrerIntervention,
  facturerInterventions,
  interventionEnCours,
  listerInterventions,
  modifierIntervention,
  supprimerIntervention
} from '../main/domaines/suiviTemps'

/**
 * Ce que le serveur sait faire, canal par canal.
 *
 * Les noms sont **exactement ceux des canaux IPC** de l'application locale.
 * Une opération se comporte donc pareil qu'elle passe par la fenêtre ou par le
 * réseau, et l'interface n'a qu'un aiguillage à faire, pas deux implémentations
 * à maintenir.
 *
 * Pour ajouter un domaine : l'extraire d'abord dans `main/domaines/`, puis
 * l'inscrire ici. Rien d'autre.
 */
export type Operation = (...arguments_: unknown[]) => unknown

export const REGISTRE: Record<string, Operation> = {
  'clients:lister': () => listerClients(),
  'clients:ajouter': (client) => ajouterClient(client as Parameters<typeof ajouterClient>[0]),
  'clients:modifier': (client) => modifierClient(client as Parameters<typeof modifierClient>[0]),
  'clients:supprimer': (id) => supprimerClient(id as number),
  'clients:obtenirDetail': (id) => obtenirDetailClient(id as number),

  'audit:lister': (limite) => listerAudit((limite as number) ?? 300),
  'audit:vider': () => viderAudit(),
  'exercices:lister': () => listerExercices(),
  'exercices:cloturer': (annee) => cloturerExercice(annee as number),
  'exercices:reouvrir': (annee) => reouvrirExercice(annee as number),

  'rappels:lister': (factureId) => listerRappels(factureId as number),
  'rappels:prochainNiveau': (factureId) => prochainNiveauRappel(factureId as number),
  'rappels:creer': (factureId, niveau, frais) =>
    creerRappel(factureId as number, niveau as number, frais as number),
  'rappels:supprimer': (id) => supprimerRappel(id as number),
  'rappels:aFaire': () => relancesAFaire(),

  'resume:parAnnee': () => resumeParAnnee(),
  'objectifAnnuel:lire': (annee) => lireObjectifAnnuel(annee as number),
  'objectifAnnuel:enregistrer': (annee, objectif) =>
    enregistrerObjectifAnnuel(annee as number, objectif as number),

  'tableauDeBord:charger': () => chargerTableauDeBord(),
  'parametresApp:lire': () => lireParametresApp(),

  'modeles:lister': () => listerModeles(),
  'modeles:creer': (nom) => creerModele(nom as string),
  'modeles:enregistrer': (modele) =>
    enregistrerModele(modele as Parameters<typeof enregistrerModele>[0]),
  'modeles:supprimer': (id) => supprimerModele(id as number),
  'modeles:creerDepuisFacture': (factureId, nom) =>
    creerModeleDepuisFacture(factureId as number, nom as string),

  'tarifsProduits:lister': () => listerTarifsProduits(),
  'tarifsProduits:ajouter': (tarif) =>
    ajouterTarifProduit(tarif as Parameters<typeof ajouterTarifProduit>[0]),
  'tarifsProduits:modifier': (tarif) =>
    modifierTarifProduit(tarif as Parameters<typeof modifierTarifProduit>[0]),
  'tarifsProduits:supprimer': (id) => supprimerTarifProduit(id as number),

  'tarifsMainOeuvre:lister': () => listerTarifsMainOeuvre(),
  'tarifsMainOeuvre:ajouter': (tarif) =>
    ajouterTarifMainOeuvre(tarif as Parameters<typeof ajouterTarifMainOeuvre>[0]),
  'tarifsMainOeuvre:modifier': (tarif) =>
    modifierTarifMainOeuvre(tarif as Parameters<typeof modifierTarifMainOeuvre>[0]),
  'tarifsMainOeuvre:supprimer': (id) => supprimerTarifMainOeuvre(id as number),

  'tarifsDeplacement:lister': () => listerTarifsDeplacement(),
  'tarifsDeplacement:ajouter': (tarif) =>
    ajouterTarifDeplacement(tarif as Parameters<typeof ajouterTarifDeplacement>[0]),
  'tarifsDeplacement:modifier': (tarif) =>
    modifierTarifDeplacement(tarif as Parameters<typeof modifierTarifDeplacement>[0]),
  'tarifsDeplacement:supprimer': (id) => supprimerTarifDeplacement(id as number),

  'inventaire:lister': () => listerInventaire(),
  'inventaire:referenceSuggeree': () => referenceSuggeree(),
  'inventaire:ajouter': (article) =>
    ajouterArticle(article as Parameters<typeof ajouterArticle>[0]),
  'inventaire:modifier': (referenceOrigine, article) =>
    modifierArticle(referenceOrigine as string, article as Parameters<typeof modifierArticle>[1]),
  'inventaire:supprimer': (reference) => supprimerArticle(reference as string),
  'inventaire:resume': () => resumeInventaire(),

  'recherche:globale': (terme) => rechercheGlobale(terme as string),

  'conformite:verifier': () => verifierConformite(),

  'suiviTemps:lister': () => listerInterventions(),
  'suiviTemps:enCours': () => interventionEnCours(),
  'suiviTemps:demarrer': (description, clientId) =>
    demarrerIntervention(description as string, clientId as number | null),
  'suiviTemps:arreter': (id) => arreterIntervention(id as number),
  'suiviTemps:modifier': (intervention) =>
    modifierIntervention(intervention as Parameters<typeof modifierIntervention>[0]),
  'suiviTemps:supprimer': (id) => supprimerIntervention(id as number),
  'suiviTemps:facturer': (ids, factureId, tauxHoraireParDefaut) =>
    facturerInterventions(ids as number[], factureId as number, tauxHoraireParDefaut as number),

  'devis:creerBrouillon': (clientId) => creerBrouillonDevis(clientId as number),
  'devis:obtenirDetail': (id) => chargerDetailDevis(id as number),
  'devis:dupliquer': (id) => dupliquerDevis(id as number),
  'devis:enregistrer': (detail) => enregistrerDevis(detail as Parameters<typeof enregistrerDevis>[0]),
  'devis:supprimer': (id) => supprimerDevis(id as number),
  'devis:changerStatut': (id, statut) =>
    changerStatutDevis(id as number, statut as Parameters<typeof changerStatutDevis>[1]),
  'devis:historique': () => historiqueDevis(),

  'factures:creerBrouillon': (clientId) => creerBrouillonFacture(clientId as number),
  'factures:obtenirDetail': (id) => chargerDetailFacture(id as number),
  'factures:dupliquer': (id) => dupliquerFacture(id as number),
  'factures:creerDepuisDevis': (devisId) => creerFactureDepuisDevis(devisId as number),
  'factures:enregistrer': (detail) =>
    enregistrerFacture(detail as Parameters<typeof enregistrerFacture>[0]),
  'factures:supprimer': (id) => supprimerFacture(id as number),
  'factures:changerStatut': (id, statut) =>
    changerStatutFacture(id as number, statut as Parameters<typeof changerStatutFacture>[1]),
  'factures:historique': () => historiqueFactures(),
  'factures:confirmerEnregistrementHistorique': (id) => confirmerEnregistrementHistorique(id as number),

  'categoriesJournal:lister': () => listerCategoriesJournal(),
  'categoriesJournal:ajouter': (libelle) => ajouterCategorieJournal(libelle as string),
  'categoriesJournal:renommer': (id, libelle) =>
    renommerCategorieJournal(id as number, libelle as string),
  'categoriesJournal:supprimer': (id) => supprimerCategorieJournal(id as number),

  'journal:lister': (filtres) => listerJournal((filtres as Parameters<typeof listerJournal>[0]) ?? {}),
  'journal:ajouter': (valeurs) =>
    ajouterEcritureJournal(valeurs as Parameters<typeof ajouterEcritureJournal>[0]),
  'journal:modifier': (valeurs) =>
    modifierEcritureJournal(valeurs as Parameters<typeof modifierEcritureJournal>[0]),
  'journal:supprimer': (id) => supprimerEcritureJournal(id as number),
  'journal:repartitionParCategorie': (filtres) =>
    repartitionParCategorie((filtres as Parameters<typeof repartitionParCategorie>[0]) ?? {}),
  'journal:evolutionAnnuelle': () => evolutionAnnuelle(),

  'parametresMarge:lire': () => lireParametresMarge(),
  'parametresMarge:enregistrer': (valeurs) =>
    enregistrerParametresMarge(valeurs as Parameters<typeof enregistrerParametresMarge>[0]),
  'parametresDeplacement:lire': () => lireParametresDeplacement(),
  'parametresDeplacement:enregistrer': (valeurs) =>
    enregistrerParametresDeplacement(
      valeurs as Parameters<typeof enregistrerParametresDeplacement>[0]
    ),
  'parametresImpression:lire': () => lireParametresImpression(),
  'parametresImpression:enregistrer': (valeurs) =>
    enregistrerParametresImpression(valeurs as Parameters<typeof enregistrerParametresImpression>[0]),

  'chargesFixes:lister': () => listerChargesFixes(),
  'chargesFixes:ajouter': (charge) =>
    ajouterChargeFixe(charge as Parameters<typeof ajouterChargeFixe>[0]),
  'chargesFixes:modifier': (charge) =>
    modifierChargeFixe(charge as Parameters<typeof modifierChargeFixe>[0]),
  'chargesFixes:supprimer': (id) => supprimerChargeFixe(id as number),

  'parametresApp:enregistrer': (valeurs) =>
    enregistrerParametresApp(valeurs as Parameters<typeof enregistrerParametresApp>[0]),
  'parametresApp:verifierIntegrite': () => verifierIntegrite(),

  'conditions:etat': () => etatConditions(),
  'conditions:accepter': () => accepterConditions(),

  'entreprise:lire': () => lireEntreprise(),
  'entreprise:enregistrer': (valeurs) =>
    enregistrerEntreprise(valeurs as Parameters<typeof enregistrerEntreprise>[0]),

  'entreprise:logo': () => lireLogo(),
  'entreprise:definirLogo': (nomFichier, contenu) =>
    definirLogo(nomFichier as string, contenu as string),
  'entreprise:retirerLogo': () => retirerLogo(),

  // Les fichiers joints voyagent en base64 : ils vivent avec la base, donc sur
  // le serveur en multi-postes, et tous les postes les voient.
  'justificatifs:lister': (journalId) => listerJustificatifs(journalId as number),
  'justificatifs:compterParEcriture': () => compterJustificatifsParEcriture(),
  'justificatifs:ajouterFichier': (journalId, nom, contenu) =>
    ajouterJustificatif(journalId as number, nom as string, contenu as string),
  'justificatifs:contenu': (nomFichier) => contenuJustificatif(nomFichier as string),
  'justificatifs:supprimer': (id) => supprimerJustificatif(id as number),

  // Choisir un fichier reste côté fenêtre ; produire le CSV et analyser un
  // relevé demandent la base, donc passent par ici.
  'comptabilite:construireCsv': (annee) => construireCsvComptable(annee as number | null),
  'comptabilite:analyserReleve': (contenu, estXml) =>
    analyserReleve(contenu as string, estXml as boolean),
  'comptabilite:importerMouvements': (mouvements, entreeId, depenseId) =>
    importerMouvements(
      mouvements as Parameters<typeof importerMouvements>[0],
      entreeId as number | null,
      depenseId as number | null
    ),

  // Sans ce canal, les PDF sortiraient vides en mode multi-postes : la
  // fabrication du document est locale, mais ses données sont dans la base.
  'documents:donnees': (type, id, rappelId) =>
    donneesDocument(type as TypeDocument, id as number, rappelId as number | undefined)
}
