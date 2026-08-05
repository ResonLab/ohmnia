import { app, BrowserWindow, ipcMain } from 'electron'
import type { UpdateInfo } from 'electron-updater'
import { getDb } from './db/database'
import { sauvegarderBaseDeDonnees } from './db/backup'
import { tracerAudit } from './db/audit'
import type { ConfigurationMaj, EtatMaj, SourceMaj } from '../shared/types'

/**
 * Mises à jour automatiques.
 *
 * Volontairement désactivées tant qu'aucune adresse n'est configurée : sans URL,
 * l'application ne fait strictement aucun appel réseau. L'adresse peut être :
 *  - un dossier partagé servi en HTTP sur le réseau local (reste hors internet) ;
 *  - une URL publique (release GitHub, hébergement web) pour diffuser à distance.
 *
 * Le dossier pointé doit contenir les fichiers produits par `npm run package:win` :
 * `latest.yml`, le `.exe` d'installation et son `.blockmap`.
 */

let etat: EtatMaj = { statut: 'inactif', versionActuelle: app.getVersion() }

function lireConfigurationMaj(): ConfigurationMaj {
  try {
    const ligne = getDb()
      .prepare('SELECT url_maj, maj_auto, maj_source, maj_depot FROM parametres_app WHERE id = 1')
      .get() as
      | { url_maj: string | null; maj_auto: number; maj_source: string; maj_depot: string }
      | undefined
    return {
      source: (ligne?.maj_source as SourceMaj) ?? 'github',
      depot: ligne?.maj_depot ?? '',
      url: ligne?.url_maj ?? null,
      auto: (ligne?.maj_auto ?? 0) === 1
    }
  } catch {
    return { source: 'github', depot: '', url: null, auto: false }
  }
}

/** Vrai si une source de mise à jour exploitable est configurée. */
function sourceConfiguree(config: ConfigurationMaj): boolean {
  return config.source === 'github' ? config.depot.trim() !== '' : (config.url ?? '').trim() !== ''
}

function diffuserEtat(nouvelEtat: EtatMaj): void {
  etat = nouvelEtat
  for (const fenetre of BrowserWindow.getAllWindows()) {
    if (!fenetre.isDestroyed()) fenetre.webContents.send('maj:etat', etat)
  }
}

/**
 * Charge electron-updater à la demande et le configure.
 * L'import est différé pour ne rien exiger du réseau au démarrage.
 */
async function preparerUpdater(
  config: ConfigurationMaj
): Promise<typeof import('electron-updater').autoUpdater> {
  const { autoUpdater } = await import('electron-updater')

  autoUpdater.autoDownload = false // le téléchargement reste un choix explicite
  autoUpdater.autoInstallOnAppQuit = false

  if (config.source === 'github') {
    const [proprietaire, depot] = config.depot.trim().split('/')
    autoUpdater.setFeedURL({ provider: 'github', owner: proprietaire, repo: depot })
  } else {
    autoUpdater.setFeedURL({ provider: 'generic', url: (config.url ?? '').trim() })
  }

  // Les écouteurs ne doivent être posés qu'une fois, sinon les événements
  // seraient diffusés en double à chaque vérification.
  if (autoUpdater.listenerCount('update-available') === 0) {
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      diffuserEtat({
        statut: 'disponible',
        versionActuelle: app.getVersion(),
        versionDisponible: info.version,
        notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
      })
    })

    autoUpdater.on('update-not-available', () => {
      diffuserEtat({ statut: 'aJour', versionActuelle: app.getVersion() })
    })

    autoUpdater.on('download-progress', (progression) => {
      diffuserEtat({
        statut: 'telechargement',
        versionActuelle: app.getVersion(),
        pourcentage: Math.round(progression.percent)
      })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      diffuserEtat({
        statut: 'telechargee',
        versionActuelle: app.getVersion(),
        versionDisponible: info.version
      })
    })

    autoUpdater.on('error', (erreur) => {
      diffuserEtat({
        statut: 'erreur',
        versionActuelle: app.getVersion(),
        message: erreur instanceof Error ? erreur.message : String(erreur)
      })
    })
  }

  return autoUpdater
}

