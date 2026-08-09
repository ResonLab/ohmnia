import { ipcMain } from 'electron'
import {
  creerModele,
  creerModeleDepuisFacture,
  enregistrerModele,
  listerModeles,
  supprimerModele
} from '../domaines/modeles'
import type { ModelePrestation } from '../../shared/types'

/** Branchement des modèles de prestations sur la fenêtre. Logique : `../domaines/modeles.ts`. */
export function enregistrerHandlersModeles(): void {
  ipcMain.handle('modeles:lister', () => listerModeles())

  ipcMain.handle('modeles:creer', (_e, nom: string) => creerModele(nom))

  ipcMain.handle('modeles:enregistrer', (_e, modele: ModelePrestation) => enregistrerModele(modele))

  ipcMain.handle('modeles:supprimer', (_e, id: number) => supprimerModele(id))

  ipcMain.handle('modeles:creerDepuisFacture', (_e, factureId: number, nom: string) =>
    creerModeleDepuisFacture(factureId, nom)
  )
}
