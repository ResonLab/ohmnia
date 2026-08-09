import { ipcMain } from 'electron'
import {
  ajouterChargeFixe,
  enregistrerParametresDeplacement,
  enregistrerParametresImpression,
  enregistrerParametresMarge,
  lireParametresDeplacement,
  lireParametresImpression,
  lireParametresMarge,
  listerChargesFixes,
  modifierChargeFixe,
  supprimerChargeFixe
} from '../domaines/parametres'
import type {
  ChargeFixe,
  ParametresDeplacement,
  ParametresImpressionDb,
  ParametresMarge
} from '../../shared/types'

/** Branchement des paramètres de calcul sur la fenêtre. Logique : `../domaines/parametres.ts`. */
export function enregistrerHandlersParametres(): void {
  ipcMain.handle('parametresMarge:lire', () => lireParametresMarge())

  ipcMain.handle('parametresMarge:enregistrer', (_e, valeurs: ParametresMarge) =>
    enregistrerParametresMarge(valeurs)
  )

  ipcMain.handle('parametresDeplacement:lire', () => lireParametresDeplacement())

  ipcMain.handle('parametresDeplacement:enregistrer', (_e, valeurs: ParametresDeplacement) =>
    enregistrerParametresDeplacement(valeurs)
  )

  ipcMain.handle('parametresImpression:lire', () => lireParametresImpression())

  ipcMain.handle('parametresImpression:enregistrer', (_e, valeurs: ParametresImpressionDb) =>
    enregistrerParametresImpression(valeurs)
  )

  ipcMain.handle('chargesFixes:lister', () => listerChargesFixes())

  ipcMain.handle('chargesFixes:ajouter', (_e, charge: Omit<ChargeFixe, 'id'>) =>
    ajouterChargeFixe(charge)
  )

  ipcMain.handle('chargesFixes:modifier', (_e, charge: ChargeFixe) => modifierChargeFixe(charge))

  ipcMain.handle('chargesFixes:supprimer', (_e, id: number) => supprimerChargeFixe(id))
}
