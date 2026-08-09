import { ipcMain } from 'electron'
import {
  arreterIntervention,
  demarrerIntervention,
  facturerInterventions,
  interventionEnCours,
  listerInterventions,
  modifierIntervention,
  supprimerIntervention
} from '../domaines/suiviTemps'
import type { Intervention } from '../../shared/types'

/** Branchement du suivi du temps sur la fenêtre. Logique : `../domaines/suiviTemps.ts`. */
export function enregistrerHandlersSuiviTemps(): void {
  ipcMain.handle('suiviTemps:lister', () => listerInterventions())

  ipcMain.handle('suiviTemps:enCours', () => interventionEnCours())

  ipcMain.handle('suiviTemps:demarrer', (_e, description: string, clientId: number | null) =>
    demarrerIntervention(description, clientId)
  )

  ipcMain.handle('suiviTemps:arreter', (_e, id: number) => arreterIntervention(id))

  ipcMain.handle('suiviTemps:modifier', (_e, intervention: Intervention) =>
    modifierIntervention(intervention)
  )

  ipcMain.handle('suiviTemps:supprimer', (_e, id: number) => supprimerIntervention(id))

  ipcMain.handle('suiviTemps:facturer', (_e, ids: number[], factureId: number, taux: number) =>
    facturerInterventions(ids, factureId, taux)
  )
}
