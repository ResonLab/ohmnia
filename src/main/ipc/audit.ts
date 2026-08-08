import { ipcMain } from 'electron'
import {
  cloturerExercice,
  listerAudit,
  listerExercices,
  reouvrirExercice,
  viderAudit
} from '../domaines/audit'

/** Branchement de l'audit sur la fenêtre. La logique vit dans `../domaines/audit.ts`. */
export function enregistrerHandlersAudit(): void {
  ipcMain.handle('audit:lister', (_e, limite = 300) => listerAudit(limite))

  ipcMain.handle('audit:vider', () => viderAudit())

  ipcMain.handle('exercices:lister', () => listerExercices())

  ipcMain.handle('exercices:cloturer', (_e, annee: number) => cloturerExercice(annee))

  ipcMain.handle('exercices:reouvrir', (_e, annee: number) => reouvrirExercice(annee))
}
