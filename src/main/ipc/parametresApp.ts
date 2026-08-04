import { app, dialog, ipcMain, shell } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fermerBaseDeDonnees, getDb, ouvrirBaseDeDonnees } from '../db/database'
import {
  restaurerDepuisFichierChiffre,
  sauvegarderVersDossierExterne
} from '../db/sauvegardeExterne'
import {
  cheminBase,
  dossierSauvegardes,
  exporterToutesLesDonnees,
  listerSauvegardes,
  restaurerSauvegarde,
  sauvegarderBaseDeDonnees
} from '../db/backup'
import type { InfosSysteme, ParametresApp, Theme } from '../../shared/types'

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

/** Dossier où sont rangés les PDF : celui choisi par l'utilisateur, sinon Documents/Ohmnia. */
export function dossierDocumentsEffectif(): string {
  const params = lireParametresApp()
  return params.dossierDocuments ?? join(app.getPath('documents'), 'Ohmnia')
}

function validerParametresApp(valeurs: ParametresApp): string | null {
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

export function enregistrerHandlersParametresApp(): void {
  ipcMain.handle('parametresApp:lire', () => lireParametresApp())

  ipcMain.handle('parametresApp:enregistrer', (_e, valeurs: ParametresApp) => {
    const erreur = validerParametresApp(valeurs)
    if (erreur) throw new Error(erreur)

    getDb()
      .prepare(
        `UPDATE parametres_app SET
          dossier_documents = ?, nb_sauvegardes = ?, theme = ?, langue = ?, couleur_accent = ?,
          delai_paiement_defaut = ?, validite_devis_defaut = ?, seuil_alerte_facture_jours = ?
         WHERE id = 1`
      )
      .run(
        valeurs.dossierDocuments,
        valeurs.nbSauvegardes,
        valeurs.theme,
        valeurs.langue,
        valeurs.couleurAccent,
        valeurs.delaiPaiementDefaut,
        valeurs.validiteDevisDefaut,
        valeurs.seuilAlerteFactureJours
      )
    return lireParametresApp()
  })

  ipcMain.handle('parametresApp:choisirDossierDocuments', async () => {
    const resultat = await dialog.showOpenDialog({
      title: 'Choisir le dossier où ranger les PDF',
      properties: ['openDirectory', 'createDirectory']
    })
    if (resultat.canceled || resultat.filePaths.length === 0) return null

    const dossier = resultat.filePaths[0]
    getDb().prepare('UPDATE parametres_app SET dossier_documents = ? WHERE id = 1').run(dossier)
    return dossier
  })

  ipcMain.handle('parametresApp:reinitialiserDossierDocuments', () => {
    getDb().prepare('UPDATE parametres_app SET dossier_documents = NULL WHERE id = 1').run()
    return dossierDocumentsEffectif()
  })

  ipcMain.handle('parametresApp:ouvrirDossier', async (_e, cible: 'documents' | 'donnees' | 'sauvegardes') => {
    const chemins: Record<typeof cible, string> = {
      documents: dossierDocumentsEffectif(),
      donnees: app.getPath('userData'),
      sauvegardes: dossierSauvegardes()
    }
    const chemin = chemins[cible]
    const erreur = await shell.openPath(chemin)
    if (erreur) throw new Error(`Impossible d'ouvrir le dossier : ${erreur}`)
  })

  ipcMain.handle('parametresApp:infosSysteme', () => {
    const chemin = cheminBase()
    return {
      version: app.getVersion(),
      versionElectron: process.versions.electron,
      versionNode: process.versions.node,
      dossierDonnees: app.getPath('userData'),
      cheminBase: chemin,
      tailleBaseOctets: existsSync(chemin) ? statSync(chemin).size : 0,
      dossierDocumentsEffectif: dossierDocumentsEffectif(),
      nbSauvegardes: listerSauvegardes().length,
      dossierSauvegardes: dossierSauvegardes()
    } satisfies InfosSysteme
  })

  ipcMain.handle('parametresApp:verifierIntegrite', () => {
    const resultat = getDb().prepare('PRAGMA integrity_check').get() as { integrity_check: string }
    return resultat.integrity_check
  })

  ipcMain.handle('sauvegardes:lister', () => listerSauvegardes())

  ipcMain.handle('sauvegardes:creer', () => {
    const chemin = sauvegarderBaseDeDonnees()
    if (!chemin) throw new Error("Aucune base de données à sauvegarder pour l'instant.")
    return chemin
  })

  ipcMain.handle('sauvegardes:restaurer', (_e, nomFichier: string) => {
    restaurerSauvegarde(nomFichier)
  })

  ipcMain.handle('sauvegardeExterne:choisirDossier', async () => {
    const resultat = await dialog.showOpenDialog({
      title: 'Choisir le dossier de sauvegarde externe (clé USB, disque…)',
      properties: ['openDirectory', 'createDirectory']
    })
    if (resultat.canceled || resultat.filePaths.length === 0) return null

    const dossier = resultat.filePaths[0]
    getDb().prepare('UPDATE parametres_app SET dossier_sauvegarde_externe = ? WHERE id = 1').run(dossier)
    return dossier
  })

  ipcMain.handle('sauvegardeExterne:lireDossier', () => {
    const ligne = getDb()
      .prepare('SELECT dossier_sauvegarde_externe FROM parametres_app WHERE id = 1')
      .get() as { dossier_sauvegarde_externe: string | null }
    return ligne.dossier_sauvegarde_externe
  })

  ipcMain.handle('sauvegardeExterne:sauvegarder', (_e, motDePasse: string) => {
    const ligne = getDb()
      .prepare('SELECT dossier_sauvegarde_externe FROM parametres_app WHERE id = 1')
      .get() as { dossier_sauvegarde_externe: string | null }
    if (!ligne.dossier_sauvegarde_externe) {
      throw new Error("Choisis d'abord un dossier de sauvegarde externe.")
    }
    return sauvegarderVersDossierExterne(ligne.dossier_sauvegarde_externe, motDePasse)
  })

  ipcMain.handle('sauvegardeExterne:restaurer', async (_e, motDePasse: string) => {
    const resultat = await dialog.showOpenDialog({
      title: 'Choisir une sauvegarde chiffrée Ohmnia',
      filters: [{ name: 'Sauvegarde Ohmnia', extensions: ['ohmnia'] }],
      properties: ['openFile']
    })
    if (resultat.canceled || resultat.filePaths.length === 0) return null

    // Filet de sécurité : l'état actuel est sauvegardé localement avant l'écrasement.
    sauvegarderBaseDeDonnees()
    fermerBaseDeDonnees()
    try {
      restaurerDepuisFichierChiffre(resultat.filePaths[0], motDePasse)
    } finally {
      // La base est toujours réouverte, même si la restauration a échoué.
      ouvrirBaseDeDonnees()
    }
    return resultat.filePaths[0]
  })

  ipcMain.handle('donnees:exporterTout', async () => {
    const defaut = `ohmnia-export-${new Date().toISOString().slice(0, 10)}.json`
    const resultat = await dialog.showSaveDialog({
      title: 'Exporter toutes les données',
      defaultPath: join(app.getPath('documents'), defaut),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (resultat.canceled || !resultat.filePath) return null

    exporterToutesLesDonnees(resultat.filePath)
    return resultat.filePath
  })
}
