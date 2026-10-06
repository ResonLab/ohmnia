import { BrowserWindow, ipcMain } from 'electron'

/**
 * Ce qui concerne la fenêtre de cette machine, dans les deux modes.
 *
 * **Redonner le clavier après une boîte de dialogue native.** Sous Windows,
 * après un `confirm()` ou un `alert()` du navigateur, la fenêtre reprend
 * l'affichage mais plus la saisie : les champs de texte ne reçoivent plus les
 * touches, et il faut fermer puis relancer l'application. C'est un défaut connu
 * d'Electron, signalé ici par l'utilisateur (« je ne peux plus écrire »). Perdre
 * puis reprendre le focus de la fenêtre le répare ; l'écran appelle ceci juste
 * après chaque boîte de dialogue (voir `renderer/src/main.tsx`).
 */
export function enregistrerHandlersFenetre(): void {
  ipcMain.handle('fenetre:refocaliser', (evenement) => {
    const fenetre = BrowserWindow.fromWebContents(evenement.sender)
    if (!fenetre || fenetre.isDestroyed()) return
    fenetre.blur()
    fenetre.focus()
    fenetre.webContents.focus()
  })
}
