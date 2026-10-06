import { useEffect } from 'react'
import { t } from '../../shared/i18n'

/**
 * Empêche de perdre un document qu'on est en train de saisir.
 *
 * **Pourquoi ce module existe.** Une facture a été saisie en entier puis perdue :
 * on est sorti de l'écran en croyant qu'elle était enregistrée, et il n'y avait
 * rien. Rien ne prévenait. Un écran qui tient un brouillon déclare ici qu'il a
 * des modifications non enregistrées ; tout ce qui peut le quitter — changer de
 * module, ouvrir une autre facture, fermer la fenêtre — demande d'abord.
 *
 * **Un seul état partagé, volontairement.** Un seul écran de saisie est ouvert à
 * la fois. Le démonter remet l'état à zéro (voir `useGardeSortie`), donc un
 * drapeau oublié ne peut pas bloquer l'utilisateur sur un écran qu'il a quitté.
 */
let modifie = false

/** Vrai si on peut partir : rien à perdre, ou l'utilisateur accepte de le perdre. */
export function peutQuitter(): boolean {
  if (!modifie) return true
  return window.confirm(t('garde.confirmerSortie'))
}

/**
 * À appeler par l'écran qui tient un brouillon.
 * `modifieMaintenant` est vrai tant que ce qui est affiché diffère de ce qui est
 * enregistré.
 */
export function useGardeSortie(modifieMaintenant: boolean): void {
  useEffect(() => {
    modifie = modifieMaintenant

    // Fermer la fenêtre : Electron demande confirmation côté système si ce
    // gestionnaire s'oppose (voir `will-prevent-unload` dans le processus principal).
    const surFermeture = (evenement: BeforeUnloadEvent): void => {
      if (!modifieMaintenant) return
      evenement.preventDefault()
      evenement.returnValue = ''
    }
    window.addEventListener('beforeunload', surFermeture)
    return () => window.removeEventListener('beforeunload', surFermeture)
  }, [modifieMaintenant])

  // Quitter l'écran remet l'état à zéro, même si le brouillon était modifié.
  useEffect(() => {
    return () => {
      modifie = false
    }
  }, [])
}
