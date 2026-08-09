import { ipcMain, shell } from 'electron'
import { accepterConditions, etatConditions, urlConditions } from '../domaines/conditions'
import { URL_CONDITIONS } from '../../shared/conditions'

/**
 * Branchement des conditions d'utilisation sur la fenêtre.
 * Logique : `../domaines/conditions.ts`. Seule l'ouverture de la page reste ici :
 * elle a besoin du navigateur du poste.
 */
export function enregistrerHandlersConditions(): void {
  ipcMain.handle('conditions:etat', () => etatConditions())

  ipcMain.handle('conditions:accepter', () => accepterConditions())

  ipcMain.handle('conditions:url', () => urlConditions())
}

/** Ouvrir la page dans le navigateur : c'est le poste qui le fait, dans les deux modes. */
export function enregistrerHandlersConditionsPoste(): void {
  ipcMain.handle('conditions:ouvrirPage', async () => {
    // Ouverture dans le navigateur système : jamais dans une fenêtre de l'app.
    try {
      await shell.openExternal(URL_CONDITIONS)
    } catch {
      throw new Error(`Impossible d'ouvrir la page des conditions. Adresse : ${URL_CONDITIONS}`)
    }
  })
}
