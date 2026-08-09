import { contextBridge, ipcRenderer } from 'electron'
import type {
  ArticleInventaire,
  CategorieJournal,
  ChargeFixe,
  Client,
  ClientDetail,
  ConfigurationMaj,
  DevisDetail,
  DocumentImpression,
  EcritureJournal,
  EntreeAudit,
  Entreprise,
  EtatConditions,
  EtatMultipostes,
  EtatMaj,
  EvolutionAnnuelle,
  ExerciceCloture,
  Facture,
  FactureDetail,
  FiltresJournal,
  HistoriqueDevis,
  HistoriqueFacture,
  InfosSysteme,
  Intervention,
  Justificatif,
  ModelePrestation,
  MouvementBancaire,
  ParametresApp,
  ParametresDeplacement,
  ParametresImpressionDb,
  ParametresMarge,
  PointConformite,
  Rappel,
  RepartitionCategorie,
  ResultatImport,
  ResultatRecherche,
  ResumeAnnuel,
  ResumeInventaire,
  SauvegardeFichier,
  SessionMultipostes,
  StatutDevis,
  TableauDeBord,
  TarifDeplacement,
  TarifMainOeuvre,
  TarifProduit
} from '../shared/types'

const api = {
  entreprise: {
    lire: (): Promise<Entreprise> => ipcRenderer.invoke('entreprise:lire'),
    enregistrer: (valeurs: Entreprise): Promise<Entreprise> =>
      ipcRenderer.invoke('entreprise:enregistrer', valeurs),
    /** Le logo est rangé dans la base : plus aucun chemin de fichier à passer. */
    lireLogoDataUrl: (): Promise<string | null> => ipcRenderer.invoke('entreprise:lireLogoDataUrl'),
    choisirLogo: (): Promise<{ dataUrl: string } | null> =>
      ipcRenderer.invoke('entreprise:choisirLogo'),
    retirerLogo: (): Promise<void> => ipcRenderer.invoke('entreprise:retirerLogoChoisi')
  },

  parametresMarge: {
    lire: (): Promise<ParametresMarge> => ipcRenderer.invoke('parametresMarge:lire'),
    enregistrer: (valeurs: ParametresMarge): Promise<ParametresMarge> =>
      ipcRenderer.invoke('parametresMarge:enregistrer', valeurs)
  },

  parametresDeplacement: {
    lire: (): Promise<ParametresDeplacement> => ipcRenderer.invoke('parametresDeplacement:lire'),
    enregistrer: (valeurs: ParametresDeplacement): Promise<ParametresDeplacement> =>
      ipcRenderer.invoke('parametresDeplacement:enregistrer', valeurs)
  },

  parametresImpression: {
    lire: (): Promise<ParametresImpressionDb> => ipcRenderer.invoke('parametresImpression:lire'),
    enregistrer: (valeurs: ParametresImpressionDb): Promise<ParametresImpressionDb> =>
      ipcRenderer.invoke('parametresImpression:enregistrer', valeurs)
  },

  chargesFixes: {
    lister: (): Promise<ChargeFixe[]> => ipcRenderer.invoke('chargesFixes:lister'),
    ajouter: (charge: Omit<ChargeFixe, 'id'>): Promise<ChargeFixe> =>
      ipcRenderer.invoke('chargesFixes:ajouter', charge),
    modifier: (charge: ChargeFixe): Promise<ChargeFixe> =>
      ipcRenderer.invoke('chargesFixes:modifier', charge),
    supprimer: (id: number): Promise<void> => ipcRenderer.invoke('chargesFixes:supprimer', id)
  },

  tarifsProduits: {
    lister: (): Promise<TarifProduit[]> => ipcRenderer.invoke('tarifsProduits:lister'),
    ajouter: (tarif: Omit<TarifProduit, 'id'>): Promise<TarifProduit> =>
      ipcRenderer.invoke('tarifsProduits:ajouter', tarif),
    modifier: (tarif: TarifProduit): Promise<TarifProduit> =>
      ipcRenderer.invoke('tarifsProduits:modifier', tarif),
    supprimer: (id: number): Promise<void> => ipcRenderer.invoke('tarifsProduits:supprimer', id)
  },

  tarifsMainOeuvre: {
    lister: (): Promise<TarifMainOeuvre[]> => ipcRenderer.invoke('tarifsMainOeuvre:lister'),
    ajouter: (tarif: Omit<TarifMainOeuvre, 'id'>): Promise<TarifMainOeuvre> =>
      ipcRenderer.invoke('tarifsMainOeuvre:ajouter', tarif),
    modifier: (tarif: TarifMainOeuvre): Promise<TarifMainOeuvre> =>
      ipcRenderer.invoke('tarifsMainOeuvre:modifier', tarif),
    supprimer: (id: number): Promise<void> => ipcRenderer.invoke('tarifsMainOeuvre:supprimer', id)
  },

  tarifsDeplacement: {
    lister: (): Promise<TarifDeplacement[]> => ipcRenderer.invoke('tarifsDeplacement:lister'),
    ajouter: (tarif: Omit<TarifDeplacement, 'id'>): Promise<TarifDeplacement> =>
      ipcRenderer.invoke('tarifsDeplacement:ajouter', tarif),
    modifier: (tarif: TarifDeplacement): Promise<TarifDeplacement> =>
      ipcRenderer.invoke('tarifsDeplacement:modifier', tarif),
    supprimer: (id: number): Promise<void> => ipcRenderer.invoke('tarifsDeplacement:supprimer', id)
  },

  categoriesJournal: {
    lister: (): Promise<CategorieJournal[]> => ipcRenderer.invoke('categoriesJournal:lister'),
    ajouter: (libelle: string): Promise<CategorieJournal> =>
      ipcRenderer.invoke('categoriesJournal:ajouter', libelle),
    renommer: (id: number, libelle: string): Promise<CategorieJournal> =>
      ipcRenderer.invoke('categoriesJournal:renommer', id, libelle),
    supprimer: (id: number): Promise<void> => ipcRenderer.invoke('categoriesJournal:supprimer', id)
  },

  parametresApp: {
    lire: (): Promise<ParametresApp> => ipcRenderer.invoke('parametresApp:lire'),
    enregistrer: (valeurs: ParametresApp): Promise<ParametresApp> =>
      ipcRenderer.invoke('parametresApp:enregistrer', valeurs),
    choisirDossierDocuments: (): Promise<string | null> =>
      ipcRenderer.invoke('parametresApp:choisirDossierDocuments'),
    reinitialiserDossierDocuments: (): Promise<string> =>
      ipcRenderer.invoke('parametresApp:reinitialiserDossierDocuments'),
    ouvrirDossier: (cible: 'documents' | 'donnees' | 'sauvegardes'): Promise<void> =>
      ipcRenderer.invoke('parametresApp:ouvrirDossier', cible),
    infosSysteme: (): Promise<InfosSysteme> => ipcRenderer.invoke('parametresApp:infosSysteme'),
    verifierIntegrite: (): Promise<string> => ipcRenderer.invoke('parametresApp:verifierIntegrite')
  },

  sauvegardes: {
    lister: (): Promise<SauvegardeFichier[]> => ipcRenderer.invoke('sauvegardes:lister'),
    creer: (): Promise<string> => ipcRenderer.invoke('sauvegardes:creer'),
    restaurer: (nomFichier: string): Promise<void> => ipcRenderer.invoke('sauvegardes:restaurer', nomFichier)
  },

  sauvegardeExterne: {
    choisirDossier: (): Promise<string | null> => ipcRenderer.invoke('sauvegardeExterne:choisirDossier'),
    lireDossier: (): Promise<string | null> => ipcRenderer.invoke('sauvegardeExterne:lireDossier'),
    sauvegarder: (motDePasse: string): Promise<string> =>
      ipcRenderer.invoke('sauvegardeExterne:sauvegarder', motDePasse),
    restaurer: (motDePasse: string): Promise<string | null> =>
      ipcRenderer.invoke('sauvegardeExterne:restaurer', motDePasse)
  },

  donnees: {
    exporterTout: (): Promise<string | null> => ipcRenderer.invoke('donnees:exporterTout')
  },

  journal: {
    lister: (filtres?: FiltresJournal): Promise<EcritureJournal[]> =>
      ipcRenderer.invoke('journal:lister', filtres),
    ajouter: (
      valeurs: Omit<EcritureJournal, 'id' | 'annee' | 'categorieLibelle' | 'montantTva'>
    ): Promise<EcritureJournal> => ipcRenderer.invoke('journal:ajouter', valeurs),
    modifier: (
      valeurs: Omit<EcritureJournal, 'annee' | 'categorieLibelle' | 'montantTva'>
    ): Promise<EcritureJournal> => ipcRenderer.invoke('journal:modifier', valeurs),
    supprimer: (id: number): Promise<void> => ipcRenderer.invoke('journal:supprimer', id),
    repartitionParCategorie: (filtres?: FiltresJournal): Promise<RepartitionCategorie[]> =>
      ipcRenderer.invoke('journal:repartitionParCategorie', filtres),
    evolutionAnnuelle: (): Promise<EvolutionAnnuelle[]> => ipcRenderer.invoke('journal:evolutionAnnuelle')
  },

  clients: {
    lister: (): Promise<Client[]> => ipcRenderer.invoke('clients:lister'),
    ajouter: (client: Omit<Client, 'id'>): Promise<Client> => ipcRenderer.invoke('clients:ajouter', client),
    modifier: (client: Client): Promise<Client> => ipcRenderer.invoke('clients:modifier', client),
    supprimer: (id: number): Promise<void> => ipcRenderer.invoke('clients:supprimer', id),
    obtenirDetail: (id: number): Promise<ClientDetail> => ipcRenderer.invoke('clients:obtenirDetail', id)
  },

  factures: {
    prochainNumero: (): Promise<string> => ipcRenderer.invoke('factures:prochainNumero'),
    creerBrouillon: (clientId: number): Promise<FactureDetail> =>
      ipcRenderer.invoke('factures:creerBrouillon', clientId),
    obtenirDetail: (id: number): Promise<FactureDetail> => ipcRenderer.invoke('factures:obtenirDetail', id),
    dupliquer: (id: number): Promise<FactureDetail> => ipcRenderer.invoke('factures:dupliquer', id),
    creerDepuisDevis: (devisId: number): Promise<FactureDetail> =>
      ipcRenderer.invoke('factures:creerDepuisDevis', devisId),
    enregistrer: (detail: FactureDetail): Promise<FactureDetail> =>
      ipcRenderer.invoke('factures:enregistrer', detail),
    supprimer: (id: number): Promise<void> => ipcRenderer.invoke('factures:supprimer', id),
    changerStatut: (id: number, statut: Facture['statut']): Promise<void> =>
      ipcRenderer.invoke('factures:changerStatut', id, statut),
    historique: (): Promise<HistoriqueFacture[]> => ipcRenderer.invoke('factures:historique'),
    confirmerEnregistrementHistorique: (
      id: number
    ): Promise<{ dejaEnregistreeDansJournal: boolean; avertissements: string[]; total: number }> =>
      ipcRenderer.invoke('factures:confirmerEnregistrementHistorique', id)
  },

  devis: {
    prochainNumero: (): Promise<string> => ipcRenderer.invoke('devis:prochainNumero'),
    creerBrouillon: (clientId: number): Promise<DevisDetail> =>
      ipcRenderer.invoke('devis:creerBrouillon', clientId),
    obtenirDetail: (id: number): Promise<DevisDetail> => ipcRenderer.invoke('devis:obtenirDetail', id),
    dupliquer: (id: number): Promise<DevisDetail> => ipcRenderer.invoke('devis:dupliquer', id),
    enregistrer: (detail: DevisDetail): Promise<DevisDetail> => ipcRenderer.invoke('devis:enregistrer', detail),
    supprimer: (id: number): Promise<void> => ipcRenderer.invoke('devis:supprimer', id),
    changerStatut: (id: number, statut: StatutDevis): Promise<void> =>
      ipcRenderer.invoke('devis:changerStatut', id, statut),
    historique: (): Promise<HistoriqueDevis[]> => ipcRenderer.invoke('devis:historique')
  },

  inventaire: {
    lister: (): Promise<ArticleInventaire[]> => ipcRenderer.invoke('inventaire:lister'),
    referenceSuggeree: (): Promise<string> => ipcRenderer.invoke('inventaire:referenceSuggeree'),
    ajouter: (article: ArticleInventaire): Promise<ArticleInventaire> =>
      ipcRenderer.invoke('inventaire:ajouter', article),
    modifier: (referenceOrigine: string, article: ArticleInventaire): Promise<ArticleInventaire> =>
      ipcRenderer.invoke('inventaire:modifier', referenceOrigine, article),
    supprimer: (reference: string): Promise<void> => ipcRenderer.invoke('inventaire:supprimer', reference),
    resume: (): Promise<ResumeInventaire> => ipcRenderer.invoke('inventaire:resume')
  },

  resume: {
    parAnnee: (): Promise<ResumeAnnuel[]> => ipcRenderer.invoke('resume:parAnnee'),
    lireObjectif: (annee: number): Promise<number> => ipcRenderer.invoke('objectifAnnuel:lire', annee),
    enregistrerObjectif: (annee: number, objectifCa: number): Promise<number> =>
      ipcRenderer.invoke('objectifAnnuel:enregistrer', annee, objectifCa)
  },

  conditions: {
    etat: (): Promise<EtatConditions> => ipcRenderer.invoke('conditions:etat'),
    accepter: (): Promise<string> => ipcRenderer.invoke('conditions:accepter'),
    ouvrirPage: (): Promise<void> => ipcRenderer.invoke('conditions:ouvrirPage'),
    url: (): Promise<string> => ipcRenderer.invoke('conditions:url')
  },

  conformite: {
    verifier: (): Promise<PointConformite[]> => ipcRenderer.invoke('conformite:verifier')
  },

  maj: {
    etat: (): Promise<EtatMaj> => ipcRenderer.invoke('maj:etat'),
    lireConfiguration: (): Promise<ConfigurationMaj> => ipcRenderer.invoke('maj:lireConfiguration'),
    enregistrerConfiguration: (config: ConfigurationMaj): Promise<ConfigurationMaj> =>
      ipcRenderer.invoke('maj:enregistrerConfiguration', config),
    verifier: (): Promise<EtatMaj> => ipcRenderer.invoke('maj:verifier'),
    telecharger: (): Promise<EtatMaj> => ipcRenderer.invoke('maj:telecharger'),
    installer: (): Promise<void> => ipcRenderer.invoke('maj:installer'),
    /** S'abonne aux changements d'état. Retourne la fonction de désabonnement. */
    surChangement: (rappel: (etat: EtatMaj) => void): (() => void) => {
      const ecouteur = (_evenement: unknown, etat: EtatMaj): void => rappel(etat)
      ipcRenderer.on('maj:etat', ecouteur)
      return () => ipcRenderer.removeListener('maj:etat', ecouteur)
    }
  },

  recherche: {
    globale: (terme: string): Promise<ResultatRecherche[]> =>
      ipcRenderer.invoke('recherche:globale', terme)
  },

  audit: {
    lister: (limite?: number): Promise<EntreeAudit[]> => ipcRenderer.invoke('audit:lister', limite),
    vider: (): Promise<void> => ipcRenderer.invoke('audit:vider')
  },

  exercices: {
    lister: (): Promise<ExerciceCloture[]> => ipcRenderer.invoke('exercices:lister'),
    cloturer: (annee: number): Promise<number> => ipcRenderer.invoke('exercices:cloturer', annee),
    reouvrir: (annee: number): Promise<void> => ipcRenderer.invoke('exercices:reouvrir', annee)
  },

  comptabilite: {
    exporterCsv: (annee: number | null): Promise<string | null> =>
      ipcRenderer.invoke('comptabilite:exporterCsv', annee),
    choisirReleve: (): Promise<ResultatImport | null> => ipcRenderer.invoke('comptabilite:choisirReleve'),
    importerMouvements: (
      mouvements: MouvementBancaire[],
      categorieEntreeId: number | null,
      categorieDepenseId: number | null
    ): Promise<number> =>
      ipcRenderer.invoke('comptabilite:importerMouvements', mouvements, categorieEntreeId, categorieDepenseId)
  },

  justificatifs: {
    lister: (journalId: number): Promise<Justificatif[]> =>
      ipcRenderer.invoke('justificatifs:lister', journalId),
    compterParEcriture: (): Promise<Record<number, number>> =>
      ipcRenderer.invoke('justificatifs:compterParEcriture'),
    ajouter: (journalId: number): Promise<Justificatif[]> =>
      ipcRenderer.invoke('justificatifs:ajouter', journalId),
    lireDataUrl: (nomFichier: string): Promise<string | null> =>
      ipcRenderer.invoke('justificatifs:lireDataUrl', nomFichier),
    ouvrir: (nomFichier: string): Promise<void> => ipcRenderer.invoke('justificatifs:ouvrir', nomFichier),
    supprimer: (id: number): Promise<void> => ipcRenderer.invoke('justificatifs:supprimer', id)
  },

  suiviTemps: {
    lister: (): Promise<Intervention[]> => ipcRenderer.invoke('suiviTemps:lister'),
    enCours: (): Promise<Intervention | null> => ipcRenderer.invoke('suiviTemps:enCours'),
    demarrer: (description: string, clientId: number | null): Promise<Intervention> =>
      ipcRenderer.invoke('suiviTemps:demarrer', description, clientId),
    arreter: (id: number): Promise<Intervention> => ipcRenderer.invoke('suiviTemps:arreter', id),
    modifier: (intervention: Intervention): Promise<Intervention> =>
      ipcRenderer.invoke('suiviTemps:modifier', intervention),
    supprimer: (id: number): Promise<void> => ipcRenderer.invoke('suiviTemps:supprimer', id),
    facturer: (ids: number[], factureId: number, tauxHoraireParDefaut: number): Promise<number> =>
      ipcRenderer.invoke('suiviTemps:facturer', ids, factureId, tauxHoraireParDefaut)
  },

  tableauDeBord: {
    charger: (): Promise<TableauDeBord> => ipcRenderer.invoke('tableauDeBord:charger')
  },

  modeles: {
    lister: (): Promise<ModelePrestation[]> => ipcRenderer.invoke('modeles:lister'),
    creer: (nom: string): Promise<ModelePrestation> => ipcRenderer.invoke('modeles:creer', nom),
    enregistrer: (modele: ModelePrestation): Promise<ModelePrestation> =>
      ipcRenderer.invoke('modeles:enregistrer', modele),
    supprimer: (id: number): Promise<void> => ipcRenderer.invoke('modeles:supprimer', id),
    creerDepuisFacture: (factureId: number, nom: string): Promise<ModelePrestation> =>
      ipcRenderer.invoke('modeles:creerDepuisFacture', factureId, nom)
  },

  rappels: {
    lister: (factureId: number): Promise<Rappel[]> => ipcRenderer.invoke('rappels:lister', factureId),
    prochainNiveau: (factureId: number): Promise<{ niveau: number; fraisSuggeres: number }> =>
      ipcRenderer.invoke('rappels:prochainNiveau', factureId),
    creer: (factureId: number, niveau: number, frais: number): Promise<Rappel> =>
      ipcRenderer.invoke('rappels:creer', factureId, niveau, frais),
    supprimer: (id: number): Promise<void> => ipcRenderer.invoke('rappels:supprimer', id)
  },

  pdf: {
    obtenirDonnees: (
      type: 'facture' | 'devis' | 'rappel',
      id: number,
      rappelId?: number
    ): Promise<DocumentImpression> => ipcRenderer.invoke('pdf:donnees', type, id, rappelId),
    generer: (type: 'facture' | 'devis' | 'rappel', id: number, rappelId?: number): Promise<string> =>
      ipcRenderer.invoke('pdf:generer', type, id, rappelId),
    signalerPret: (): void => {
      ipcRenderer.send('pdf:pret')
    }
  },

  /**
   * Mode multi-postes. Les canaux métier ne changent pas de nom selon le
   * mode : l'interface n'a que ces réglages-ci à connaître.
   */
  multipostes: {
    etat: (): Promise<EtatMultipostes> => ipcRenderer.invoke('multipostes:etat'),
    tester: (adresse: string): Promise<{ installe: boolean }> =>
      ipcRenderer.invoke('multipostes:tester', adresse),
    definirMode: (mode: 'local' | 'serveur', adresse: string): Promise<EtatMultipostes> =>
      ipcRenderer.invoke('multipostes:definirMode', mode, adresse),
    connecter: (identifiant: string, motDePasse: string): Promise<SessionMultipostes> =>
      ipcRenderer.invoke('multipostes:connecter', identifiant, motDePasse),
    creerPremierAdministrateur: (
      identifiant: string,
      motDePasse: string,
      nomAffiche: string
    ): Promise<SessionMultipostes> =>
      ipcRenderer.invoke('multipostes:creerPremierAdministrateur', identifiant, motDePasse, nomAffiche),
    deconnecter: (): Promise<EtatMultipostes> => ipcRenderer.invoke('multipostes:deconnecter'),
    /** Prévenu quand le serveur a refusé le jeton : il faut se reconnecter. */
    surSessionPerdue: (rappel: () => void): (() => void) => {
      const ecouteur = (): void => rappel()
      ipcRenderer.on('multipostes:sessionPerdue', ecouteur)
      return () => ipcRenderer.removeListener('multipostes:sessionPerdue', ecouteur)
    }
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
