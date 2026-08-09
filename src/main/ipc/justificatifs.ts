import { app, ipcMain, shell } from 'electron'
import { choisirFichier } from '../dialogues'
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { extname, join } from 'node:path'
import { getDb } from '../db/database'
import { tracerAudit } from '../db/audit'
import { exigerModeLocal } from '../multipostes/routeur'
import {
  compterJustificatifsParEcriture,
  listerJustificatifs
} from '../domaines/justificatifs'
import type { Justificatif } from '../../shared/types'

const EXTENSIONS_ACCEPTEES = ['.png', '.jpg', '.jpeg', '.webp', '.pdf']

const MIME_PAR_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf'
}

/** Les justificatifs vivent avec la base, donc ils sont inclus dans les sauvegardes du dossier. */
function dossierJustificatifs(): string {
  const dossier = join(app.getPath('userData'), 'Justificatifs')
  if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true })
  return dossier
}

interface LigneJustificatif {
  id: number
  journal_id: number
  nom_fichier: string
  ajoute_le: string
}

function versJustificatif(ligne: LigneJustificatif): Justificatif {
  return {
    id: ligne.id,
    journalId: ligne.journal_id,
    nomFichier: ligne.nom_fichier,
    ajouteLe: ligne.ajoute_le
  }
}

/** Refuse tout nom de fichier qui pourrait sortir du dossier des justificatifs. */
function cheminSecurise(nomFichier: string): string {
  if (nomFichier.includes('/') || nomFichier.includes('\\') || nomFichier.includes('..')) {
    throw new Error('Nom de fichier invalide.')
  }
  return join(dossierJustificatifs(), nomFichier)
}

/** Justificatifs, côté données. Enregistré en mode local seulement. */
export function enregistrerHandlersJustificatifs(): void {
  ipcMain.handle('justificatifs:lister', (_e, journalId: number) => listerJustificatifs(journalId))

  ipcMain.handle('justificatifs:compterParEcriture', () => compterJustificatifsParEcriture())
}

/**
 * Les fichiers eux-mêmes, côté poste. Enregistré dans les deux modes.
 *
 * **Refusés en multi-postes, volontairement.** Les fichiers vivent à côté de
 * la base : sur le serveur. Les copier depuis un poste écrirait dans le
 * dossier du poste, et le collègue d'à côté ne verrait rien — un justificatif
 * qu'on croit rangé et qui n'existe nulle part est pire que pas de
 * justificatif. Les rendre accessibles suppose de les faire transiter par le
 * protocole ; c'est écrit dans CONTEXTE.md comme le prochain chantier.
 */
export function enregistrerHandlersJustificatifsPoste(): void {
  ipcMain.handle('justificatifs:ajouter', async (_e, journalId: number) => {
    exigerModeLocal('Joindre un justificatif')

    const ecriture = getDb().prepare('SELECT id FROM journal WHERE id = ?').get(journalId)
    if (!ecriture) throw new Error("Cette écriture du Journal n'existe pas.")

    const resultat = await choisirFichier({
      title: 'Choisir un justificatif',
      filters: [{ name: 'Images et PDF', extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (resultat.canceled || resultat.filePaths.length === 0) return []

    const ajoutes: Justificatif[] = []
    for (const source of resultat.filePaths) {
      const extension = extname(source).toLowerCase()
      if (!EXTENSIONS_ACCEPTEES.includes(extension)) {
        throw new Error(
          `Format non pris en charge (${extension}). Utilise PNG, JPG, WEBP ou PDF.`
        )
      }

      // Nom unique : pas de collision si deux tickets ont le même nom d'origine.
      const nomFichier = `j${journalId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`
      copyFileSync(source, join(dossierJustificatifs(), nomFichier))

      const insertion = getDb()
        .prepare('INSERT INTO justificatifs (journal_id, nom_fichier) VALUES (?, ?)')
        .run(journalId, nomFichier)
      const ligne = getDb()
        .prepare('SELECT * FROM justificatifs WHERE id = ?')
        .get(insertion.lastInsertRowid) as unknown as LigneJustificatif
      ajoutes.push(versJustificatif(ligne))
    }

    tracerAudit('ajout', 'justificatif', String(journalId), `${ajoutes.length} fichier(s)`)
    return ajoutes
  })

  /** Renvoie le fichier en data URL pour l'afficher directement dans l'interface. */
  ipcMain.handle('justificatifs:lireDataUrl', (_e, nomFichier: string) => {
    const chemin = cheminSecurise(nomFichier)
    if (!existsSync(chemin)) return null

    const mime = MIME_PAR_EXTENSION[extname(nomFichier).toLowerCase()]
    if (!mime) return null
    return `data:${mime};base64,${readFileSync(chemin).toString('base64')}`
  })

  ipcMain.handle('justificatifs:ouvrir', async (_e, nomFichier: string) => {
    exigerModeLocal('Ouvrir un justificatif')
    const erreur = await shell.openPath(cheminSecurise(nomFichier))
    if (erreur) throw new Error(`Impossible d'ouvrir le fichier : ${erreur}`)
  })

  ipcMain.handle('justificatifs:supprimer', (_e, id: number) => {
    exigerModeLocal('Supprimer un justificatif')
    const ligne = getDb().prepare('SELECT nom_fichier FROM justificatifs WHERE id = ?').get(id) as
      | { nom_fichier: string }
      | undefined
    if (!ligne) return

    getDb().prepare('DELETE FROM justificatifs WHERE id = ?').run(id)

    // Le fichier n'est retiré du disque qu'après la suppression en base réussie.
    const chemin = cheminSecurise(ligne.nom_fichier)
    if (existsSync(chemin)) unlinkSync(chemin)
  })
}
