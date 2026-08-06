import { BrowserWindow, dialog } from 'electron'
import type {
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue
} from 'electron'

/**
 * Boîtes de dialogue « ouvrir » et « enregistrer », toujours rattachées à la
 * fenêtre de l'application.
 *
 * Sans fenêtre parente, Windows ne considère pas le dialogue comme appartenant
 * à Ohmnia : il peut passer DERRIÈRE la fenêtre principale tout en gardant le
 * focus clavier. L'application semble alors figée — elle répond à la souris
 * mais aucune frappe ne l'atteint — et l'utilisateur n'a aucun moyen de
 * comprendre ce qui se passe. Bug réellement rencontré.
 *
 * Passer par ces deux fonctions plutôt que par `dialog` directement garantit
 * qu'on ne peut plus oublier le parent.
 */
function fenetreParente(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

export function choisirFichier(options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
  const parente = fenetreParente()
  // Au tout premier lancement, la fenêtre peut ne pas encore exister :
  // mieux vaut un dialogue sans parent que pas de dialogue du tout.
  return parente ? dialog.showOpenDialog(parente, options) : dialog.showOpenDialog(options)
}

export function choisirDestination(options: SaveDialogOptions): Promise<SaveDialogReturnValue> {
  const parente = fenetreParente()
  return parente ? dialog.showSaveDialog(parente, options) : dialog.showSaveDialog(options)
}
