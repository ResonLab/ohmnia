import { ipcMain } from 'electron'
import { verifierConformite } from '../domaines/conformite'

/** Branchement du panneau de conformité sur la fenêtre. Logique : `../domaines/conformite.ts`. */
export function enregistrerHandlersConformite(): void {
  ipcMain.handle('conformite:verifier', () => verifierConformite())
}
