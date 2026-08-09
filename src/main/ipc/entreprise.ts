import { ipcMain } from 'electron'
import { choisirFichier } from '../dialogues'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import {
  definirLogo,
  enregistrerEntreprise,
  lireEntreprise,
  lireLogo,
  retirerLogo
} from '../domaines/entreprise'
import { executer } from '../multipostes/routeur'
import type { Entreprise } from '../../shared/types'

/** Fiche entreprise, côté données. Enregistré en mode local seulement. */
export function enregistrerHandlersEntreprise(): void {
  ipcMain.handle('entreprise:lire', () => lireEntreprise())

  ipcMain.handle('entreprise:enregistrer', (_evenement, valeurs: Entreprise) =>
    enregistrerEntreprise(valeurs)
  )

  ipcMain.handle('entreprise:logo', () => lireLogo())

  ipcMain.handle('entreprise:definirLogo', (_e, nomFichier: string, contenu: string) =>
    definirLogo(nomFichier, contenu)
  )

  ipcMain.handle('entreprise:retirerLogo', () => retirerLogo())
}

/**
 * Le choix du logo, côté poste : ouvrir le sélecteur, lire le fichier.
 * Enregistré dans les deux modes.
 *
 * Le poste ne mémorise plus de chemin : il envoie l'image, qui est rangée dans
 * la base. Elle suit donc les données — visible depuis tous les postes, et
 * comprise dans les sauvegardes.
 */
export function enregistrerHandlersEntreprisePoste(): void {
  ipcMain.handle('entreprise:lireLogoDataUrl', () => executer('entreprise:logo'))

  ipcMain.handle('entreprise:choisirLogo', async () => {
    const resultat = await choisirFichier({
      title: 'Choisir un logo',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
      properties: ['openFile']
    })
    if (resultat.canceled || resultat.filePaths.length === 0) return null

    const source = resultat.filePaths[0]
    // Format et taille sont contrôlés là où l'image est rangée : un seul
    // endroit décide, et le message est le même dans les deux modes.
    const dataUrl = (await executer(
      'entreprise:definirLogo',
      basename(source),
      readFileSync(source).toString('base64')
    )) as string

    return { dataUrl }
  })

  ipcMain.handle('entreprise:retirerLogoChoisi', () => executer('entreprise:retirerLogo'))
}
