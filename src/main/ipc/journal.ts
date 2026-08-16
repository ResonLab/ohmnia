import { ipcMain } from 'electron'
import {
  ajouterCategorieJournal,
  ajouterEcritureJournal,
  evolutionAnnuelle,
  listerCategoriesJournal,
  listerJournal,
  renommerCategorieJournal,
  repartitionParCategorie,
  supprimerCategorieJournal,
  supprimerEcritureJournal
} from '../domaines/journal'
import type { EcritureJournal, FiltresJournal } from '../../shared/types'

type ValeursEcriture = Omit<EcritureJournal, 'id' | 'annee' | 'categorieLibelle' | 'montantTva'>

/** Branchement du journal sur la fenêtre. Logique : `../domaines/journal.ts`. */
export function enregistrerHandlersJournal(): void {
  ipcMain.handle('categoriesJournal:lister', () => listerCategoriesJournal())

  ipcMain.handle('categoriesJournal:ajouter', (_e, libelle: string) =>
    ajouterCategorieJournal(libelle)
  )

  ipcMain.handle('categoriesJournal:renommer', (_e, id: number, libelle: string) =>
    renommerCategorieJournal(id, libelle)
  )

  ipcMain.handle('categoriesJournal:supprimer', (_e, id: number) => supprimerCategorieJournal(id))

  ipcMain.handle('journal:lister', (_e, filtres: FiltresJournal = {}) => listerJournal(filtres))

  ipcMain.handle('journal:ajouter', (_e, valeurs: ValeursEcriture) =>
    ajouterEcritureJournal(valeurs)
  )

  // Pas de canal `journal:modifier` : voir `src/preload/index.ts`. Une écriture
  // se corrige en l'annulant et en la ressaisissant, ce qui laisse une trace.
  ipcMain.handle('journal:supprimer', (_e, id: number) => supprimerEcritureJournal(id))

  ipcMain.handle('journal:repartitionParCategorie', (_e, filtres: FiltresJournal = {}) =>
    repartitionParCategorie(filtres)
  )

  ipcMain.handle('journal:evolutionAnnuelle', () => evolutionAnnuelle())
}
