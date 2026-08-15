import { ipcMain } from 'electron'
import {
  changerStatutDevis,
  chargerDetailDevis,
  creerBrouillonDevis,
  dupliquerDevis,
  enregistrerDevis,
  historiqueDevis,
  supprimerDevis
} from '../domaines/devis'
import type { Devis, DevisDetail } from '../../shared/types'

/** Branchement des devis sur la fenêtre. Logique : `../domaines/devis.ts`. */
export function enregistrerHandlersDevis(): void {

  ipcMain.handle('devis:creerBrouillon', (_e, clientId: number) => creerBrouillonDevis(clientId))

  ipcMain.handle('devis:obtenirDetail', (_e, id: number) => chargerDetailDevis(id))

  ipcMain.handle('devis:dupliquer', (_e, id: number) => dupliquerDevis(id))

  ipcMain.handle('devis:enregistrer', (_e, detail: DevisDetail) => enregistrerDevis(detail))

  ipcMain.handle('devis:supprimer', (_e, id: number) => supprimerDevis(id))

  ipcMain.handle('devis:changerStatut', (_e, id: number, statut: Devis['statut']) =>
    changerStatutDevis(id, statut)
  )

  ipcMain.handle('devis:historique', () => historiqueDevis())
}
