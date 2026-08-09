import { app, ipcMain, shell } from 'electron'
import { choisirFichier, choisirDestination } from '../dialogues'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fermerBaseDeDonnees, getDb, ouvrirBaseDeDonnees } from '../db/database'
import {
  restaurerDepuisFichierChiffre,
  sauvegarderVersDossierExterne
} from '../db/sauvegardeExterne'
import {
  exporterToutesLesDonnees,
  listerSauvegardes,
  restaurerSauvegarde,
  sauvegarderBaseDeDonnees
} from '../db/backup'
import { cheminBase, dossierSauvegardes } from '../contexte'
// La partie qui ne depend pas d'Electron vit dans domaines/ et sert aussi au serveur.
import { lireParametresApp, validerParametresApp } from '../domaines/parametresApp'
import type { InfosSysteme, ParametresApp } from '../../shared/types'

export { lireParametresApp }

/** Dossier où sont rangés les PDF : celui choisi par l'utilisateur, sinon Documents/Ohmnia. */
export function dossierDocumentsEffectif(): string {
  const params = lireParametresApp()
  return params.dossierDocuments ?? join(app.getPath('documents'), 'Ohmnia')
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
    const resultat = await choisirFichier({
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
    const resultat = await choisirFichier({
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
    const resultat = await choisirFichier({
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
    const resultat = await choisirDestination({
      title: 'Exporter toutes les données',
      defaultPath: join(app.getPath('documents'), defaut),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (resultat.canceled || !resultat.filePath) return null

    exporterToutesLesDonnees(resultat.filePath)
    return resultat.filePath
  })
}