/** Vérification silencieuse au démarrage, seulement si l'utilisateur l'a activée. */
export function verifierMajAuDemarrage(): void {
  const config = lireConfigurationMaj()
  if (!config.auto || !sourceConfiguree(config) || !app.isPackaged) return

  // Un délai laisse la fenêtre s'afficher avant toute activité réseau.
  setTimeout(() => {
    preparerUpdater(config)
      .then((updater) => updater.checkForUpdates())
      .catch((erreur) => console.error('Vérification des mises à jour impossible :', erreur))
  }, 4000)
}

export function enregistrerHandlersMaj(): void {
  ipcMain.handle('maj:etat', () => etat)

  ipcMain.handle('maj:lireConfiguration', () => lireConfigurationMaj())

  ipcMain.handle('maj:enregistrerConfiguration', (_e, config: ConfigurationMaj) => {
    const depot = config.depot.trim()
    const adresse = config.url?.trim() || null

    if (config.source === 'github' && depot && !/^[\w.-]+\/[\w.-]+$/.test(depot)) {
      throw new Error(
        'Le dépôt doit être au format « proprietaire/depot » (exemple : colinmeng/ohmnia).'
      )
    }
    if (config.source === 'url' && adresse && !/^https?:\/\/.+/i.test(adresse)) {
      throw new Error(
        "L'adresse doit commencer par http:// ou https:// (exemple : http://192.168.1.20/ohmnia)."
      )
    }

    getDb()
      .prepare(
        'UPDATE parametres_app SET maj_source = ?, maj_depot = ?, url_maj = ?, maj_auto = ? WHERE id = 1'
      )
      .run(config.source, depot, adresse, config.auto ? 1 : 0)
    return lireConfigurationMaj()
  })

  /** Contrôles communs avant toute opération réseau de mise à jour. */
  function configurationUtilisable(): ConfigurationMaj {
    const config = lireConfigurationMaj()
    if (!sourceConfiguree(config)) {
      throw new Error(
        config.source === 'github'
          ? 'Aucun dépôt GitHub configuré. Renseignez-le ci-dessus pour activer les mises à jour.'
          : "Aucune adresse de mise à jour configurée. Renseignez-la ci-dessus pour activer les mises à jour."
      )
    }
    if (!app.isPackaged) {
      throw new Error(
        "Les mises à jour ne fonctionnent que sur l'application installée, pas en mode développement."
      )
    }
    return config
  }

  ipcMain.handle('maj:verifier', async () => {
    const config = configurationUtilisable()
    diffuserEtat({ statut: 'verification', versionActuelle: app.getVersion() })

    // Sans ce garde-fou, une vérification qui n'aboutit jamais laissait
    // l'écran figé sur « Vérification en cours… », sans message ni sortie.
    // Un serveur injoignable ou une coupure réseau donnent exactement cela.
    const DELAI_MAX = 20_000
    let expire: NodeJS.Timeout | undefined

    try {
      const updater = await preparerUpdater(config)
      await Promise.race([
        updater.checkForUpdates(),
        new Promise((_resolut, rejeter) => {
          expire = setTimeout(
            () =>
              rejeter(
                new Error(
                  'La vérification a pris trop de temps. Vérifiez votre connexion, ' +
                    "puis réessayez. L'application reste utilisable normalement."
                )
              ),
            DELAI_MAX
          )
        })
      ])
    } catch (erreur) {
      // L'erreur est renvoyée à l'appelant ET diffusée : sans cela, l'écran
      // resterait sur l'état « vérification » même après un échec.
      const message = erreur instanceof Error ? erreur.message : String(erreur)
      diffuserEtat({ statut: 'erreur', versionActuelle: app.getVersion(), message })
      throw new Error(message)
    } finally {
      clearTimeout(expire)
    }

    return etat
  })

  ipcMain.handle('maj:telecharger', async () => {
    const updater = await preparerUpdater(configurationUtilisable())
    await updater.downloadUpdate()
    return etat
  })

  ipcMain.handle('maj:installer', async () => {
    const config = configurationUtilisable()

    // Filet de sécurité : la base est sauvegardée avant le redémarrage.
    sauvegarderBaseDeDonnees()
    tracerAudit('mise-a-jour', 'application', etat.versionDisponible ?? '', 'Installation demandée')

    const updater = await preparerUpdater(config)
    // isSilent = false pour que l'utilisateur voie l'installateur travailler.
    setImmediate(() => updater.quitAndInstall(false, true))
  })
}
