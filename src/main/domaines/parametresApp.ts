import { getDb } from '../db/database'
import type { ParametresApp, Theme } from '../../shared/types'

/**
 * Paramètres de l'application — la partie qui ne dépend pas d'Electron.
 *
 * Ce qui reste dans `../ipc/parametresApp.ts` : tout ce qui a besoin d'une
 * fenêtre ou du système — sélecteurs de dossier, ouverture de l'explorateur,
 * chemin des documents. Rien de tout cela n'a de sens sur un serveur.
 */

interface LigneParametresApp {
  dossier_documents: string | null
  nb_sauvegardes: number
  theme: Theme
  langue: string
  couleur_accent: string
  delai_paiement_defaut: number
  validite_devis_defaut: number
  seuil_alerte_facture_jours: number
}

function versParametresApp(ligne: LigneParametresApp): ParametresApp {
  return {
    dossierDocuments: ligne.dossier_documents,
    nbSauvegardes: ligne.nb_sauvegardes,
    theme: ligne.theme,
    langue: ligne.langue,
    couleurAccent: ligne.couleur_accent,
    delaiPaiementDefaut: ligne.delai_paiement_defaut,
    validiteDevisDefaut: ligne.validite_devis_defaut,
    seuilAlerteFactureJours: ligne.seuil_alerte_facture_jours
  }
}

export function lireParametresApp(): ParametresApp {
  const ligne = getDb()
    .prepare('SELECT * FROM parametres_app WHERE id = 1')
    .get() as unknown as LigneParametresApp
  return versParametresApp(ligne)
}

export function validerParametresApp(valeurs: ParametresApp): string | null {
  if (valeurs.nbSauvegardes < 1 || valeurs.nbSauvegardes > 500) {
    return 'Le nombre de sauvegardes conservées doit être compris entre 1 et 500.'
  }
  if (!['sombre', 'clair', 'auto'].includes(valeurs.theme)) return 'Thème inconnu.'
  if (!['fr', 'en'].includes(valeurs.langue)) return 'Langue inconnue.'
  if (!/^#[0-9a-fA-F]{6}$/.test(valeurs.couleurAccent)) {
    return "La couleur d'accent doit être au format hexadécimal (exemple : #1be7b6)."
  }
  if (valeurs.delaiPaiementDefaut < 0 || valeurs.delaiPaiementDefaut > 365) {
    return 'Le délai de paiement par défaut doit être compris entre 0 et 365 jours.'
  }
  if (valeurs.validiteDevisDefaut < 0 || valeurs.validiteDevisDefaut > 365) {
    return 'La validité des devis par défaut doit être comprise entre 0 et 365 jours.'
  }
  if (valeurs.seuilAlerteFactureJours < 1 || valeurs.seuilAlerteFactureJours > 365) {
    return "Le seuil d'alerte des factures doit être compris entre 1 et 365 jours."
  }
  return null
}
