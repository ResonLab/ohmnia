/**
 * Traductions de l'application.
 *
 * Fonctionnement : `t('cle')` renvoie le texte dans la langue courante.
 * Si une clé manque en anglais, le texte français est utilisé — l'interface
 * reste donc toujours lisible, même pendant une traduction partielle.
 *
 * Pour ajouter une chaîne : l'ajouter dans TEXTES avec ses deux versions,
 * puis remplacer le texte en dur par `t('ma.cle')` dans le composant.
 */

import { ordinalAnglais, ordinalFrancais } from './calculs'

export type Langue = 'fr' | 'en'

type Traduction = { fr: string; en: string }

const TEXTES = {
  // --- Navigation ---
  'menu.accueil': { fr: 'Accueil', en: 'Home' },
  'menu.ajoutRapide': { fr: 'Ajout rapide', en: 'Quick add' },
  'menu.clients': { fr: 'Clients', en: 'Clients' },
  'menu.facturation': { fr: 'Facturation', en: 'Invoicing' },
  'menu.devis': { fr: 'Devis', en: 'Quotes' },
  'menu.suiviTemps': { fr: 'Suivi du temps', en: 'Time tracking' },
  'menu.journal': { fr: 'Journal', en: 'Ledger' },
  'menu.inventaire': { fr: 'Inventaire', en: 'Inventory' },
  'menu.modeles': { fr: 'Modèles', en: 'Templates' },
  'menu.tarifs': { fr: 'Tarifs & Marge', en: 'Rates & Margin' },
  'menu.charges': { fr: 'Charges & Marge', en: 'Costs & Margin' },
  'menu.resume': { fr: 'Résumé annuel', en: 'Yearly summary' },
  'menu.comptabilite': { fr: 'Import / Export', en: 'Import / Export' },
  'menu.audit': { fr: 'Audit & clôtures', en: 'Audit & closing' },
  'menu.parametres': { fr: 'Mon entreprise', en: 'My company' },
  'menu.parametresApp': { fr: "Paramètres de l'app", en: 'App settings' },
  'menu.rechercher': { fr: 'pour rechercher', en: 'to search' },
  'menu.deconnecter': { fr: 'Se déconnecter', en: 'Sign out' },
  'menu.deconnecterConfirme': {
    fr: 'Fermer la session sur ce poste ? Les données restent sur le serveur.',
    en: 'Close the session on this workstation? The data stays on the server.'
  },
  'menu.sousTitre': { fr: 'Gestion', en: 'Management' },

  // --- Actions communes ---
  'etat.chargement': { fr: 'Chargement…', en: 'Loading…' },

  // --- Documents imprimés (facture, devis, rappel) ---
  'doc.facture': { fr: 'Facture', en: 'Invoice' },
  'doc.devis': { fr: 'Devis', en: 'Quote' },
  'doc.rappel': { fr: 'Rappel de paiement', en: 'Payment reminder' },
  'doc.client': { fr: 'Client', en: 'Client' },
  'doc.numero': { fr: 'N°', en: 'No.' },
  'doc.date': { fr: 'Date', en: 'Date' },
  'doc.echeance': { fr: 'Échéance', en: 'Due date' },
  'doc.valableJusquau': { fr: "Valable jusqu'au", en: 'Valid until' },
  'doc.factureEchueLe': { fr: 'Facture échue le', en: 'Invoice was due on' },
  'doc.designation': { fr: 'Désignation', en: 'Description' },
  'doc.quantite': { fr: 'Qté', en: 'Qty' },
  'doc.prixUnitaire': { fr: 'Prix unitaire', en: 'Unit price' },
  'doc.total': { fr: 'Total', en: 'Total' },
  'doc.sousTotal': { fr: 'Sous-total', en: 'Subtotal' },
  'doc.remise': { fr: 'Remise', en: 'Discount' },
  'doc.totalAPayer': { fr: 'TOTAL À PAYER', en: 'TOTAL DUE' },
  'doc.totalDevis': { fr: 'TOTAL DEVIS', en: 'QUOTE TOTAL' },
  'doc.montantTotalDu': { fr: 'MONTANT TOTAL DÛ', en: 'TOTAL AMOUNT DUE' },
  'doc.titulaire': { fr: 'Titulaire', en: 'Account holder' },
  'doc.conditionsGenerales': { fr: 'Conditions générales', en: 'Terms and conditions' },
  'doc.codeVerification': { fr: 'Code de vérification', en: 'Verification code' },
  'doc.rappelTexte1': {
    fr: 'Sauf erreur de notre part, la facture ci-dessous demeure impayée',
    en: 'Unless we are mistaken, the invoice below remains unpaid'
  },
  'doc.rappelDepuis': { fr: 'depuis', en: 'for' },
  'doc.rappelJours': { fr: 'jour(s)', en: 'day(s)' },
  'doc.rappelTexte2': {
    fr: 'Nous vous prions de bien vouloir procéder au règlement du montant total dû dans les meilleurs délais.',
    en: 'We kindly ask you to settle the total amount due as soon as possible.'
  },
  'doc.rappelTexte3': {
    fr: 'Si le paiement a été effectué entre-temps, merci de considérer ce courrier sans objet.',
    en: 'If payment has been made in the meantime, please disregard this letter.'
  },
  'doc.rappelNiveau': { fr: 'rappel', en: 'reminder' },

  // --- Accueil (tableau de bord) ---
  'accueil.ceMois': { fr: 'Ce mois', en: 'This month' },
  'accueil.entrees': { fr: 'Entrées', en: 'Income' },
  'accueil.depenses': { fr: 'Dépenses', en: 'Expenses' },
  'accueil.benefice': { fr: 'Bénéfice', en: 'Profit' },
  'accueil.valeurStock': { fr: 'Valeur du stock', en: 'Stock value' },
  'accueil.objectifAnnuel': { fr: 'Objectif annuel', en: 'Yearly target' },
  'accueil.objectifProgression': {
    fr: '{fait} réalisés sur {objectif} —',
    en: '{fait} of {objectif} —'
  },
  'accueil.objectifAbsent': {
    fr: "Aucun objectif défini pour cette année. Tu peux le saisir dans « Résumé annuel ».",
    en: 'No target set for this year. You can enter one under “Yearly summary”.'
  },
  'accueil.aSuivre': { fr: 'À suivre', en: 'To watch' },
  'accueil.facturesEnAttente': { fr: 'Factures en attente', en: 'Invoices outstanding' },
  'accueil.facturesEnRetard': { fr: 'Factures en retard', en: 'Invoices overdue' },
  'accueil.devisEnAttente': { fr: 'Devis en attente', en: 'Quotes pending' },
  'accueil.articlesSousSeuil': { fr: 'Articles sous le seuil', en: 'Items below threshold' },
  'accueil.prochainesEcheances': { fr: 'Prochaines échéances', en: 'Upcoming due dates' },
  'accueil.aucuneEcheance': {
    fr: 'Aucune facture en attente de paiement.',
    en: 'No invoice awaiting payment.'
  },
  'accueil.delai': { fr: 'Délai', en: 'Due in' },
  'accueil.enRetardDe': { fr: 'En retard de {jours} j', en: '{jours} d overdue' },
  'accueil.dansJours': { fr: 'Dans {jours} j', en: 'In {jours} d' },
  'accueil.stockAReapprovisionner': {
    fr: 'Stock à réapprovisionner',
    en: 'Stock to reorder'
  },
  'accueil.enStock': { fr: 'En stock', en: 'In stock' },
  'accueil.seuil': { fr: 'Seuil', en: 'Threshold' },

  // --- Colonnes communes aux tableaux ---
  'colonne.facture': { fr: 'Facture', en: 'Invoice' },
  'colonne.client': { fr: 'Client', en: 'Client' },
  'colonne.echeance': { fr: 'Échéance', en: 'Due date' },
  'colonne.montant': { fr: 'Montant', en: 'Amount' },
  'colonne.reference': { fr: 'Référence', en: 'Reference' },
  'colonne.designation': { fr: 'Désignation', en: 'Description' },

  // --- Actions communes ---
  'action.enregistrer': { fr: 'Enregistrer', en: 'Save' },
  'action.annuler': { fr: 'Annuler', en: 'Cancel' },
  'action.supprimer': { fr: 'Supprimer', en: 'Delete' },

  // --- Clients ---
  'client.titre': { fr: 'Clients', en: 'Clients' },
  'client.rechercher': { fr: 'Rechercher un client…', en: 'Search for a client…' },
  'client.aucunTrouve': { fr: 'Aucun client trouvé.', en: 'No client found.' },
  'client.nouveau': { fr: '+ Nouveau client', en: '+ New client' },
  'client.titreNouveau': { fr: 'Nouveau client', en: 'New client' },
  'client.fiche': { fr: 'Fiche client', en: 'Client record' },
  'client.nom': { fr: 'Nom', en: 'Name' },
  'client.adresse': { fr: 'Adresse', en: 'Address' },
  'client.email': { fr: 'Email', en: 'Email' },
  'client.telephone': { fr: 'Téléphone', en: 'Phone' },
  'client.creer': { fr: 'Créer', en: 'Create' },
  'client.confirmerSuppression': {
    fr: 'Supprimer définitivement ce client ?',
    en: 'Permanently delete this client?'
  },
  'client.chiffres': { fr: 'Chiffres du client', en: 'Client figures' },
  'client.totalFacture': { fr: 'Total facturé', en: 'Total invoiced' },
  'client.enAttentePaiement': { fr: 'En attente de paiement', en: 'Awaiting payment' },
  'client.factures': { fr: 'Factures', en: 'Invoices' },
  'client.devis': { fr: 'Devis', en: 'Quotes' },
  'client.facturesDuClient': { fr: 'Factures de ce client', en: 'This client’s invoices' },
  'client.aucuneFacture': { fr: 'Aucune facture pour ce client.', en: 'No invoice for this client.' },
  'client.devisDuClient': { fr: 'Devis de ce client', en: 'This client’s quotes' },
  'client.aucunDevis': { fr: 'Aucun devis pour ce client.', en: 'No quote for this client.' },
  'client.enAttenteDepuis': {
    fr: 'En attente depuis {jours} jours',
    en: 'Awaiting payment for {jours} days'
  },
  'client.misAJour': { fr: 'Client mis à jour.', en: 'Client updated.' },
  'client.cree': { fr: 'Client créé.', en: 'Client created.' },
  'client.supprime': { fr: 'Client supprimé.', en: 'Client deleted.' },
  'client.riendSelectionne': {
    fr: 'Sélectionne un client à gauche pour voir sa fiche et ses factures.',
    en: 'Select a client on the left to see their record and invoices.'
  },

  // --- Colonnes de tableaux, suite ---
  'colonne.numero': { fr: 'Numéro', en: 'Number' },
  'colonne.date': { fr: 'Date', en: 'Date' },
  'colonne.statut': { fr: 'Statut', en: 'Status' },
  'colonne.total': { fr: 'Total', en: 'Total' },

  // --- Inventaire ---
  'inventaire.titre': { fr: 'Inventaire', en: 'Inventory' },
  'inventaire.resume': { fr: 'Résumé du stock', en: 'Stock summary' },
  'inventaire.valeurTotale': {
    fr: "Valeur totale du stock (au prix d'achat) :",
    en: 'Total stock value (at purchase price):'
  },
  'inventaire.sousSeuil': {
    fr: "Références sous le seuil d'alerte :",
    en: 'References below the alert threshold:'
  },
  'inventaire.categorie': { fr: 'Catégorie', en: 'Category' },
  'inventaire.stock': { fr: 'Stock', en: 'Stock' },
  'inventaire.seuil': { fr: 'Seuil', en: 'Threshold' },
  'inventaire.seuilAlerte': { fr: "Seuil d'alerte", en: 'Alert threshold' },
  'inventaire.prixAchat': { fr: 'Prix achat', en: 'Purchase price' },
  'inventaire.prixVente': { fr: 'Prix vente', en: 'Selling price' },
  'inventaire.fournisseur': { fr: 'Fournisseur', en: 'Supplier' },
  'inventaire.emplacement': { fr: 'Emplacement', en: 'Location' },
  'inventaire.derniereMaj': { fr: 'Dernière MAJ', en: 'Last update' },
  'inventaire.ajouterArticle': { fr: '+ Ajouter un article', en: '+ Add an item' },
  // Les libellés des catégories. La valeur enregistrée en base, elle, ne change
  // jamais — voir `src/shared/inventaire.ts`.
  'inventaire.catComposants': { fr: 'Composants', en: 'Components' },
  'inventaire.catCables': { fr: 'Câbles/Connectique', en: 'Cables/Connectors' },
  'inventaire.catOutillage': { fr: 'Outillage', en: 'Tooling' },
  'inventaire.catConsommables': { fr: 'Consommables', en: 'Consumables' },
  'inventaire.catAppareils': { fr: 'Appareils', en: 'Devices' },
  'inventaire.catDivers': { fr: 'Divers', en: 'Miscellaneous' },
  'inventaire.confirmerSuppression': {
    fr: "Supprimer la référence {reference} de l'inventaire ?",
    en: 'Remove reference {reference} from the inventory?'
  },

  // --- Résumé annuel ---
  'resume.objectifTitre': {
    fr: "Objectif de chiffre d'affaires",
    en: 'Revenue target'
  },
  'resume.annee': { fr: 'Année', en: 'Year' },
  'resume.objectifAnnuel': { fr: 'Objectif CA annuel ({devise})', en: 'Yearly revenue target ({devise})' },
  'resume.enregistrerObjectif': { fr: "Enregistrer l'objectif", en: 'Save target' },
  'resume.objectifEnregistre': { fr: 'Objectif enregistré.', en: 'Target saved.' },
  'resume.progression': {
    fr: '{fait} réalisés sur {objectif} —',
    en: '{fait} of {objectif} —'
  },
  'resume.saisirObjectif': {
    fr: ' (saisissez un objectif pour voir la progression)',
    en: ' (enter a target to see progress)'
  },
  'resume.parAnnee': { fr: 'Résumé par année', en: 'Summary by year' },
  'resume.aucunMouvement': {
    fr: "Aucun mouvement enregistré dans le Journal pour l'instant.",
    en: 'No entry recorded in the Ledger yet.'
  },
  'resume.entrees': { fr: 'Entrées', en: 'Income' },
  'resume.depenses': { fr: 'Dépenses', en: 'Expenses' },
  'resume.beneficeNet': { fr: 'Bénéfice net', en: 'Net profit' },
  'resume.tvaCollectee': { fr: 'TVA collectée', en: 'Tax collected' },
  'resume.tvaDeductible': { fr: 'TVA déductible', en: 'Tax deductible' },
  'resume.tvaNette': { fr: 'TVA nette', en: 'Net tax' },
  'resume.aPayer': { fr: '(à payer)', en: '(payable)' },
  'resume.aRecuperer': { fr: '(à récupérer)', en: '(refundable)' },

  // --- Import / Export comptable ---
  'compta.exportTitre': { fr: 'Export comptable', en: 'Accounting export' },
  'compta.exportAide': {
    fr: 'Fichier CSV (séparateur point-virgule, UTF-8) avec le détail HT / TVA de chaque écriture — format lisible par Excel et par la plupart des logiciels de fiduciaire.',
    en: 'CSV file (semicolon separator, UTF-8) with the net / tax breakdown of each entry — readable by Excel and by most accountancy software.'
  },
  'compta.periode': { fr: 'Période', en: 'Period' },
  'compta.toutesAnnees': { fr: 'Toutes les années', en: 'All years' },
  'compta.exporterCsv': { fr: 'Exporter en CSV', en: 'Export to CSV' },
  'compta.exportTermine': { fr: 'Export terminé : {chemin}', en: 'Export finished: {chemin}' },
  'compta.importTitre': { fr: 'Import de relevé bancaire', en: 'Bank statement import' },
  'compta.importAide': {
    fr: "Formats acceptés : CSV exporté depuis l'e-banking, ou CAMT.053 (XML, standard suisse). Les mouvements déjà présents dans le Journal (même date et même montant) sont repérés et décochés automatiquement pour éviter les doublons.",
    en: 'Accepted formats: CSV exported from e-banking, or CAMT.053 (XML, Swiss standard). Movements already in the Ledger (same date and same amount) are spotted and unticked automatically to avoid duplicates.'
  },
  'compta.categorieEntrees': { fr: 'Catégorie des entrées', en: 'Category for income' },
  'compta.categorieDepenses': { fr: 'Catégorie des dépenses', en: 'Category for expenses' },
  'compta.choisirReleve': { fr: 'Choisir un relevé…', en: 'Choose a statement…' },
  'compta.resumeLecture': {
    fr: '{lus} mouvement(s) lus · {choisis} sélectionné(s) pour',
    en: '{lus} movement(s) read · {choisis} selected for'
  },
  'compta.format': { fr: 'format', en: 'format' },
  'compta.libelle': { fr: 'Libellé', en: 'Description' },
  'compta.etat': { fr: 'État', en: 'Status' },
  'compta.dejaAuJournal': { fr: 'Déjà au Journal', en: 'Already in Ledger' },
  'compta.nouveau': { fr: 'Nouveau', en: 'New' },
  'compta.importerSelection': {
    fr: 'Importer la sélection ({nombre})',
    en: 'Import selection ({nombre})'
  },
  'compta.abandonner': { fr: 'Abandonner', en: 'Discard' },
  'compta.aucunSelectionne': {
    fr: 'Aucun mouvement sélectionné.',
    en: 'No movement selected.'
  },
  'compta.ecrituresAjoutees': {
    fr: '{nombre} écriture(s) ajoutée(s) au Journal.',
    en: '{nombre} entry/entries added to the Ledger.'
  },

  // --- Modèles de prestations ---
  'modele.titre': { fr: 'Modèles', en: 'Templates' },
  'modele.aucun': { fr: "Aucun modèle pour l'instant.", en: 'No template yet.' },
  'modele.nouveau': { fr: 'Nouveau modèle', en: 'New template' },
  'modele.exemple': { fr: 'ex. Diagnostic standard', en: 'e.g. Standard diagnostic' },
  'modele.creer': { fr: 'Créer', en: 'Create' },
  'modele.cree': {
    fr: 'Modèle créé. Ajoute ses lignes puis enregistre.',
    en: 'Template created. Add its lines then save.'
  },
  'modele.enregistre': { fr: 'Modèle enregistré.', en: 'Template saved.' },
  'modele.supprime': { fr: 'Modèle supprimé.', en: 'Template deleted.' },
  'modele.confirmerSuppression': {
    fr: 'Supprimer définitivement ce modèle ?',
    en: 'Permanently delete this template?'
  },
  'modele.entete': { fr: 'Modèle « {nom} »', en: 'Template “{nom}”' },
  'modele.nom': { fr: 'Nom', en: 'Name' },
  'modele.lignes': { fr: '{nombre} ligne(s) ·', en: '{nombre} line(s) ·' },
  'modele.refInventaire': { fr: 'Réf. inventaire', en: 'Inventory ref.' },
  'modele.optionnel': { fr: 'optionnel', en: 'optional' },
  'modele.retirer': { fr: 'Retirer', en: 'Remove' },
  'modele.ajouterLigne': { fr: '+ Ajouter une ligne', en: '+ Add a line' },
  'modele.total': { fr: 'Total du modèle :', en: 'Template total:' },
  'modele.horsRemise': { fr: '(hors remise et TVA)', en: '(before discount and tax)' },
  'modele.supprimerModele': { fr: 'Supprimer le modèle', en: 'Delete template' },
  'modele.aide': {
    fr: 'Un modèle est un panier de lignes réutilisable : sélectionne-en un à gauche, ou crée-en un nouveau. Tu peux aussi en créer directement depuis une facture existante.',
    en: 'A template is a reusable basket of lines: pick one on the left, or create a new one. You can also create one directly from an existing invoice.'
  },

  // --- Audit et clôtures d'exercice ---
  'audit.conformiteTitre': { fr: 'Conformité de la facturation', en: 'Invoicing compliance' },
  'audit.conformiteAide': {
    fr: 'Contrôles automatiques des mentions et de la numérotation.',
    en: 'Automatic checks of the required statements and of the numbering.'
  },
  'audit.conformiteReserve': {
    fr: "Cette liste ne certifie rien et ne remplace pas l'avis de votre fiduciaire.",
    en: 'This list certifies nothing and does not replace the advice of your accountant.'
  },
  'audit.exercicesTitre': { fr: 'Exercices comptables', en: 'Accounting years' },
  'audit.exercicesAide': {
    fr: "Clôturer une année la verrouille : plus aucune écriture du Journal ne peut y être ajoutée, modifiée ou supprimée. Utile une fois la déclaration faite, pour éviter toute modification accidentelle d'un exercice passé.",
    en: 'Closing a year locks it: no Ledger entry can be added to it, changed or deleted. Useful once the return is filed, to prevent any accidental change to a past year.'
  },
  'audit.anneeACloturer': { fr: 'Année à clôturer', en: 'Year to close' },
  'audit.choisir': { fr: '— Choisir —', en: '— Choose —' },
  'audit.cloturerExercice': { fr: "Clôturer l'exercice", en: 'Close the year' },
  'audit.choisirAnnee': {
    fr: 'Choisis une année à clôturer.',
    en: 'Choose a year to close.'
  },
  'audit.confirmerCloture': {
    fr: "Clôturer l'exercice {annee} ?\n\nPlus aucune écriture de cette année ne pourra être ajoutée, modifiée ou supprimée. Tu pourras rouvrir l'exercice si nécessaire.",
    en: 'Close the {annee} accounting year?\n\nNo entry for that year can be added, changed or deleted any more. You will be able to reopen the year if needed.'
  },
  'audit.exerciceCloture': {
    fr: 'Exercice {annee} clôturé : {nombre} écriture(s) verrouillée(s).',
    en: 'Year {annee} closed: {nombre} entry/entries locked.'
  },
  'audit.confirmerReouverture': {
    fr: "Rouvrir l'exercice {annee} ? Les écritures redeviendront modifiables.",
    en: 'Reopen the {annee} year? Its entries will become editable again.'
  },
  'audit.exerciceRouvert': { fr: 'Exercice {annee} rouvert.', en: 'Year {annee} reopened.' },
  'audit.clotureeLe': { fr: 'Clôturée le', en: 'Closed on' },
  'audit.rouvrir': { fr: 'Rouvrir', en: 'Reopen' },
  'audit.journalTitre': { fr: "Journal d'audit", en: 'Audit log' },
  'audit.journalAide': {
    fr: 'Trace des opérations sensibles : créations, duplications, conversions, suppressions, rappels, imports/exports et clôtures. {nombre} entrée(s) affichée(s).',
    en: 'A trace of sensitive operations: creations, duplications, conversions, deletions, reminders, imports/exports and closings. {nombre} entry/entries shown.'
  },
  'audit.aucuneOperation': {
    fr: "Aucune opération enregistrée pour l'instant.",
    en: 'No operation recorded yet.'
  },
  'audit.dateEtHeure': { fr: 'Date et heure', en: 'Date and time' },
  'audit.action': { fr: 'Action', en: 'Action' },
  'audit.objet': { fr: 'Objet', en: 'Object' },
  'audit.details': { fr: 'Détails', en: 'Details' },
  'audit.viderJournal': { fr: "Vider le journal d'audit", en: 'Clear the audit log' },
  'audit.confirmerVidage': {
    fr: "Vider le journal d'audit ?\n\nL'historique des modifications sera perdu (la purge elle-même reste tracée).",
    en: 'Clear the audit log?\n\nThe history of changes will be lost (the purge itself stays recorded).'
  },
  'audit.journalVide': { fr: "Journal d'audit vidé.", en: 'Audit log cleared.' },
  // Les libellés des actions tracées. La valeur enregistrée en base est la clé
  // technique (`creation`, `cloture`…) : elle ne change jamais.
  'audit.actionCreation': { fr: 'Création', en: 'Creation' },
  'audit.actionDuplication': { fr: 'Duplication', en: 'Duplication' },
  'audit.actionConversion': { fr: 'Conversion', en: 'Conversion' },
  'audit.actionSuppression': { fr: 'Suppression', en: 'Deletion' },
  'audit.actionRappel': { fr: 'Rappel de paiement', en: 'Payment reminder' },
  'audit.actionExport': { fr: 'Export', en: 'Export' },
  'audit.actionImport': { fr: 'Import', en: 'Import' },
  'audit.actionAjout': { fr: 'Ajout', en: 'Addition' },
  'audit.actionCloture': { fr: "Clôture d'exercice", en: 'Year closing' },
  'audit.actionReouverture': { fr: "Réouverture d'exercice", en: 'Year reopening' },
  'audit.actionPurge': { fr: 'Purge', en: 'Purge' },
  'audit.actionFacturationTemps': { fr: 'Facturation du temps', en: 'Time invoicing' },

  // --- Tarifs & Marge ---
  'tarif.produitsTitre': { fr: 'Produits & prestations', en: 'Products & services' },
  'tarif.prixAchat': { fr: "Prix d'achat", en: 'Purchase price' },
  'tarif.margeSuggeree': {
    fr: 'Marge % (vide = suggérée {marge}%)',
    en: 'Margin % (blank = suggested {marge}%)'
  },
  'tarif.prixVente': { fr: 'Prix de vente', en: 'Selling price' },
  'tarif.ajouterProduit': { fr: '+ Ajouter un produit', en: '+ Add a product' },
  'tarif.nouveauProduit': { fr: 'Nouveau produit', en: 'New product' },
  'tarif.mainOeuvreTitre': { fr: "Heures / main d'œuvre", en: 'Hours / labour' },
  'tarif.description': { fr: 'Description', en: 'Description' },
  'tarif.heures': { fr: 'Heures', en: 'Hours' },
  'tarif.tauxSuggere': {
    fr: 'Taux horaire (vide = suggéré {taux})',
    en: 'Hourly rate (blank = suggested {taux})'
  },
  'tarif.ajouterLigne': { fr: '+ Ajouter une ligne', en: '+ Add a line' },
  'tarif.nouvellePrestation': { fr: 'Nouvelle prestation', en: 'New service' },
  'tarif.deplacementTitre': { fr: 'Déplacement', en: 'Travel' },
  'tarif.distanceKm': { fr: 'Distance (km)', en: 'Distance (km)' },
  'tarif.prixKmSuggere': {
    fr: 'Prix/km (vide = suggéré {prix})',
    en: 'Price/km (blank = suggested {prix})'
  },
  'tarif.ajouterDeplacement': { fr: '+ Ajouter un déplacement', en: '+ Add a trip' },
  'tarif.nouveauDeplacement': { fr: 'Nouveau déplacement', en: 'New trip' },

  // --- Journal ---
  // `Entrée` et `Dépense` sont les valeurs enregistrées en base (`TypeMouvement`).
  // Elles ne changent jamais ; seuls ces libellés se traduisent.
  'journal.entree': { fr: 'Entrée', en: 'Income' },
  'journal.depense': { fr: 'Dépense', en: 'Expense' },
  'journal.ajoutRapide': { fr: 'Ajout rapide', en: 'Quick add' },
  'journal.type': { fr: 'Type', en: 'Type' },
  'journal.categorie': { fr: 'Catégorie', en: 'Category' },
  'journal.description': { fr: 'Description', en: 'Description' },
  'journal.montantDevise': { fr: 'Montant ({devise})', en: 'Amount ({devise})' },
  'journal.tvaPct': { fr: 'TVA %', en: 'Tax %' },
  'journal.numeroFactureLiee': { fr: 'N° facture liée', en: 'Linked invoice no.' },
  'journal.notes': { fr: 'Notes', en: 'Notes' },
  'journal.ajouterAuJournal': { fr: 'Ajouter au journal', en: 'Add to ledger' },
  'journal.tableauDeBord': { fr: 'Tableau de bord', en: 'Dashboard' },
  'journal.toutes': { fr: 'Toutes', en: 'All' },
  'journal.tous': { fr: 'Tous', en: 'All' },
  'journal.totalLignes': {
    fr: '{nombre} ligne(s)',
    en: '{nombre} line(s)'
  },
  'journal.repartition': { fr: 'Répartition par catégorie', en: 'Breakdown by category' },
  'journal.evolution': {
    fr: 'Évolution annuelle Entrées vs Dépenses',
    en: 'Yearly income vs expenses'
  },
  'journal.tva': { fr: 'TVA', en: 'Tax' },
  'journal.justif': { fr: 'Justif.', en: 'Receipts' },

  // --- Suivi du temps ---
  'temps.chronometre': { fr: 'Chronomètre', en: 'Stopwatch' },
  'temps.sansDescription': { fr: 'Sans description', en: 'No description' },
  'temps.demarreeA': { fr: 'Démarrée à {heure}', en: 'Started at {heure}' },
  'temps.arreter': { fr: "Arrêter l'intervention", en: 'Stop the job' },
  'temps.descriptionIntervention': {
    fr: "Description de l'intervention",
    en: 'Job description'
  },
  'temps.exemple': { fr: 'ex. Diagnostic ampli salon', en: 'e.g. Living-room amp diagnosis' },
  'temps.clientOptionnel': { fr: 'Client (optionnel)', en: 'Client (optional)' },
  'temps.demarrer': { fr: 'Démarrer le chronomètre', en: 'Start the stopwatch' },
  'temps.interventions': { fr: 'Interventions', en: 'Jobs' },
  'temps.nonFacturees': { fr: 'Non facturées', en: 'Not invoiced' },
  'temps.aFacturer': { fr: 'À facturer', en: 'To invoice' },
  'temps.debut': { fr: 'Début', en: 'Start' },
  'temps.dureeH': { fr: 'Durée (h)', en: 'Duration (h)' },
  'temps.tauxVide': { fr: 'Taux (vide = {taux})', en: 'Rate (blank = {taux})' },
  'temps.facturee': { fr: 'Facturée', en: 'Invoiced' },
  'temps.enCours': { fr: 'en cours', en: 'running' },
  'temps.oui': { fr: 'Oui', en: 'Yes' },
  'temps.non': { fr: 'Non', en: 'No' },
  'temps.aucuneIntervention': {
    fr: 'Aucune intervention enregistrée.',
    en: 'No job recorded.'
  },
  'temps.confirmerSuppression': {
    fr: 'Supprimer cette intervention ?',
    en: 'Delete this job?'
  },
  'temps.facturerSelection': {
    fr: 'Facturer la sélection ({nombre})',
    en: 'Invoice selection ({nombre})'
  },
  'temps.choisirIntervention': {
    fr: 'Sélectionne au moins une intervention à facturer.',
    en: 'Select at least one job to invoice.'
  },
  'temps.choisirFacture': {
    fr: 'Choisis la facture sur laquelle ajouter ces heures.',
    en: 'Choose the invoice to add these hours to.'
  },
  'temps.interventionsAjoutees': {
    fr: '{nombre} intervention(s) ajoutée(s) à la facture.',
    en: '{nombre} job(s) added to the invoice.'
  },
  'temps.modaleTitre': {
    fr: 'Facturer les interventions sélectionnées',
    en: 'Invoice the selected jobs'
  },
  'temps.modaleValider': { fr: 'Ajouter à la facture', en: 'Add to invoice' },
  'temps.modaleAide': {
    fr: "Chaque intervention devient une ligne de main d'œuvre (heures × taux) sur la facture choisie. Les interventions déjà facturées sont ignorées.",
    en: 'Each job becomes a labour line (hours × rate) on the chosen invoice. Jobs already invoiced are skipped.'
  },
  'temps.facture': { fr: 'Facture', en: 'Invoice' },
  'temps.choisir': { fr: '— Choisir —', en: '— Choose —' },

  // --- Charges & Marge ---
  // Les libellés des catégories. La valeur enregistrée, elle, ne change jamais
  // — voir `src/shared/charges.ts`.
  'charge.catLoyer': { fr: 'Loyer', en: 'Rent' },
  'charge.catAssurances': { fr: 'Assurances', en: 'Insurance' },
  'charge.catMateriel': { fr: 'Matériel/Amortissement', en: 'Equipment/Depreciation' },
  'charge.catVehicule': { fr: 'Véhicule', en: 'Vehicle' },
  'charge.catAbonnements': { fr: 'Abonnements', en: 'Subscriptions' },
  'charge.catComptabilite': { fr: 'Comptabilité', en: 'Accounting' },
  'charge.catDivers': { fr: 'Divers', en: 'Miscellaneous' },
  'charge.nouvelle': { fr: 'Nouvelle charge', en: 'New cost' },
  'charge.titre': { fr: 'Charges fixes mensuelles', en: 'Monthly fixed costs' },
  'charge.libelle': { fr: 'Libellé', en: 'Label' },
  'charge.categorie': { fr: 'Catégorie', en: 'Category' },
  'charge.montantMois': { fr: 'Montant/mois ({devise})', en: 'Amount/month ({devise})' },
  'charge.actif': { fr: 'Actif', en: 'Active' },
  'charge.ajouter': { fr: '+ Ajouter une charge', en: '+ Add a cost' },
  'charge.totalActives': {
    fr: 'Total charges fixes actives :',
    en: 'Total active fixed costs:'
  },
  'charge.parMois': { fr: '{montant}/mois', en: '{montant}/month' },
  'charge.margeTitre': { fr: 'Marge & taux horaire', en: 'Margin & hourly rate' },
  'charge.heuresFacturables': {
    fr: 'Heures facturables par mois',
    en: 'Billable hours per month'
  },
  'charge.caEstime': {
    fr: "Chiffre d'affaires mensuel estimé ({devise})",
    en: 'Estimated monthly revenue ({devise})'
  },
  'charge.coutHoraire': { fr: 'Coût horaire de revient :', en: 'Hourly cost price:' },
  'charge.margeSuggeree': { fr: 'Marge suggérée :', en: 'Suggested margin:' },
  'charge.margeDefaut': {
    fr: ' (valeur par défaut, aucune charge saisie)',
    en: ' (default value, no cost entered)'
  },
  'charge.tauxSuggere': { fr: 'Taux horaire suggéré :', en: 'Suggested hourly rate:' },
  'charge.parHeure': { fr: '{montant}/h', en: '{montant}/h' },
  'charge.deplacementTitre': { fr: 'Déplacement', en: 'Travel' },
  'charge.consommation': { fr: 'Consommation (L/100km)', en: 'Consumption (L/100km)' },
  'charge.prixEssence': { fr: 'Prix essence ({devise}/L)', en: 'Fuel price ({devise}/L)' },
  'charge.entretienKm': {
    fr: 'Entretien/usure véhicule ({devise}/km)',
    en: 'Vehicle maintenance/wear ({devise}/km)'
  },
  'charge.margeLivraison': { fr: 'Marge livraison (%)', en: 'Delivery margin (%)' },
  'charge.coutCarburantKm': { fr: 'Coût carburant/km :', en: 'Fuel cost/km:' },
  'charge.coutRevientKm': { fr: 'Coût de revient/km :', en: 'Cost price/km:' },
  'charge.prixVenteKm': { fr: 'Prix de vente suggéré/km :', en: 'Suggested selling price/km:' },
  'charge.parKm': { fr: '{montant}/km', en: '{montant}/km' },
  'charge.impressionTitre': {
    fr: "Coût d'impression / envoi par facture",
    en: 'Printing / posting cost per invoice'
  },
  'charge.prixSachetA4': { fr: 'Prix sachet A4', en: 'A4 pack price' },
  'charge.feuillesParSachet': { fr: 'Feuilles par sachet', en: 'Sheets per pack' },
  'charge.feuillesParFacture': { fr: 'Feuilles par facture', en: 'Sheets per invoice' },
  'charge.prixImprimante': { fr: 'Prix imprimante', en: 'Printer price' },
  'charge.facturesAvantRemplacement': {
    fr: 'Nombre de factures avant remplacement',
    en: 'Invoices before replacement'
  },
  'charge.prixCartouche': { fr: "Prix cartouche d'encre", en: 'Ink cartridge price' },
  'charge.feuillesParCartouche': { fr: 'Feuilles par cartouche', en: 'Sheets per cartridge' },
  'charge.prixTimbre': { fr: 'Prix timbre', en: 'Stamp price' },
  'charge.prixSachetEnveloppes': { fr: 'Prix sachet enveloppes', en: 'Envelope pack price' },
  'charge.enveloppesParSachet': { fr: 'Enveloppes par sachet', en: 'Envelopes per pack' },
  'charge.margeImpression': { fr: 'Marge impression (%)', en: 'Printing margin (%)' },
  'charge.coutRevientFacture': {
    fr: 'Coût de revient par facture :',
    en: 'Cost price per invoice:'
  },
  'charge.prixFactureClient': { fr: 'Prix facturé au client :', en: 'Price charged to client:' },
  'charge.margeEnregistree': {
    fr: 'Paramètres de marge enregistrés.',
    en: 'Margin settings saved.'
  },
  'charge.deplacementEnregistre': {
    fr: 'Paramètres de déplacement enregistrés.',
    en: 'Travel settings saved.'
  },
  'charge.impressionEnregistree': {
    fr: "Paramètres d'impression enregistrés.",
    en: 'Printing settings saved.'
  },

  // --- Bandeau lecture seule (mode multi-postes) ---
  'lectureSeule.avant': { fr: 'Vous êtes connecté en', en: 'You are signed in as' },
  'lectureSeule.mot': { fr: 'lecture seule', en: 'read-only' },
  'lectureSeule.apres': {
    fr: ': la consultation est libre, mais toute modification sera refusée par le serveur.',
    en: ': you may browse freely, but any change will be refused by the server.'
  },

  // --- Ajout rapide ---
  'ajout.titre': { fr: 'Ajout rapide', en: 'Quick add' },
  'ajout.ou': {
    fr: 'Où voulez-vous enregistrer cette saisie ?',
    en: 'Where do you want to record this entry?'
  },
  'ajout.destJournal': { fr: 'Journal — entrée / dépense', en: 'Ledger — income / expense' },
  'ajout.destFacture': { fr: 'Facture — nouveau brouillon', en: 'Invoice — new draft' },
  'ajout.destDevis': { fr: 'Devis — nouveau brouillon', en: 'Quote — new draft' },
  'ajout.destClient': { fr: 'Client — nouvelle fiche', en: 'Client — new record' },
  'ajout.destTarifProduit': {
    fr: 'Tarifs — produit / prestation',
    en: 'Rates — product / service'
  },
  'ajout.destTarifMainOeuvre': {
    fr: "Tarifs — heures / main d'œuvre",
    en: 'Rates — hours / labour'
  },
  'ajout.destTarifDeplacement': { fr: 'Tarifs — déplacement', en: 'Rates — travel' },
  'ajout.destInventaire': { fr: 'Inventaire — nouvel article', en: 'Inventory — new item' },
  'ajout.aideDocument': {
    fr: 'Le numéro, la date, le délai et la TVA sont remplis automatiquement depuis tes paramètres. Tu ajoutes les lignes ensuite dans le module dédié.',
    en: 'The number, date, payment term and tax are filled in automatically from your settings. You add the lines afterwards in the dedicated module.'
  },
  'ajout.nomClient': { fr: 'Nom du client', en: 'Client name' },
  'ajout.margeSuggeree': { fr: '(vide = suggérée {marge}%)', en: '(blank = suggested {marge}%)' },
  'ajout.tauxHoraire': { fr: 'Taux horaire', en: 'Hourly rate' },
  'ajout.tauxSuggere': {
    fr: '(vide = suggéré {taux} {devise}/h)',
    en: '(blank = suggested {taux} {devise}/h)'
  },
  'ajout.prixKm': { fr: 'Prix/km', en: 'Price/km' },
  'ajout.prixKmSuggere': {
    fr: '(vide = suggéré {prix} {devise}/km)',
    en: '(blank = suggested {prix} {devise}/km)'
  },
  'ajout.prixAchatDevise': { fr: "Prix d'achat ({devise})", en: 'Purchase price ({devise})' },
  'ajout.marge': { fr: 'Marge %', en: 'Margin %' },
  'ajout.quantiteStock': { fr: 'Quantité en stock', en: 'Quantity in stock' },
  'ajout.prixAchatUnitaire': { fr: "Prix d'achat unitaire", en: 'Unit purchase price' },
  'ajout.prixVenteUnitaire': { fr: 'Prix de vente unitaire', en: 'Unit selling price' },
  'ajout.creerBrouillonFacture': {
    fr: 'Créer le brouillon de facture',
    en: 'Create the invoice draft'
  },
  'ajout.creerBrouillonDevis': { fr: 'Créer le brouillon de devis', en: 'Create the quote draft' },
  'ajout.ecritureAjoutee': { fr: 'Écriture ajoutée au Journal.', en: 'Entry added to the Ledger.' },
  'ajout.produitAjoute': { fr: 'Produit ajouté aux tarifs.', en: 'Product added to the rates.' },
  'ajout.mainOeuvreAjoutee': {
    fr: "Ligne de main d'œuvre ajoutée aux tarifs.",
    en: 'Labour line added to the rates.'
  },
  'ajout.deplacementAjoute': {
    fr: 'Déplacement ajouté aux tarifs.',
    en: 'Trip added to the rates.'
  },
  'ajout.articleAjoute': {
    fr: "Article ajouté à l'inventaire.",
    en: 'Item added to the inventory.'
  },
  'ajout.clientCree': { fr: 'Client « {nom} » créé.', en: 'Client “{nom}” created.' },
  'ajout.choisirClientFacture': {
    fr: 'Choisissez un client pour créer la facture.',
    en: 'Choose a client to create the invoice.'
  },
  'ajout.choisirClientDevis': {
    fr: 'Choisissez un client pour créer le devis.',
    en: 'Choose a client to create the quote.'
  },
  'ajout.brouillonFactureCree': {
    fr: 'Brouillon de facture {numero} créé. Ouvre le module Facturation pour ajouter les lignes.',
    en: 'Invoice draft {numero} created. Open the Invoicing module to add the lines.'
  },
  'ajout.brouillonDevisCree': {
    fr: 'Brouillon de devis {numero} créé. Ouvre le module Devis pour ajouter les lignes.',
    en: 'Quote draft {numero} created. Open the Quotes module to add the lines.'
  },

  // --- Devis ---
  // Les trois statuts sont enregistrés en base — voir `src/shared/documents.ts`.
  'devis.statutEnAttente': { fr: 'En attente', en: 'Pending' },
  'devis.statutAccepte': { fr: 'Accepté', en: 'Accepted' },
  'devis.statutRefuse': { fr: 'Refusé', en: 'Declined' },
  'devis.nouveau': { fr: 'Nouveau devis', en: 'New quote' },
  'devis.creerBrouillon': { fr: 'Créer un brouillon de devis', en: 'Create a quote draft' },
  'devis.choisirClient': {
    fr: "Choisissez d'abord un client pour créer le devis.",
    en: 'Choose a client first to create the quote.'
  },
  'devis.enregistre': { fr: 'Devis enregistré.', en: 'Quote saved.' },
  'devis.pdfExporte': { fr: 'PDF exporté : {chemin}', en: 'PDF exported: {chemin}' },
  'devis.confirmerSuppression': {
    fr: 'Supprimer définitivement ce devis ?',
    en: 'Permanently delete this quote?'
  },
  'devis.numero': { fr: 'Numéro', en: 'Number' },
  'devis.validiteJours': { fr: 'Validité (jours)', en: 'Validity (days)' },
  'devis.retirer': { fr: 'Retirer', en: 'Remove' },
  'devis.insererModele': { fr: 'Insérer un modèle', en: 'Insert a template' },
  'devis.remisePct': { fr: 'Remise (%)', en: 'Discount (%)' },
  'devis.tvaPct': { fr: 'TVA (%)', en: 'Tax (%)' },
  'devis.statut': { fr: 'Statut', en: 'Status' },
  'devis.sousTotal': { fr: 'Sous-total : {montant}', en: 'Subtotal: {montant}' },
  'devis.remiseLigne': { fr: 'Remise : {pct}%', en: 'Discount: {pct}%' },
  'devis.tvaLigne': { fr: 'TVA ({pct}%) : {montant}', en: 'Tax ({pct}%): {montant}' },
  'devis.totalLigne': { fr: 'TOTAL DEVIS : {montant}', en: 'QUOTE TOTAL: {montant}' },
  'devis.exporterPdf': { fr: 'Exporter en PDF', en: 'Export to PDF' },
  'devis.historique': { fr: 'Historique des devis', en: 'Quote history' },
  'devis.facture': { fr: 'Facturé', en: 'Invoiced' },
  'devis.ouvrir': { fr: 'Ouvrir', en: 'Open' },
  'devis.dupliquer': { fr: 'Dupliquer', en: 'Duplicate' },
  'devis.versFacture': { fr: '→ Facture', en: '→ Invoice' },
  'devis.lignesInserees': {
    fr: '{nombre} ligne(s) insérée(s) depuis « {modele} ».',
    en: '{nombre} line(s) inserted from “{modele}”.'
  },
  'devis.duplique': {
    fr: 'Devis dupliqué sous le numéro {numero}.',
    en: 'Quote duplicated as number {numero}.'
  },
  'devis.factureCreee': {
    fr: 'Facture {numero} créée depuis ce devis. Ouvre le module Facturation pour la compléter.',
    en: 'Invoice {numero} created from this quote. Open the Invoicing module to complete it.'
  },
  'devis.modaleModele': {
    fr: 'Insérer un modèle de prestations',
    en: 'Insert a service template'
  },
  'devis.modaleAide': {
    fr: 'Les lignes du modèle seront ajoutées à la suite de celles déjà saisies.',
    en: 'The template lines will be added after the ones already entered.'
  },
  'devis.lignesModele': { fr: '{nombre} ligne(s)', en: '{nombre} line(s)' },

  // --- Facturation ---
  // Les trois statuts sont enregistrés en base — voir `src/shared/documents.ts`.
  'facture.statutEnAttente': { fr: 'En attente', en: 'Pending' },
  'facture.statutPayee': { fr: 'Payée', en: 'Paid' },
  'facture.statutAnnulee': { fr: 'Annulée', en: 'Cancelled' },
  'facture.nouvelle': { fr: 'Nouvelle facture', en: 'New invoice' },
  'facture.creerBrouillon': { fr: 'Créer un brouillon de facture', en: 'Create an invoice draft' },
  'facture.choisirClient': {
    fr: "Choisissez d'abord un client pour créer la facture.",
    en: 'Choose a client first to create the invoice.'
  },
  'facture.enregistree': { fr: 'Facture enregistrée.', en: 'Invoice saved.' },
  'facture.confirmerHistorique': {
    fr: "Enregistrer cette facture dans l'historique et dans le Journal ?\n(Si elle y est déjà, aucun doublon ne sera créé.)",
    en: 'Record this invoice in the history and in the Ledger?\n(If it is already there, no duplicate will be created.)'
  },
  'facture.dejaAuJournal': {
    fr: 'Cette facture était déjà dans le Journal (aucun doublon créé).',
    en: 'This invoice was already in the Ledger (no duplicate created).'
  },
  'facture.ecritureAjoutee': {
    fr: 'Écriture ajoutée au Journal : {montant}.',
    en: 'Entry added to the Ledger: {montant}.'
  },
  'facture.confirmerSuppression': {
    fr: 'Supprimer définitivement cette facture ?',
    en: 'Permanently delete this invoice?'
  },
  'facture.delaiPaiement': { fr: 'Délai de paiement (jours)', en: 'Payment term (days)' },
  'facture.echeanceCalculee': { fr: 'Échéance calculée', en: 'Computed due date' },
  'facture.enregistrerCommeModele': {
    fr: 'Enregistrer comme modèle',
    en: 'Save as a template'
  },
  'facture.aImprimer': {
    fr: 'À imprimer / envoyer par courrier',
    en: 'To print / send by post'
  },
  'facture.notesInternes': {
    fr: 'Notes internes (jamais imprimées sur le document client)',
    en: 'Internal notes (never printed on the client document)'
  },
  'facture.fraisImpression': {
    fr: "Frais d'impression / envoi : {montant}",
    en: 'Printing / postage cost: {montant}'
  },
  'facture.totalAPayer': { fr: 'TOTAL À PAYER : {montant}', en: 'TOTAL DUE: {montant}' },
  'facture.historique': { fr: 'Historique des factures', en: 'Invoice history' },
  'facture.montantJournal': {
    fr: 'Montant (depuis le Journal)',
    en: 'Amount (from the Ledger)'
  },
  'facture.rappel': { fr: 'Rappel', en: 'Reminder' },
  'facture.nomModele': { fr: 'Donne un nom à ce modèle.', en: 'Give this template a name.' },
  'facture.modeleCree': {
    fr: 'Modèle « {nom} » créé avec {nombre} ligne(s).',
    en: 'Template “{nom}” created with {nombre} line(s).'
  },
  'facture.dupliquee': {
    fr: 'Facture dupliquée sous le numéro {numero}.',
    en: 'Invoice duplicated as number {numero}.'
  },
  'facture.fraisRappelInvalides': {
    fr: 'Les frais de rappel doivent être un nombre positif ou zéro.',
    en: 'The reminder fee must be a positive number or zero.'
  },
  'facture.rappelCree': {
    fr: '{rang} rappel créé et exporté :\n{chemin}',
    en: '{rang} reminder created and exported:\n{chemin}'
  },
  'facture.modaleModeleTitre': { fr: 'Enregistrer comme modèle', en: 'Save as a template' },
  'facture.modaleModeleValider': { fr: 'Créer le modèle', en: 'Create the template' },
  'facture.modaleModeleAide': {
    fr: 'Les lignes de cette facture seront enregistrées comme modèle réutilisable. La facture est enregistrée au passage.',
    en: 'The lines of this invoice will be saved as a reusable template. The invoice is saved along the way.'
  },
  'facture.nomDuModele': { fr: 'Nom du modèle', en: 'Template name' },
  'facture.modaleRappelTitre': { fr: 'Émettre le {rang} rappel', en: 'Issue the {rang} reminder' },
  'facture.modaleRappelValider': {
    fr: 'Créer le rappel et exporter le PDF',
    en: 'Create the reminder and export the PDF'
  },
  'facture.modaleRappelAide': {
    fr: 'Le rappel reprend les lignes de la facture, y ajoute les frais ci-dessous et recalcule le montant total dû.',
    en: 'The reminder repeats the invoice lines, adds the fee below and recomputes the total amount due.'
  },
  'facture.fraisRappel': {
    fr: 'Frais de rappel à facturer ({devise})',
    en: 'Reminder fee to charge ({devise})'
  },

  // --- Paramètres de l'application ---
  'papp.enregistres': { fr: 'Paramètres enregistrés.', en: 'Settings saved.' },
  'papp.themeSombre': { fr: 'Sombre', en: 'Dark' },
  'papp.themeClair': { fr: 'Clair', en: 'Light' },
  'papp.themeAuto': { fr: 'Automatique (suit Windows)', en: 'Automatic (follows Windows)' },
  'papp.couleurAccent': { fr: "Couleur d'accent", en: 'Accent colour' },
  'papp.apercuImmediat': {
    fr: "L'aperçu est immédiat. Clique sur {bouton} en bas pour le conserver.",
    en: 'The preview is immediate. Click {bouton} at the bottom to keep it.'
  },
  'papp.dossiers': { fr: 'Dossiers', en: 'Folders' },
  'papp.dossierPdf': {
    fr: 'Dossier des PDF (Factures / Devis)',
    en: 'PDF folder (Invoices / Quotes)'
  },
  'papp.changerDossier': { fr: 'Changer de dossier…', en: 'Change folder…' },
  'papp.remettreDefaut': { fr: 'Remettre par défaut', en: 'Reset to default' },
  'papp.ouvrir': { fr: 'Ouvrir', en: 'Open' },
  'papp.dossierDonnees': {
    fr: 'Dossier des données (base SQLite)',
    en: 'Data folder (SQLite database)'
  },
  'papp.ouvrirDossierDonnees': { fr: 'Ouvrir le dossier des données', en: 'Open the data folder' },
  'papp.ouvrirSauvegardes': { fr: 'Ouvrir les sauvegardes', en: 'Open the backups' },
  'papp.sauvegardes': { fr: 'Sauvegardes', en: 'Backups' },
  'papp.nombreConservees': {
    fr: 'Nombre de sauvegardes conservées',
    en: 'Number of backups kept'
  },
  'papp.sauvegardeAuto': {
    fr: 'Une sauvegarde est créée automatiquement à chaque démarrage et avant chaque export PDF.',
    en: 'A backup is created automatically on every start and before every PDF export.'
  },
  'papp.sauvegarderMaintenant': { fr: 'Sauvegarder maintenant', en: 'Back up now' },
  'papp.taille': { fr: 'Taille', en: 'Size' },
  'papp.restaurer': { fr: 'Restaurer', en: 'Restore' },
  'papp.confirmerRestauration': {
    fr: "Restaurer la sauvegarde « {nom} » ?\n\nLes données actuelles seront remplacées. Une sauvegarde de sécurité de l'état actuel est créée automatiquement avant la restauration.",
    en: 'Restore the backup “{nom}”?\n\nThe current data will be replaced. A safety backup of the current state is created automatically before restoring.'
  },
  'papp.sauvegardeRestauree': {
    fr: 'Sauvegarde restaurée. Change de module puis reviens pour voir les données reprises.',
    en: 'Backup restored. Switch module and come back to see the recovered data.'
  },
  'papp.sauvegardeExterne': { fr: 'Sauvegarde externe chiffrée', en: 'Encrypted external backup' },
  'papp.dossierExterne': { fr: 'Dossier externe', en: 'External folder' },
  'papp.choisirDossier': { fr: 'Choisir le dossier…', en: 'Choose the folder…' },
  'papp.motDePasse': {
    fr: 'Mot de passe de chiffrement (8 caractères minimum)',
    en: 'Encryption password (8 characters minimum)'
  },
  'papp.avertissementMotDePasse': {
    fr: "Note ce mot de passe ailleurs : sans lui, la sauvegarde est définitivement illisible. Il n'est stocké nulle part dans l'application.",
    en: 'Write this password down elsewhere: without it the backup is permanently unreadable. It is stored nowhere in the application.'
  },
  'papp.sauvegarderChiffre': {
    fr: 'Sauvegarder maintenant (chiffré)',
    en: 'Back up now (encrypted)'
  },
  'papp.restaurerChiffre': {
    fr: 'Restaurer depuis un fichier chiffré…',
    en: 'Restore from an encrypted file…'
  },
  'papp.dossierExterneDefini': {
    fr: 'Dossier de sauvegarde externe : {dossier}',
    en: 'External backup folder: {dossier}'
  },
  'papp.sauvegardeChiffreeCreee': {
    fr: 'Sauvegarde chiffrée créée : {chemin}',
    en: 'Encrypted backup created: {chemin}'
  },
  'papp.confirmerRestaurationChiffree': {
    fr: "Restaurer depuis une sauvegarde chiffrée ?\n\nLes données actuelles seront remplacées. Une sauvegarde locale de l'état actuel est créée automatiquement avant la restauration.",
    en: 'Restore from an encrypted backup?\n\nThe current data will be replaced. A local backup of the current state is created automatically before restoring.'
  },
  'papp.restaureeDepuis': {
    fr: 'Sauvegarde restaurée depuis {chemin}. Change de module puis reviens pour voir les données reprises.',
    en: 'Backup restored from {chemin}. Switch module and come back to see the recovered data.'
  },
  'papp.valeursDefaut': { fr: 'Valeurs par défaut', en: 'Default values' },
  'papp.delaiFactures': {
    fr: 'Délai de paiement des factures (jours)',
    en: 'Invoice payment term (days)'
  },
  'papp.validiteDevis': { fr: 'Validité des devis (jours)', en: 'Quote validity (days)' },
  'papp.alerteFacture': {
    fr: 'Alerte « facture en attente » après (jours)',
    en: '“Invoice outstanding” alert after (days)'
  },
  'papp.categoriesJournal': { fr: 'Catégories du Journal', en: 'Ledger categories' },
  'papp.nouvelleCategorie': { fr: 'Nouvelle catégorie', en: 'New category' },
  'papp.ajouter': { fr: 'Ajouter', en: 'Add' },
  'papp.misesAJour': { fr: 'Mises à jour', en: 'Updates' },
  'papp.majAide': {
    fr: "Permet de diffuser une nouvelle version à tous les postes qui utilisent Ohmnia. Laisse l'adresse vide pour désactiver complètement : dans ce cas l'application ne fait aucun accès réseau.",
    en: 'Lets you push a new version to every workstation running Ohmnia. Leave the address blank to disable it entirely: the application then makes no network access at all.'
  },
  'papp.sourceMaj': { fr: 'Source des mises à jour', en: 'Update source' },
  'papp.sourceGithub': {
    fr: 'Dépôt GitHub (recommandé, diffusion publique)',
    en: 'GitHub repository (recommended, public distribution)'
  },
  'papp.sourceUrl': {
    fr: 'Dossier ou serveur HTTP (réseau local)',
    en: 'Folder or HTTP server (local network)'
  },
  'papp.depotGithub': { fr: 'Dépôt GitHub', en: 'GitHub repository' },
  'papp.depotExemple': {
    fr: 'proprietaire/depot (vide = désactivé)',
    en: 'owner/repository (blank = disabled)'
  },
  'papp.depotAide': {
    fr: "L'application lira la dernière {release} publiée sur ce dépôt. Le dépôt doit être public, ou les fichiers de version accessibles sans authentification.",
    en: 'The application will read the latest {release} published on that repository. The repository must be public, or the version files reachable without authentication.'
  },
  'papp.adressePublication': { fr: 'Adresse de publication', en: 'Publication address' },
  'papp.adresseExemple': {
    fr: 'http://192.168.1.20/ohmnia (vide = désactivé)',
    en: 'http://192.168.1.20/ohmnia (blank = disabled)'
  },
  'papp.verifierDemarrage': {
    fr: 'Vérifier automatiquement au démarrage',
    en: 'Check automatically on start'
  },
  'papp.enregistrerAdresse': { fr: "Enregistrer l'adresse", en: 'Save the address' },
  'papp.verifierMaintenant': { fr: 'Vérifier maintenant', en: 'Check now' },
  'papp.sourceEnregistree': {
    fr: 'Source des mises à jour enregistrée : {source}',
    en: 'Update source saved: {source}'
  },
  'papp.majDesactivees': {
    fr: 'Mises à jour désactivées : aucun accès réseau.',
    en: 'Updates disabled: no network access.'
  },
  'papp.versionInstallee': { fr: 'Version installée :', en: 'Installed version:' },
  'papp.verificationEnCours': { fr: 'Vérification en cours…', en: 'Checking…' },
  'papp.aJour': { fr: 'Cette version est à jour.', en: 'This version is up to date.' },
  'papp.nouvelleVersion': { fr: 'Nouvelle version disponible :', en: 'New version available:' },
  'papp.telecharger': { fr: 'Télécharger', en: 'Download' },
  'papp.telechargement': { fr: 'Téléchargement… {pct} %', en: 'Downloading… {pct} %' },
  'papp.prete': {
    fr: 'téléchargée et prête à installer. Ohmnia va redémarrer.',
    en: 'downloaded and ready to install. Ohmnia will restart.'
  },
  'papp.installerRedemarrer': { fr: 'Installer et redémarrer', en: 'Install and restart' },
  'papp.confirmerInstallation': {
    fr: "Installer la mise à jour ? L'application va se fermer et redémarrer.",
    en: 'Install the update? The application will close and restart.'
  },
  'papp.infosTitre': { fr: 'Informations & maintenance', en: 'Information & maintenance' },
  'papp.versionOhmnia': { fr: "Version d'Ohmnia", en: 'Ohmnia version' },
  'papp.electronNode': { fr: 'Electron / Node', en: 'Electron / Node' },
  'papp.baseDeDonnees': { fr: 'Base de données', en: 'Database' },
  'papp.verifierIntegrite': {
    fr: "Vérifier l'intégrité de la base",
    en: 'Check the database integrity'
  },
  'papp.exporterTout': {
    fr: 'Exporter toutes les données (JSON)',
    en: 'Export all data (JSON)'
  },
  'papp.baseSaine': {
    fr: 'Base de données saine : aucune anomalie détectée.',
    en: 'Database healthy: no anomaly found.'
  },
  'papp.anomalie': {
    fr: 'Anomalie détectée dans la base : {detail}',
    en: 'Anomaly found in the database: {detail}'
  },
  'papp.conditionsTitre': { fr: "Conditions d'utilisation", en: 'Terms of use' },
  'papp.conditionsAide': {
    fr: "Conditions de l'application elle-même — à ne pas confondre avec vos conditions générales de vente, qui se saisissent dans « Mon entreprise » et s'impriment sur vos factures.",
    en: 'Terms of the application itself — not to be confused with your own terms of sale, entered under “My company” and printed on your invoices.'
  },
  'papp.versionAcceptee': { fr: 'Version acceptée', en: 'Accepted version' },
  'papp.versionActuelle': { fr: ' (version actuelle : {version})', en: ' (current version: {version})' },
  'papp.accepteesLe': { fr: 'Acceptées le', en: 'Accepted on' },
  'papp.relireConditions': { fr: 'Relire les conditions', en: 'Read the terms again' },
  'papp.ouvrirPageEnLigne': { fr: 'Ouvrir la page en ligne', en: 'Open the online page' },
  'papp.enregistrerParametres': { fr: 'Enregistrer les paramètres', en: 'Save the settings' },

  'temps.arretee': {
    fr: 'Intervention arrêtée : {duree}.',
    en: 'Job stopped: {duree}.'
  },
  'papp.pdfRangesDans': {
    fr: 'Les PDF seront rangés dans : {dossier}',
    en: 'PDFs will be stored in: {dossier}'
  },
  'papp.dossierRetabli': {
    fr: 'Dossier par défaut rétabli : {chemin}',
    en: 'Default folder restored: {chemin}'
  },
  'papp.sauvegardeCreee': {
    fr: 'Sauvegarde créée : {chemin}',
    en: 'Backup created: {chemin}'
  },

  // --- Composants partagés ---
  'recherche.placeholder': {
    fr: 'Rechercher un client, une facture, un article…',
    en: 'Search for a client, an invoice, an item…'
  },
  'graphique.aucuneDonnee': { fr: 'Aucune donnée disponible.', en: 'No data available.' },
  'graphique.aucuneSelection': {
    fr: 'Aucune donnée à afficher pour cette sélection.',
    en: 'No data to show for this selection.'
  },
  'selecteur.choisirClient': { fr: '— Choisir un client —', en: '— Choose a client —' },
  'selecteur.ajouter': { fr: 'Ajouter', en: 'Add' },

  // --- Justificatifs ---
  'justif.titre': {
    fr: 'Justificatifs — {description}',
    en: 'Receipts — {description}'
  },
  'justif.ecritureJournal': { fr: 'écriture du Journal', en: 'ledger entry' },
  'justif.aucun': {
    fr: 'Aucun justificatif pour cette écriture.',
    en: 'No receipt for this entry.'
  },
  'justif.ajouter': { fr: 'Ajouter un justificatif…', en: 'Add a receipt…' },
  'justif.confirmerSuppression': {
    fr: 'Supprimer ce justificatif ? Le fichier sera effacé du disque.',
    en: 'Delete this receipt? The file will be erased from the disk.'
  },

  // --- Mode multi-postes (réglage) ---
  'multi.titre': { fr: 'Mode multi-postes', en: 'Multi-workstation mode' },
  'multi.presentation': {
    fr: 'Par défaut, Ohmnia travaille sur la base de {cet} , hors ligne. Le mode multi-postes fait travailler plusieurs postes sur les mêmes données, servies par un serveur installé chez vous. Rien ne sort de votre réseau.',
    en: 'By default Ohmnia works on the database of {cet} , offline. Multi-workstation mode lets several machines work on the same data, served by a server installed at your place. Nothing leaves your network.'
  },
  'multi.cetOrdinateur': { fr: 'cet ordinateur', en: 'this computer' },
  'multi.modeActuel': { fr: 'Mode actuel :', en: 'Current mode:' },
  'multi.serveurAdresse': { fr: 'serveur ({adresse})', en: 'server ({adresse})' },
  'multi.local': { fr: 'local', en: 'local' },
  'multi.connecteComme': { fr: 'connecté comme', en: 'signed in as' },
  'multi.adresseServeur': { fr: 'Adresse du serveur', en: 'Server address' },
  'multi.testerConnexion': { fr: 'Tester la connexion', en: 'Test the connection' },
  'multi.revenirLocal': { fr: 'Revenir au mode local', en: 'Back to local mode' },
  'multi.passerServeur': { fr: 'Passer en mode multi-postes', en: 'Switch to multi-workstation mode' },
  'multi.joignableAvecComptes': {
    fr: 'Serveur joignable, des comptes y existent déjà.',
    en: 'Server reachable, accounts already exist on it.'
  },
  'multi.joignableSansCompte': {
    fr: 'Serveur joignable, mais aucun compte : vous créerez le premier administrateur en vous connectant.',
    en: 'Server reachable, but no account yet: you will create the first administrator when signing in.'
  },
  'multi.redemarrage': {
    fr: "Le changement de mode {redemarre} : c'est au démarrage qu'Ohmnia décide s'il lit sa base locale ou celle du serveur. Vos données locales ne sont jamais effacées — revenir au mode local les retrouve telles quelles.",
    en: 'Changing mode {redemarre}: Ohmnia decides at startup whether it reads its local database or the server one. Your local data is never erased — going back to local mode finds it unchanged.'
  },
  'multi.redemarreAffichage': { fr: "redémarre l'affichage", en: 'restarts the display' },
  'multi.sauvegardesServeur': {
    fr: "En multi-postes, les sauvegardes et l'export global sont l'affaire du serveur : ces actions sont désactivées sur ce poste. Les justificatifs et le logo, eux, sont rangés avec les données et restent accessibles depuis tous les postes.",
    en: 'In multi-workstation mode, backups and the global export are the server\'s business: those actions are disabled on this machine. Receipts and the logo, on the other hand, are stored with the data and stay reachable from every workstation.'
  },
  'multi.affichagePropre': {
    fr: "Le thème, la langue et la couleur d'accent restent propres à ce poste : deux collègues qui partagent la même base n'ont pas à partager leur affichage.",
    en: 'Theme, language and accent colour stay specific to this machine: two colleagues sharing the same database need not share their display.'
  },
  'multi.chiffrementObligatoire': {
    fr: "Le serveur refuse d'écouter sur le réseau sans chiffrement.",
    en: 'The server refuses to listen on the network without encryption.'
  },
  'multi.chiffrementSuite': {
    fr: ' Fournissez-lui un certificat et une clé privée, ou placez-le derrière un proxy HTTPS.',
    en: ' Give it a certificate and a private key, or put it behind an HTTPS proxy.'
  },

  // --- Écran de connexion au serveur ---
  'connexion.titre': { fr: 'Ohmnia — mode multi-postes', en: 'Ohmnia — multi-workstation mode' },
  'connexion.serveurNeuf': {
    fr: "Ce serveur est neuf : aucun compte n'existe encore. Le compte que vous créez ici sera",
    en: 'This server is new: no account exists yet. The account you create here will be'
  },
  'connexion.administrateur': { fr: ' administrateur', en: ' the administrator' },
  'connexion.serveurNeufSuite': {
    fr: ' et pourra ensuite créer ceux de vos collègues.',
    en: ' and will then be able to create your colleagues’.'
  },
  'connexion.identifiant': { fr: 'Identifiant', en: 'Username' },
  'connexion.nomAffiche': { fr: 'Nom affiché (facultatif)', en: 'Display name (optional)' },
  'connexion.motDePasse': { fr: 'Mot de passe', en: 'Password' },
  'connexion.exigenceMotDePasse': {
    fr: 'Au moins 10 caractères, avec une lettre et un chiffre.',
    en: 'At least 10 characters, with a letter and a digit.'
  },
  'connexion.enCours': { fr: 'Connexion…', en: 'Signing in…' },
  'connexion.creerAdministrateur': {
    fr: 'Créer le compte administrateur',
    en: 'Create the administrator account'
  },
  'connexion.seConnecter': { fr: 'Se connecter', en: 'Sign in' },
  'connexion.motDePasseNonEnregistre': {
    fr: "Le mot de passe n'est jamais enregistré sur ce poste : il est redemandé à chaque ouverture.",
    en: 'The password is never stored on this machine: it is asked for again each time.'
  },

  // --- Écran des conditions d'utilisation ---
  'cond.titre': { fr: "Conditions d'utilisation", en: 'Terms of use' },
  'cond.sousTitre': {
    fr: 'Version {version} — à lire avant la première utilisation',
    en: 'Version {version} — to read before first use'
  },
  'cond.cocher': {
    fr: 'Cochez la case pour confirmer que vous avez lu et accepté les conditions.',
    en: 'Tick the box to confirm that you have read and accepted the terms.'
  },
  'cond.defiler': {
    fr: "Faites défiler le texte jusqu'en bas pour continuer.",
    en: 'Scroll the text to the bottom to continue.'
  },
  'cond.accepter': { fr: 'Accepter et démarrer', en: 'Accept and start' },

  'recherche.aide': {
    fr: 'Tape au moins 2 caractères. Flèches pour naviguer, Entrée pour ouvrir, Échap pour fermer.',
    en: 'Type at least 2 characters. Arrows to move, Enter to open, Esc to close.'
  },
  'justif.aide': {
    fr: "Photos de tickets, scans de factures d'achat ou PDF. Les fichiers sont copiés dans le dossier de données de l'app, donc inclus dans les sauvegardes.",
    en: 'Photos of receipts, scans of purchase invoices or PDFs. The files are copied into the app data folder, so they are included in the backups.'
  },
  'cond.acceptation': {
    fr: "J'ai lu et j'accepte ces conditions. Je comprends que la conformité légale et fiscale de mon activité reste ma responsabilité.",
    en: 'I have read and accept these terms. I understand that the legal and tax compliance of my business remains my responsibility.'
  },

  // --- Relances à envoyer ---
  'relance.titre': { fr: 'Relances à envoyer', en: 'Reminders to send' },
  'relance.aide': {
    fr: "Les factures échues depuis plus de {seuil} jours, sans relance récente. Rien n'est envoyé automatiquement : c'est une liste, pas un automatisme.",
    en: 'Invoices overdue by more than {seuil} days, with no recent reminder. Nothing is sent automatically: this is a list, not an automation.'
  },
  'relance.aucune': {
    fr: 'Rien à relancer aujourd’hui.',
    en: 'Nothing to chase today.'
  },
  'relance.retard': { fr: '{jours} j de retard', en: '{jours} d overdue' },
  'relance.jamaisRelancee': { fr: 'jamais relancée', en: 'never chased' },
  'relance.dernierRappel': {
    fr: 'dernier rappel il y a {jours} j',
    en: 'last reminder {jours} d ago'
  },
  'relance.emettre': { fr: 'Émettre le {rang} rappel', en: 'Issue the {rang} reminder' },
  'relance.epuisee': {
    fr: '{max} rappels envoyés — un de plus ne changera rien. Appel, mise en demeure, ou abandon : la décision vous revient.',
    en: '{max} reminders sent — one more will change nothing. A call, a formal notice, or writing it off: the decision is yours.'
  },

  'cond.lireSurLeSite': { fr: 'Lire sur le site', en: 'Read it on the website' },
  'cond.texteFaitFoi': {
    fr: 'Ce texte est rédigé en français, et c’est la version qui fait foi. Une traduction anglaise est publiée sur le site : elle est fournie pour information et ne prévaut pas.',
    en: 'These terms are written in French, and the French text is the authoritative one. An English translation is published on the website: it is provided for information and does not prevail.'
  },

  // --- Erreurs génériques ---
  'erreur.inconnue': { fr: 'Erreur inconnue.', en: 'Unknown error.' },

  // --- Paramètres de l'application ---
  'param.langue': { fr: 'Langue', en: 'Language' },
  'param.langueAide': {
    fr: "Change la langue de l'interface et des documents imprimés.",
    en: 'Changes the language of the interface and printed documents.'
  },
  'param.apparence': { fr: 'Apparence', en: 'Appearance' },
  'param.theme': { fr: 'Thème', en: 'Theme' },

  // --- Mon entreprise ---
  //
  // **Ce bloc ne contient que du texte d'écran.** Le nom de la taxe, le libellé
  // de l'identifiant fiscal et la mention de non-assujettissement viennent de
  // `pays.ts` et n'ont **pas** de clé ici : ils partent sur la facture et
  // appartiennent au pays d'émission. `tests/pays-et-documents.mjs` refuse
  // qu'on leur en donne une.
  'action.chargement': { fr: 'Chargement…', en: 'Loading…' },
  'ent.identite': { fr: "Identité de l'entreprise", en: 'Business identity' },
  'papp.nbSauvegardes': {
    fr: 'Actuellement : {nombre} sauvegarde(s).',
    en: 'Currently: {nombre} backup(s).'
  },
  'papp.sauvegardeExterneAide': {
    fr: "Copie chiffrée de la base vers une clé USB ou un disque externe (AES-256-GCM, mot de passe jamais enregistré). Indispensable en cas de panne ou de vol de l'ordinateur.",
    en: 'An encrypted copy of the database onto a USB stick or an external drive (AES-256-GCM, the password is never stored). Essential if the computer fails or is stolen.'
  },
  'ent.pays': { fr: 'Pays', en: 'Country' },
  'ent.remplacerConditions': {
    fr: 'Remplacer les conditions générales actuelles par le modèle ?',
    en: 'Replace the current terms and conditions with the template?'
  },
  'ent.enregistre': { fr: 'Paramètres enregistrés.', en: 'Settings saved.' },
  'ent.paysAide': {
    fr: "Le pays détermine la devise ({devise}), les taux de {taxe}, le format de l'identifiant fiscal et les mentions légales imprimées sur les documents.",
    en: 'The country sets the currency ({devise}), the {taxe} rates, the tax identifier format and the legal notices printed on documents.'
  },
  'ent.nom': { fr: "Nom de l'entreprise", en: 'Business name' },
  'ent.adresse': { fr: 'Adresse', en: 'Address' },
  'ent.email': { fr: 'Email', en: 'Email' },
  'ent.telephone': { fr: 'Téléphone', en: 'Phone' },
  'ent.iban': { fr: 'IBAN', en: 'IBAN' },
  'ent.titulaire': { fr: 'Titulaire du compte', en: 'Account holder' },
  'ent.prefixeFacture': { fr: 'Préfixe numéro de facture', en: 'Invoice number prefix' },
  'ent.prefixeDevis': { fr: 'Préfixe numéro de devis', en: 'Quote number prefix' },
  'ent.logo': { fr: 'Logo', en: 'Logo' },
  'ent.logoAlt': { fr: "Logo de l'entreprise", en: 'Business logo' },
  'ent.choisirLogo': { fr: 'Choisir un logo…', en: 'Choose a logo…' },
  'ent.retirer': { fr: 'Retirer', en: 'Remove' },
  'ent.taxeEtIdentifiant': { fr: '{taxe} et identifiant fiscal', en: '{taxe} and tax identifier' },
  'ent.assujetti': { fr: 'Je suis assujetti à la {taxe}', en: 'I am registered for {taxe}' },
  'ent.assujettiOui': {
    fr: 'La {taxe} est facturée et détaillée sur les documents.',
    en: '{taxe} is charged and itemised on documents.'
  },
  'ent.assujettiNon': {
    fr: "Aucune {taxe} n'est facturée. La mention « {mention} » est imprimée sur les documents.",
    en: 'No {taxe} is charged. The notice “{mention}” is printed on documents.'
  },
  'ent.seuil': {
    fr: "Seuil indicatif d'assujettissement en {pays} : {seuil}.",
    en: 'Indicative registration threshold in {pays}: {seuil}.'
  },
  'ent.seuilVerifier': {
    fr: "À vérifier auprès de l'administration fiscale.",
    en: 'Check this with the tax authority.'
  },
  'ent.tauxParDefaut': { fr: 'Taux de {taxe} par défaut', en: 'Default {taxe} rate' },
  'ent.tauxEnVigueur': {
    fr: "Taux en vigueur en {pays} au moment de la rédaction de l'application.",
    en: 'Rates in force in {pays} when the application was written.'
  },
  'ent.tauxVerifier': {
    fr: "Vérifiez qu'ils sont toujours d'actualité.",
    en: 'Check that they are still current.'
  },
  'ent.conditionsTitre': { fr: 'Conditions générales et mentions', en: 'Terms and notices' },
  'ent.conditionsAide': {
    fr: 'Ce texte est imprimé au bas de vos factures et devis. Il encadre notamment la garantie et votre responsabilité.',
    en: 'This text is printed at the bottom of your invoices and quotes. It covers your warranty and your liability.',
  },
  'ent.conditionsAvertissement': {
    fr: "Attention : une clause ne peut pas exclure la responsabilité en cas de faute grave ou intentionnelle. Faites relire ce texte par un juriste avant de l'utiliser.",
    en: 'Careful: a clause cannot exclude liability for gross negligence or wilful misconduct. Have this text reviewed by a lawyer before using it.'
  },
  'ent.conditions': { fr: 'Conditions générales', en: 'Terms and conditions' },
  'ent.insererModele': { fr: 'Insérer un modèle de départ', en: 'Insert a starting template' },
  'ent.modeleEnFrancais': {
    fr: 'Le modèle est rédigé en français et suit les usages francophones.',
    en: 'The template is written in French and follows French-speaking practice.'
  },
  'ent.mentionsPied': { fr: 'Mentions de pied de page', en: 'Footer notices' },
  'ent.mentionsPiedExemple': {
    fr: 'Ex. : numéro de TVA intracommunautaire, assurance RC professionnelle, inscription au registre du commerce…',
    en: 'E.g. intra-EU VAT number, professional liability insurance, trade register entry…'
  },
} satisfies Record<string, Traduction>

