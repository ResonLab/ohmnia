import { BrowserWindow, ipcMain } from 'electron'
import { DROITS } from '../../serveur/droits'
import {
  appelerServeur,
  creerPremierAdministrateurDistant,
  estConnecte,
  fermerSessionDistante,
  ouvrirSessionDistante,
  prevenirSurSessionPerdue,
  sessionCourante,
  testerServeur,
} from './client'
import {
  ecrireConfigurationMultipostes,
  lireConfigurationMultipostes,
  validerAdresse,
  type ModeFonctionnement
} from './configuration'
import { estModeServeur, executer } from './routeur'
import type { EtatMultipostes, ParametresApp } from '../../shared/types'

/**
 * Le mode multi-postes vu par l'interface.
 *
 * Deux choses très différentes vivent ici :
 *
 * 1. **Les canaux `multipostes:*`** — configurer le mode, se connecter, se
 *    déconnecter. Ils existent dans les deux modes, sinon l'écran de réglages
 *    ne pourrait pas proposer de basculer.
 * 2. **Le renvoi des canaux métier vers le serveur**, enregistré *à la place*
 *    des handlers locaux quand le mode est `serveur`. Mêmes noms de canaux,
 *    donc l'interface ne voit aucune différence — c'est tout l'intérêt d'avoir
 *    gardé les noms de l'IPC depuis l'étape 1.
 */

function etat(): EtatMultipostes {
  const config = lireConfigurationMultipostes()
  return {
    mode: config.mode,
    adresse: config.adresse,
    dernierIdentifiant: config.dernierIdentifiant,
    connecte: estConnecte(),
    session: sessionCourante()
  }
}

export function enregistrerHandlersMultipostes(): void {
  // Une session qui expire pendant la saisie ne doit pas se traduire par une
  // suite d'erreurs incompréhensibles : l'interface est prévenue et propose
  // de se reconnecter, sans quitter l'écran en cours.
  prevenirSurSessionPerdue(() => {
    for (const fenetre of BrowserWindow.getAllWindows()) {
      fenetre.webContents.send('multipostes:sessionPerdue')
    }
  })

  ipcMain.handle('multipostes:etat', () => etat())

  /** Vérifie qu'un serveur répond avant d'enregistrer quoi que ce soit. */
  ipcMain.handle('multipostes:tester', async (_e, adresse: string) => {
    const erreur = validerAdresse(adresse)
    if (erreur) throw new Error(erreur)
    return testerServeur(adresse.trim())
  })

  /**
   * Bascule le mode. **Le changement ne prend effet qu'au redémarrage** : les
   * handlers IPC sont enregistrés une fois, au démarrage, et les réenregistrer
   * à chaud laisserait des écrans affichant encore les données de l'autre
   * mode. Redémarrer est plus lent, mais on sait toujours d'où viennent les
   * chiffres à l'écran.
   */
  ipcMain.handle('multipostes:definirMode', (_e, mode: ModeFonctionnement, adresse: string) => {
    if (mode === 'serveur') {
      const erreur = validerAdresse(adresse)
      if (erreur) throw new Error(erreur)
    }

    const config = lireConfigurationMultipostes()
    ecrireConfigurationMultipostes({
      ...config,
      mode,
      adresse: mode === 'serveur' ? adresse.trim() : config.adresse
    })
    return etat()
  })

  ipcMain.handle('multipostes:connecter', async (_e, identifiant: string, motDePasse: string) => {
    const session = await ouvrirSessionDistante(identifiant, motDePasse)

    // L'identifiant est mémorisé pour ne pas le retaper ; jamais le mot de passe.
    const config = lireConfigurationMultipostes()
    ecrireConfigurationMultipostes({ ...config, dernierIdentifiant: session.identifiant })
    return session
  })

  // Nom du canal sur la même ligne qu'`ipcMain.handle(` : plusieurs
  // vérifications le cherchent d'un seul tenant et ne le verraient pas sinon.
  ipcMain.handle('multipostes:creerPremierAdministrateur', async (_e, identifiant: string, motDePasse: string, nomAffiche: string) => {
    await creerPremierAdministrateurDistant(identifiant, motDePasse, nomAffiche)
    return ouvrirSessionDistante(identifiant, motDePasse)
  })

  ipcMain.handle('multipostes:deconnecter', async () => {
    await fermerSessionDistante()
    return etat()
  })
}

/**
 * Enregistre les canaux métier en mode serveur.
 *
 * La liste vient de `DROITS`, dont une vérification garantit qu'elle
 * correspond exactement au registre du serveur — donc aux canaux réellement
 * servis. Aucune liste à tenir à jour à la main ici.
 */
export function enregistrerHandlersDistants(): void {
  for (const canal of Object.keys(DROITS)) {
    if (CANAUX_NON_RENVOYES.includes(canal)) continue
    ipcMain.handle(canal, (_e, ...arguments_: unknown[]) => appelerServeur(canal, arguments_))
  }
}

/**
 * Les deux seuls canaux du registre qui ne sont **pas** renvoyés tels quels.
 *
 * `enregistrerHandlersApparence()` s'en charge dans les deux modes, parce qu'il
 * doit garder le thème et la langue sur le poste. Toute autre exception serait
 * suspecte : c'est le genre de détour qui fait diverger les deux modes.
 */
export const CANAUX_NON_RENVOYES = ['parametresApp:lire', 'parametresApp:enregistrer']

/**
 * Réglages de l'application, avec l'apparence gardée sur le poste.
 * Enregistré dans les deux modes.
 *
 * En local, rien ne change : tout va dans la base. En multi-postes, le thème,
 * la langue et la couleur d'accent restent ici — ce sont des préférences
 * personnelles, pas des réglages d'entreprise, et les laisser côté serveur
 * revenait à interdire à un employé de choisir son thème (le reste de
 * `parametres_app` est réservé à l'administration).
 */
export function enregistrerHandlersApparence(): void {
  ipcMain.handle('parametresApp:lire', async () => {
    const distants = (await executer('parametresApp:lire')) as ParametresApp
    if (!estModeServeur()) return distants

    const { apparence } = lireConfigurationMultipostes()
    return apparence ? { ...distants, ...apparence } : distants
  })

  ipcMain.handle('parametresApp:enregistrer', async (_e, valeurs: ParametresApp) => {
    if (!estModeServeur()) return executer('parametresApp:enregistrer', valeurs)

    const config = lireConfigurationMultipostes()
    ecrireConfigurationMultipostes({
      ...config,
      apparence: {
        theme: valeurs.theme,
        langue: valeurs.langue,
        couleurAccent: valeurs.couleurAccent
      }
    })

    // Le reste engage l'entreprise : seul un administrateur peut l'écrire.
    // L'écran masque ces champs aux autres rôles, donc rien n'est perdu en
    // silence — ils ne peuvent tout simplement pas les modifier.
    const session = sessionCourante()
    if (session?.role === 'administration') {
      await executer('parametresApp:enregistrer', valeurs)
    }

    const distants = (await executer('parametresApp:lire')) as ParametresApp
    return {
      ...distants,
      theme: valeurs.theme,
      langue: valeurs.langue,
      couleurAccent: valeurs.couleurAccent
    }
  })
}
