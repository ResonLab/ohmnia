import { ipcMain } from 'electron'
import {
  changerStatutFacture,
  chargerDetailFacture,
  confirmerEnregistrementHistorique,
  creerBrouillonFacture,
  creerFactureDepuisDevis,
  dupliquerFacture,
  enregistrerFacture,
  historiqueFactures,
  prochainNumeroFacture,
  supprimerFacture
} from '../domaines/factures'
import type { Facture, FactureDetail } from '../../shared/types'

/** Branchement des factures sur la fenêtre. Logique : `../domaines/factures.ts`. */
export function enregistrerHandlersFactures(): void {
  ipcMain.handle('factures:prochainNumero', () => prochainNumeroFacture())

  ipcMain.handle('factures:creerBrouillon', (_e, clientId: number) => creerBrouillonFacture(clientId))

  ipcMain.handle('factures:obtenirDetail', (_e, id: number) => chargerDetailFacture(id))

  ipcMain.handle('factures:dupliquer', (_e, id: number) => dupliquerFacture(id))

  ipcMain.handle('factures:creerDepuisDevis', (_e, devisId: number) =>
    creerFactureDepuisDevis(devisId)
  )

  ipcMain.handle('factures:enregistrer', (_e, detail: FactureDetail) => enregistrerFacture(detail))

  ipcMain.handle('factures:supprimer', (_e, id: number) => supprimerFacture(id))

  ipcMain.handle('factures:changerStatut', (_e, id: number, statut: Facture['statut']) =>
    changerStatutFacture(id, statut)
  )

  ipcMain.handle('factures:historique', () => historiqueFactures())

  ipcMain.handle('factures:confirmerEnregistrementHistorique', (_e, id: number) =>
    confirmerEnregistrementHistorique(id)
  )
}
