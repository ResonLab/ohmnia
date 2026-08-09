import { ipcMain, shell } from 'electron'
import { choisirFichier } from '../dialogues'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { executer } from '../multipostes/routeur'
import {
  ajouterJustificatif,
  compterJustificatifsParEcriture,
  contenuJustificatif,
  listerJustificatifs,
  supprimerJustificatif
} from '../domaines/justificatifs'
import type { Justificatif } from '../../shared/types'

/** Justificatifs, côté données. Enregistré en mode local seulement. */
export function enregistrerHandlersJustificatifs(): void {
  ipcMain.handle('justificatifs:lister', (_e, journalId: number) => listerJustificatifs(journalId))

  ipcMain.handle('justificatifs:compterParEcriture', () => compterJustificatifsParEcriture())

  ipcMain.handle('justificatifs:ajouterFichier', (_e, journalId: number, nom: string, contenu: string) =>
    ajouterJustificatif(journalId, nom, contenu)
  )

  ipcMain.handle('justificatifs:contenu', (_e, nomFichier: string) => contenuJustificatif(nomFichier))

  ipcMain.handle('justificatifs:supprimer', (_e, id: number) => supprimerJustificatif(id))
}

/**
 * Les justificatifs côté poste : choisir les fichiers, les ouvrir.
 * Enregistré dans les deux modes.
 *
 * Le poste ne range plus rien lui-même : il lit le fichier choisi et l'envoie
 * là où vit la base. En multi-postes, le justificatif atterrit donc sur le
 * serveur et le collègue d'à côté le voit — ce qui n'était pas le cas avant.
 */
export function enregistrerHandlersJustificatifsPoste(): void {
  ipcMain.handle('justificatifs:ajouter', async (_e, journalId: number) => {
    const resultat = await choisirFichier({
      title: 'Choisir un justificatif',
      filters: [{ name: 'Images et PDF', extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (resultat.canceled || resultat.filePaths.length === 0) return []

    const ajoutes: Justificatif[] = []
    for (const source of resultat.filePaths) {
      // Le contrôle de format et de taille est fait là où le fichier est rangé :
      // un seul endroit décide, et le message est le même dans les deux modes.
      const contenu = readFileSync(source).toString('base64')
      ajoutes.push(
        (await executer(
          'justificatifs:ajouterFichier',
          journalId,
          basename(source),
          contenu
        )) as Justificatif
      )
    }
    return ajoutes
  })

  /** Renvoie le fichier en data URL pour l'afficher directement dans l'interface. */
  ipcMain.handle('justificatifs:lireDataUrl', (_e, nomFichier: string) =>
    executer('justificatifs:contenu', nomFichier)
  )

  /**
   * Ouvrir le fichier avec l'application du système. En multi-postes il n'est
   * pas sur ce disque : on en dépose une copie temporaire, puisqu'aucun
   * lecteur de PDF ne sait ouvrir une data URL.
   */
  ipcMain.handle('justificatifs:ouvrir', async (_e, nomFichier: string) => {
    const dataUrl = (await executer('justificatifs:contenu', nomFichier)) as string | null
    if (!dataUrl) throw new Error("Ce justificatif est introuvable : le fichier a été déplacé ou supprimé.")

    const dossier = join(tmpdir(), 'ohmnia-justificatifs')
    if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true })

    const chemin = join(dossier, `${Date.now()}${extname(nomFichier).toLowerCase()}`)
    writeFileSync(chemin, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'))

    const erreur = await shell.openPath(chemin)
    if (erreur) throw new Error(`Impossible d'ouvrir le fichier : ${erreur}`)
  })
}
