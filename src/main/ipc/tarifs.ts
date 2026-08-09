import { ipcMain } from 'electron'
import {
  ajouterTarifDeplacement,
  ajouterTarifMainOeuvre,
  ajouterTarifProduit,
  listerTarifsDeplacement,
  listerTarifsMainOeuvre,
  listerTarifsProduits,
  modifierTarifDeplacement,
  modifierTarifMainOeuvre,
  modifierTarifProduit,
  supprimerTarifDeplacement,
  supprimerTarifMainOeuvre,
  supprimerTarifProduit
} from '../domaines/tarifs'
import type { TarifDeplacement, TarifMainOeuvre, TarifProduit } from '../../shared/types'

/** Branchement des tarifs sur la fenêtre. Logique : `../domaines/tarifs.ts`. */
export function enregistrerHandlersTarifs(): void {
  // --- Produits ---
  ipcMain.handle('tarifsProduits:lister', () => listerTarifsProduits())

  ipcMain.handle('tarifsProduits:ajouter', (_e, tarif: Omit<TarifProduit, 'id'>) =>
    ajouterTarifProduit(tarif)
  )

  ipcMain.handle('tarifsProduits:modifier', (_e, tarif: TarifProduit) => modifierTarifProduit(tarif))

  ipcMain.handle('tarifsProduits:supprimer', (_e, id: number) => supprimerTarifProduit(id))

  // --- Main d'oeuvre ---
  ipcMain.handle('tarifsMainOeuvre:lister', () => listerTarifsMainOeuvre())

  ipcMain.handle('tarifsMainOeuvre:ajouter', (_e, tarif: Omit<TarifMainOeuvre, 'id'>) =>
    ajouterTarifMainOeuvre(tarif)
  )

  ipcMain.handle('tarifsMainOeuvre:modifier', (_e, tarif: TarifMainOeuvre) =>
    modifierTarifMainOeuvre(tarif)
  )

  ipcMain.handle('tarifsMainOeuvre:supprimer', (_e, id: number) => supprimerTarifMainOeuvre(id))

  // --- Déplacement ---
  ipcMain.handle('tarifsDeplacement:lister', () => listerTarifsDeplacement())

  ipcMain.handle('tarifsDeplacement:ajouter', (_e, tarif: Omit<TarifDeplacement, 'id'>) =>
    ajouterTarifDeplacement(tarif)
  )

  ipcMain.handle('tarifsDeplacement:modifier', (_e, tarif: TarifDeplacement) =>
    modifierTarifDeplacement(tarif)
  )

  ipcMain.handle('tarifsDeplacement:supprimer', (_e, id: number) => supprimerTarifDeplacement(id))
}
