import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { sauvegarderBaseDeDonnees } from './db/backup'
import { dossierDocumentsEffectif } from './ipc/parametresApp'
import { estModeServeur, executer } from './multipostes/routeur'
import type { TypeDocument } from './domaines/documents'
import type { DocumentImpression } from '../shared/types'

/**
 * Fabrication des PDF. **Côté poste, dans les deux modes** : c'est cette
 * machine-ci qui imprime, avec sa fenêtre Electron et son dossier de sortie.
 *
 * Les *données* du document, elles, viennent de `documents:donnees` — de la
 * base locale ou du serveur, selon le mode. Sans ce détour, un PDF imprimé
 * depuis un poste multi-postes serait vide : le code lisait la base locale.
 */

function donneesDuDocument(
  type: TypeDocument,
  id: number,
  rappelId?: number
): Promise<DocumentImpression> {
  return executer('documents:donnees', type, id, rappelId) as Promise<DocumentImpression>
}

async function genererPdf(type: TypeDocument, id: number, rappelId?: number): Promise<string> {
  const donnees = await donneesDuDocument(type, id, rappelId)

  // Sauvegarde de sécurité avant toute opération d'export. En multi-postes il
  // n'y a pas de base locale à sauvegarder : c'est l'affaire du serveur.
  if (!estModeServeur()) sauvegarderBaseDeDonnees()

  const fenetre = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Le renderer signale quand le document est peint. Le délai maximal évite
  // que l'export reste bloqué indéfiniment si le rendu échoue.
  const attendrePret = new Promise<void>((resolve) => {
    const surPret = (): void => {
      clearTimeout(delaiMax)
      resolve()
    }
    const delaiMax = setTimeout(() => {
      ipcMain.removeListener('pdf:pret', surPret)
      resolve()
    }, 5000)
    ipcMain.once('pdf:pret', surPret)
  })

  const hash =
    `imprimer?type=${type}&id=${id}` + (rappelId !== undefined ? `&rappelId=${rappelId}` : '')
  let buffer: Buffer
  try {
    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      await fenetre.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
    } else {
      await fenetre.loadFile(join(__dirname, '../renderer/index.html'), { hash })
    }

    await attendrePret
    buffer = await fenetre.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    })
  } finally {
    // La fenêtre invisible est toujours refermée, même en cas d'erreur.
    if (!fenetre.isDestroyed()) fenetre.close()
  }

  const sousDossiers = { facture: 'Factures', devis: 'Devis', rappel: 'Rappels' } as const
  const dossier = join(dossierDocumentsEffectif(), sousDossiers[type])
  if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true })

  const nomFichier =
    type === 'rappel' ? `${donnees.numero}-rappel${donnees.rappelNiveau}.pdf` : `${donnees.numero}.pdf`
  const cheminFichier = join(dossier, nomFichier)
  writeFileSync(cheminFichier, buffer)
  return cheminFichier
}

export function enregistrerHandlersPdf(): void {
  ipcMain.handle('pdf:donnees', (_e, type: TypeDocument, id: number, rappelId?: number) =>
    donneesDuDocument(type, id, rappelId)
  )

  ipcMain.handle('pdf:generer', (_e, type: TypeDocument, id: number, rappelId?: number) =>
    genererPdf(type, id, rappelId)
  )
}
