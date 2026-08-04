import { ipcMain, shell } from 'electron'
import { getDb } from '../db/database'
import { tracerAudit } from '../db/audit'
import { URL_CONDITIONS, VERSION_CONDITIONS } from '../../shared/conditions'

/**
 * Acceptation des conditions d'utilisation de l'application.
 *
 * L'écran d'acceptation réapparaît si la version des conditions change :
 * accepter une ancienne version ne vaut pas acceptation de la nouvelle.
 */
export function enregistrerHandlersConditions(): void {
  ipcMain.handle('conditions:etat', () => {
    const ligne = getDb()
      .prepare('SELECT cgu_version, cgu_acceptee_le FROM parametres_app WHERE id = 1')
      .get() as { cgu_version: string; cgu_acceptee_le: string } | undefined

    const versionAcceptee = ligne?.cgu_version ?? ''
    return {
      versionCourante: VERSION_CONDITIONS,
      versionAcceptee,
      accepteeLe: ligne?.cgu_acceptee_le ?? '',
      doitAccepter: versionAcceptee !== VERSION_CONDITIONS
    }
  })

  ipcMain.handle('conditions:accepter', () => {
    getDb()
      .prepare("UPDATE parametres_app SET cgu_version = ?, cgu_acceptee_le = datetime('now') WHERE id = 1")
      .run(VERSION_CONDITIONS)

    tracerAudit('acceptation', 'conditions', VERSION_CONDITIONS, "Conditions d'utilisation acceptées")
    return VERSION_CONDITIONS
  })

  ipcMain.handle('conditions:ouvrirPage', async () => {
    // Ouverture dans le navigateur système : jamais dans une fenêtre de l'app.
    try {
      await shell.openExternal(URL_CONDITIONS)
    } catch {
      throw new Error(
        `Impossible d'ouvrir la page des conditions. Adresse : ${URL_CONDITIONS}`
      )
    }
  })

  ipcMain.handle('conditions:url', () => URL_CONDITIONS)
}
