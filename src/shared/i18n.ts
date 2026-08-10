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

  // --- Paramètres de l'application ---
  'param.langue': { fr: 'Langue', en: 'Language' },
  'param.langueAide': {
    fr: "Change la langue de l'interface et des documents imprimés.",
    en: 'Changes the language of the interface and printed documents.'
  },
  'param.apparence': { fr: 'Apparence', en: 'Appearance' },
  'param.theme': { fr: 'Thème', en: 'Theme' },
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

export const LANGUES: { code: Langue; nom: string }[] = [
  { code: 'fr', nom: 'Français' },
  { code: 'en', nom: 'English' }
]
