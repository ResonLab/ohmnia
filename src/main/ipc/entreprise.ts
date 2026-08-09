import { app, ipcMain } from 'electron'
import { choisirFichier } from '../dialogues'
import { getDb } from '../db/database'
import { enregistrerEntreprise, lireEntreprise } from '../domaines/entreprise'
import type { Entreprise } from '../../shared/types'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'

/**
 * Branchement de la fiche entreprise sur la fenêtre.
 * Logique : `../domaines/entreprise.ts`. Ne reste ici que le logo : choisir un
 * fichier et le lire depuis le disque du poste.
 */

const EXTENSIONS_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

function versDataUrl(cheminAbsolu: string): string | null {
  const extension = extname(cheminAbsolu).toLowerCase()
  const mime = EXTENSIONS_MIME[extension]
  if (!mime || !existsSync(cheminAbsolu)) return null
  const contenu = readFileSync(cheminAbsolu).toString('base64')
  return `data:${mime};base64,${contenu}`
}

export function enregistrerHandlersEntreprise(): void {
  ipcMain.handle('entreprise:lire', () => lireEntreprise())

  ipcMain.handle('entreprise:lireLogoDataUrl', (_evenement, cheminAbsolu: string | null) => {
    if (!cheminAbsolu) return null
    return versDataUrl(cheminAbsolu)
  })

  ipcMain.handle('entreprise:choisirLogo', async () => {
    const resultat = await choisirFichier({
      title: 'Choisir un logo',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
      properties: ['openFile']
    })
    if (resultat.canceled || resultat.filePaths.length === 0) return null

    const fichierSource = resultat.filePaths[0]
    const extension = extname(fichierSource).toLowerCase()
    if (!EXTENSIONS_MIME[extension]) {
      throw new Error("Format d'image non pris en charge. Utilisez PNG, JPG, SVG ou WEBP.")
    }

    const dossierLogo = join(app.getPath('userData'), 'Logo')
    if (!existsSync(dossierLogo)) mkdirSync(dossierLogo, { recursive: true })
    const cheminDestination = join(dossierLogo, `logo${extension}`)
    copyFileSync(fichierSource, cheminDestination)

    getDb().prepare('UPDATE entreprise SET logo_path = ? WHERE id = 1').run(cheminDestination)

    return { logoPath: cheminDestination, dataUrl: versDataUrl(cheminDestination) }
  })

  ipcMain.handle('entreprise:enregistrer', (_evenement, valeurs: Entreprise) =>
    enregistrerEntreprise(valeurs)
  )
}