export type CleTraduction = keyof typeof TEXTES

let langueCourante: Langue = 'fr'

export function definirLangue(langue: Langue): void {
  langueCourante = langue
}

export function langue(): Langue {
  return langueCourante
}

/**
 * Traduit une clé, en remplaçant `{nom}` par `valeurs.nom`.
 *
 * L'insertion de valeurs est nécessaire dès qu'une phrase cite un chiffre :
 * découper la phrase en morceaux à concaténer donnerait « Dans » + n + « j »,
 * qui ne se traduit pas — l'ordre des mots change d'une langue à l'autre.
 *
 * Repli sur le français si la traduction anglaise manque : l'interface reste
 * lisible pendant une traduction partielle. **Jamais l'inverse** — un français
 * manquant est un oubli, et `tests/traductions.mjs` le signale.
 */
export function t(cle: CleTraduction, valeurs?: Record<string, string | number>): string {
  const entree = TEXTES[cle]
  if (!entree) return cle
  const texte = langueCourante === 'en' ? entree.en || entree.fr : entree.fr
  if (!valeurs) return texte
  return texte.replace(/\{(\w+)\}/g, (entier, nom) =>
    nom in valeurs ? String(valeurs[nom]) : entier
  )
}

/**
 * La locale des dates et des heures, déduite de la langue de l'interface.
 *
 * **Elle vit ici parce qu'elle vivait à trois endroits.** `Accueil`, `Audit`,
 * `SuiviTemps` et `ParametresApp` formataient chacun leurs dates, et trois
 * d'entre eux écrivaient `fr-CH` en dur : un anglophone lisait « août 2026 » au
 * milieu d'un écran anglais. Le quatrième avait la bonne règle, recopiée.
 *
 * Une règle recopiée à quatre endroits se corrige à trois. C'est la règle de la
 * maison — *une formule = un seul endroit* — appliquée à un détail qui n'en a
 * pas l'air.
 */
export function locale(): string {
  return langueCourante === 'en' ? 'en-GB' : 'fr-CH'
}

/**
 * L'ordinal dans la langue de l'interface : « 2e rappel » ou « 2nd reminder ».
 *
 * **Le détail qui trahissait la traduction.** Le document imprimé était
 * entièrement traduit — sauf ce mot-là, qui restait français : un anglophone
 * recevait un « 2e reminder ». C'est exactement la même famille que
 * `toLocaleDateString('fr-CH')` en dur, et elle se cherche de la même façon,
 * en traduisant.
 *
 * Le choix vit ici parce que c'est ici qu'on sait quelle langue est affichée.
 * Les deux formules, elles, restent dans `calculs.ts` avec les autres.
 */
export function ordinal(nombre: number): string {
  return langueCourante === 'en' ? ordinalAnglais(nombre) : ordinalFrancais(nombre)
}

export const LANGUES: { code: Langue; nom: string }[] = [
  { code: 'fr', nom: 'Français' },
  { code: 'en', nom: 'English' }
]
