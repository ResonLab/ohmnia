import { ipcMain } from 'electron'
import { rechercheGlobale } from '../domaines/recherche'

/** Branchement de la recherche globale sur la fenêtre. Logique : `../domaines/recherche.ts`. */
export function enregistrerHandlersRecherche(): void {
  ipcMain.handle('recherche:globale', (_e, terme: string) => rechercheGlobale(terme))
}
