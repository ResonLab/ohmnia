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
  'action.enregistrer': { fr: 'Enregistrer', en: 'Save' },
  'action.annuler': { fr: 'Annuler', en: 'Cancel' },
  'action.supprimer': { fr: 'Supprimer', en: 'Delete' },
  'action.ouvrir': { fr: 'Ouvrir', en: 'Open' },
  'action.dupliquer': { fr: 'Dupliquer', en: 'Duplicate' },
  'action.ajouter': { fr: 'Ajouter', en: 'Add' },
  'action.creer': { fr: 'Créer', en: 'Create' },
  'action.retirer': { fr: 'Retirer', en: 'Remove' },
  'action.exporterPdf': { fr: 'Exporter en PDF', en: 'Export as PDF' },
  'action.choisir': { fr: 'Choisir', en: 'Choose' },
  'etat.chargement': { fr: 'Chargement…', en: 'Loading…' },
  'etat.erreurInconnue': { fr: 'Erreur inconnue.', en: 'Unknown error.' },

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
  'doc.fraisRappel': { fr: 'Frais de rappel', en: 'Reminder fee' },
  'doc.fraisImpression': {
    fr: "Frais d'impression et d'envoi",
    en: 'Printing and mailing fee'
  },
  'doc.rappelNiveau': { fr: 'rappel', en: 'reminder' },

  // --- Paramètres de l'application ---
  'param.langue': { fr: 'Langue', en: 'Language' },
  'param.langueAide': {
    fr: "Change la langue de l'interface et des documents imprimés.",
    en: 'Changes the language of the interface and printed documents.'
  },
  'param.apparence': { fr: 'Apparence', en: 'Appearance' },
  'param.theme': { fr: 'Thème', en: 'Theme' },
  'param.themeSombre': { fr: 'Sombre', en: 'Dark' },
  'param.themeClair': { fr: 'Clair', en: 'Light' },
  'param.themeAuto': { fr: 'Automatique (suit Windows)', en: 'Automatic (follows Windows)' },
  'param.couleurAccent': { fr: "Couleur d'accent", en: 'Accent colour' }
} satisfies Record<string, Traduction>

export type CleTraduction = keyof typeof TEXTES

let langueCourante: Langue = 'fr'

export function definirLangue(langue: Langue): void {
  langueCourante = langue
}

export function langue(): Langue {
  return langueCourante
}

/** Traduit une clé. Repli sur le français si la traduction anglaise manque. */
export function t(cle: CleTraduction): string {
  const entree = TEXTES[cle]
  if (!entree) return cle
  return langueCourante === 'en' ? entree.en || entree.fr : entree.fr
}

export const LANGUES: { code: Langue; nom: string }[] = [
  { code: 'fr', nom: 'Français' },
  { code: 'en', nom: 'English' }
]
