import { ipcMain } from 'electron'
import {
  ajouterArticle,
  listerInventaire,
  modifierArticle,
  referenceSuggeree,
  resumeInventaire,
  supprimerArticle
} from '../domaines/inventaire'
import type { ArticleInventaire } from '../../shared/types'

/** Branchement de l'inventaire sur la fenêtre. Logique : `../domaines/inventaire.ts`. */
export function enregistrerHandlersInventaire(): void {
  ipcMain.handle('inventaire:lister', () => listerInventaire())

  ipcMain.handle('inventaire:referenceSuggeree', () => referenceSuggeree())

  ipcMain.handle('inventaire:ajouter', (_e, article: ArticleInventaire) => ajouterArticle(article))

  ipcMain.handle('inventaire:modifier', (_e, referenceOrigine: string, article: ArticleInventaire) =>
    modifierArticle(referenceOrigine, article)
  )

  ipcMain.handle('inventaire:supprimer', (_e, reference: string) => supprimerArticle(reference))

  ipcMain.handle('inventaire:resume', () => resumeInventaire())
}
