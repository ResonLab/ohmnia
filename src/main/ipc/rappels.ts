import { ipcMain } from 'electron'
import {
  creerRappel,
  listerRappels,
  prochainNiveauRappel,
  relancesAFaire,
  supprimerRappel
} from '../domaines/rappels'

/** Branchement des rappels sur la fenêtre. Logique dans `../domaines/rappels.ts`. */
export function enregistrerHandlersRappels(): void {
  ipcMain.handle('rappels:lister', (_e, factureId: number) => listerRappels(factureId))

  ipcMain.handle('rappels:prochainNiveau', (_e, factureId: number) =>
    prochainNiveauRappel(factureId)
  )

  ipcMain.handle('rappels:creer', (_e, factureId: number, niveau: number, frais: number) =>
    creerRappel(factureId, niveau, frais)
  )

  ipcMain.handle('rappels:supprimer', (_e, id: number) => supprimerRappel(id))

  ipcMain.handle('rappels:aFaire', () => relancesAFaire())
}
