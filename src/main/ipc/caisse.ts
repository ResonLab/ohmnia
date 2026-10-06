import { ipcMain } from 'electron'
import { annulerVente, donneesTicket, listerVentes, totauxDuJour, vendre } from '../domaines/caisse'
import type { DemandeVenteCaisse } from '../../shared/types'

/** Branchement de la caisse sur la fenêtre. Logique : `../domaines/caisse.ts`. */
export function enregistrerHandlersCaisse(): void {
  ipcMain.handle('caisse:vendre', (_e, demande: DemandeVenteCaisse) => vendre(demande))

  ipcMain.handle('caisse:annuler', (_e, id: number) => annulerVente(id))

  ipcMain.handle('caisse:lister', (_e, date?: string) => listerVentes(date))

  ipcMain.handle('caisse:totaux', (_e, date: string) => totauxDuJour(date))

  ipcMain.handle('caisse:donneesTicket', (_e, id: number) => donneesTicket(id))
}
