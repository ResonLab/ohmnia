import { ipcMain } from 'electron'
import {
  changerStatutLocation,
  creerFactureDepuisLocation,
  disponibiliteArticle,
  enregistrerEvenement,
  enregistrerLocation,
  listerAgenda,
  supprimerEvenement
} from '../domaines/agenda'
import type { EvenementAgenda, StatutLocation, ValeursLocation } from '../../shared/types'

/** Branchement de l'agenda sur la fenêtre. Logique : `../domaines/agenda.ts`. */
export function enregistrerHandlersAgenda(): void {
  ipcMain.handle('agenda:lister', (_e, debut: string, fin: string) => listerAgenda(debut, fin))

  ipcMain.handle(
    'agenda:disponibilite',
    (_e, reference: string, debut: string, fin: string, exclureLocationId: number) =>
      disponibiliteArticle(reference, debut, fin, exclureLocationId)
  )

  ipcMain.handle('agenda:enregistrerEvenement', (_e, evenement: EvenementAgenda) =>
    enregistrerEvenement(evenement)
  )

  ipcMain.handle('agenda:supprimerEvenement', (_e, id: number) => supprimerEvenement(id))

  ipcMain.handle('agenda:enregistrerLocation', (_e, valeurs: ValeursLocation) => enregistrerLocation(valeurs))

  ipcMain.handle('agenda:changerStatutLocation', (_e, id: number, statut: StatutLocation) =>
    changerStatutLocation(id, statut)
  )

  ipcMain.handle('agenda:creerFacture', (_e, id: number) => creerFactureDepuisLocation(id))
}
