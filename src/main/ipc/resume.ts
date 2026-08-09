import { ipcMain } from 'electron'
import {
  enregistrerObjectifAnnuel,
  lireObjectifAnnuel,
  resumeParAnnee
} from '../domaines/resume'

/** Branchement du résumé annuel sur la fenêtre. Logique dans `../domaines/resume.ts`. */
export function enregistrerHandlersResume(): void {
  ipcMain.handle('resume:parAnnee', () => resumeParAnnee())

  ipcMain.handle('objectifAnnuel:lire', (_e, annee: number) => lireObjectifAnnuel(annee))

  ipcMain.handle('objectifAnnuel:enregistrer', (_e, annee: number, objectifCa: number) =>
    enregistrerObjectifAnnuel(annee, objectifCa)
  )
}
