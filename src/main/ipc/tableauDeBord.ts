import { ipcMain } from 'electron'
import { chargerTableauDeBord } from '../domaines/tableauDeBord'

/** Branchement du tableau de bord. Logique dans `../domaines/tableauDeBord.ts`. */
export function enregistrerHandlersTableauDeBord(): void {
  ipcMain.handle('tableauDeBord:charger', () => chargerTableauDeBord())
}
