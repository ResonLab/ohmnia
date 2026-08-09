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
import { lireParametresApp, verifierIntegrite } from '../domaines/parametresApp'
import { estModeServeur, exigerModeLocal } from '../multipostes/routeur'
import type { InfosSysteme } from '../../shared/types'

export { lireParametresApp }

/**
 * Dossier où sont rangés les PDF : celui choisi par l'utilisateur, sinon
 * Documents/Ohmnia.
 *
 * **En multi-postes, le réglage partagé est ignoré.** C'est un chemin de
 * fichier : celui du serveur ne veut rien dire ici, et écrire les PDF d'un
 * collègue dans son arborescence à lui échouerait sans qu'on comprenne
 * pourquoi. Chaque poste range donc ses PDF chez lui.
 */
export function dossierDocumentsEffectif(): string {
  const defaut = join(app.getPath('documents'), 'Ohmnia')
  if (estModeServeur()) return defaut
  return lireParametresApp().dossierDocuments ?? defaut
}

/**
 * Réglages de l'application, côté données. Enregistré en mode local seulement.
 *
 * `parametresApp:lire` et `:enregistrer` n'y sont pas : ils passent par
 * `enregistrerHandlersApparence()`, qui doit intercepter les deux modes pour
 * garder le thème et la langue sur le poste. Voir `multipostes/handlers.ts`.
 */
export function enregistrerHandlersParametresApp(): void {
  ipcMain.handle('parametresApp:verifierIntegrite', () => verifierIntegrite())
}

/**
 * Ce qui concerne cette machine-ci : dossiers, sauvegardes locales, infos
 * système. Enregistré dans les deux modes.
 *
 * **Les sauvegardes sont refusées en multi-postes.** Sauvegarder depuis un
 * poste ne copierait que sa base locale — vide. Les données sont sur le
 * serveur, donc les sauvegardes aussi.
 */
export function enregistrerHandlersParametresAppPoste(): void {
  ipcMain.handle('parametresApp:choisirDossierDocuments', async () => {
    exigerModeLocal('Choisir le dossier des PDF')
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
    exigerModeLocal('Réinitialiser le dossier des PDF')
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
    // En multi-postes, la base locale n'est pas ouverte : annoncer sa taille et
    // un nombre de sauvegardes ferait croire que les données sont ici.
    const surServeur = estModeServeur()
    return {
      version: app.getVersion(),
      versionElectron: process.versions.electron,
      versionNode: process.versions.node,
      dossierDonnees: app.getPath('userData'),
      cheminBase: surServeur ? 'Sur le serveur multi-postes' : chemin,
      tailleBaseOctets: surServeur || !existsSync(chemin) ? 0 : statSync(chemin).size,
      dossierDocumentsEffectif: dossierDocumentsEffectif(),
      nbSauvegardes: surServeur ? 0 : listerSauvegardes().length,
      dossierSauvegardes: surServeur ? 'Sur le serveur multi-postes' : dossierSauvegardes()
    } satisfies InfosSysteme
  })

  ipcMain.handle('sauvegardes:lister', () => (estModeServeur() ? [] : listerSauvegardes()))

  ipcMain.handle('sauvegardes:creer', () => {
    exigerModeLocal('Créer une sauvegarde')
    const chemin = sauvegarderBaseDeDonnees()
    if (!chemin) throw new Error("Aucune base de données à sauvegarder pour l'instant.")
    return chemin
  })

  ipcMain.handle('sauvegardes:restaurer', (_e, nomFichier: string) => {
    exigerModeLocal('Restaurer une sauvegarde')
    restaurerSauvegarde(nomFichier)
  })

  ipcMain.handle('sauvegardeExterne:choisirDossier', async () => {
    exigerModeLocal('Choisir un dossier de sauvegarde externe')
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
    if (estModeServeur()) return null
    const ligne = getDb()
      .prepare('SELECT dossier_sauvegarde_externe FROM parametres_app WHERE id = 1')
      .get() as { dossier_sauvegarde_externe: string | null }
    return ligne.dossier_sauvegarde_externe
  })

  ipcMain.handle('sauvegardeExterne:sauvegarder', (_e, motDePasse: string) => {
    exigerModeLocal('Sauvegarder vers un support externe')
    const ligne = getDb()
      .prepare('SELECT dossier_sauvegarde_externe FROM parametres_app WHERE id = 1')
      .get() as { dossier_sauvegarde_externe: string | null }
    if (!ligne.dossier_sauvegarde_externe) {
      throw new Error("Choisis d'abord un dossier de sauvegarde externe.")
    }
    return sauvegarderVersDossierExterne(ligne.dossier_sauvegarde_externe, motDePasse)
  })

  ipcMain.handle('sauvegardeExterne:restaurer', async (_e, motDePasse: string) => {
    exigerModeLocal('Restaurer une sauvegarde chiffrée')
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
    exigerModeLocal('Exporter toutes les données')
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
