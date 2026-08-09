import { ipcMain } from 'electron'
import { donneesDocument, type TypeDocument } from '../domaines/documents'

/**
 * Données à imprimer, par canal.
 *
 * Ce canal existe pour que l'impression fonctionne aussi en mode multi-postes :
 * les données viennent alors du serveur, exactement les mêmes qu'en local.
 * La fabrication du PDF, elle, reste dans `../pdf.ts` — elle a besoin d'une
 * fenêtre Electron.
 */
export function enregistrerHandlersDocuments(): void {
  ipcMain.handle('documents:donnees', (_e, type: TypeDocument, id: number, rappelId?: number) =>
    donneesDocument(type, id, rappelId)
  )
}
