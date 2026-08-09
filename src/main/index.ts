import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { ouvrirBaseDeDonnees, fermerBaseDeDonnees } from './db/database'
import { definirContexte } from './contexte'
import { sauvegarderBaseDeDonnees } from './db/backup'
import { migrerAncienDossierDonnees } from './db/migration-dossier'
import { enregistrerHandlersEntreprise } from './ipc/entreprise'
import { enregistrerHandlersParametres } from './ipc/parametres'
import { enregistrerHandlersTarifs } from './ipc/tarifs'
import { enregistrerHandlersJournal } from './ipc/journal'
import { enregistrerHandlersClients } from './ipc/clients'
import { enregistrerHandlersFactures } from './ipc/factures'
import { enregistrerHandlersDevis } from './ipc/devis'
import { enregistrerHandlersParametresApp } from './ipc/parametresApp'
import { enregistrerHandlersRappels } from './ipc/rappels'
import { enregistrerHandlersModeles } from './ipc/modeles'
import { enregistrerHandlersTableauDeBord } from './ipc/tableauDeBord'
import { enregistrerHandlersSuiviTemps } from './ipc/suiviTemps'
import { enregistrerHandlersJustificatifs } from './ipc/justificatifs'
import { enregistrerHandlersComptabilite } from './ipc/comptabilite'
import { enregistrerHandlersAudit } from './ipc/audit'
import { enregistrerHandlersRecherche } from './ipc/recherche'
import { enregistrerHandlersMaj, verifierMajAuDemarrage } from './maj'
import { enregistrerHandlersConformite } from './ipc/conformite'
import { enregistrerHandlersConditions } from './ipc/conditions'
import { enregistrerHandlersInventaire } from './ipc/inventaire'
import { enregistrerHandlersResume } from './ipc/resume'
import { enregistrerHandlersPdf } from './pdf'
import { enregistrerHandlersDocuments } from './ipc/documents'
import {
  enregistrerHandlersApparence,
  enregistrerHandlersDistants,
  enregistrerHandlersMultipostes
} from './multipostes/handlers'
import { enregistrerHandlersComptabilitePoste } from './ipc/comptabilite'
import { enregistrerHandlersEntreprisePoste } from './ipc/entreprise'
import { enregistrerHandlersJustificatifsPoste } from './ipc/justificatifs'
import { enregistrerHandlersParametresAppPoste } from './ipc/parametresApp'
import { enregistrerHandlersConditionsPoste } from './ipc/conditions'
import { lireConfigurationMultipostes } from './multipostes/configuration'

// Nom fixé explicitement : garantit que le dossier de données (et donc la base
// SQLite) reste le même quel que soit le mode de lancement de l'application.
app.setName('Ohmnia')

/**
 * Icône de la fenêtre (barre de titre et barre des tâches).
 * En développement le fichier est dans build/ à la racine du projet ;
 * une fois empaqueté il est embarqué à côté du code compilé.
 */
function cheminIcone(): string {
  const candidats = [
    join(__dirname, '../../build/icon.png'),
    join(process.resourcesPath ?? '', 'build/icon.png'),
    join(__dirname, '../../../build/icon.png')
  ]
  return candidats.find((chemin) => existsSync(chemin)) ?? candidats[0]
}

function creerFenetrePrincipale(): void {
  const fenetre = new BrowserWindow({
    icon: cheminIcone(),
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  fenetre.once('ready-to-show', () => fenetre.show())

  fenetre.webContents.on('console-message', (event) => {
    console.log(`[renderer] ${event.sourceId}:${event.lineNumber} ${event.message}`)
  })
  fenetre.webContents.on('did-fail-load', (_event, code, description) => {
    console.log(`[did-fail-load] ${code} ${description}`)
  })
  fenetre.webContents.on('render-process-gone', (_event, details) => {
    console.log(`[render-process-gone] ${JSON.stringify(details)}`)
  })

  // Les liens externes s'ouvrent dans le navigateur système, jamais dans l'app.
  fenetre.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    fenetre.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    fenetre.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Seul endroit où Electron dicte où vivent les données et quelle version
  // tourne. Tout le reste du code lit ces valeurs depuis `contexte`, ce qui
  // permettra au serveur multi-postes de réutiliser la même couche métier
  // avec ses propres valeurs. À faire avant toute lecture de la base.
  definirContexte({
    dossierDonnees: app.getPath('userData'),
    version: app.getVersion()
  })

  // Le mode est lu avant tout : en multi-postes, la base locale n'est même pas
  // ouverte. C'est ce qui garantit qu'aucun écran n'affichera par erreur des
  // données locales alors que l'utilisateur croit travailler sur le serveur.
  const { mode } = lireConfigurationMultipostes()

  if (mode === 'local') {
    migrerAncienDossierDonnees()
    ouvrirBaseDeDonnees()
    sauvegarderBaseDeDonnees()

    enregistrerHandlersEntreprise()
    enregistrerHandlersParametres()
    enregistrerHandlersTarifs()
    enregistrerHandlersJournal()
    enregistrerHandlersClients()
    enregistrerHandlersFactures()
    enregistrerHandlersDevis()
    enregistrerHandlersParametresApp()
    enregistrerHandlersRappels()
    enregistrerHandlersModeles()
    enregistrerHandlersTableauDeBord()
    enregistrerHandlersSuiviTemps()
    enregistrerHandlersJustificatifs()
    enregistrerHandlersComptabilite()
    enregistrerHandlersAudit()
    enregistrerHandlersRecherche()
    enregistrerHandlersConformite()
    enregistrerHandlersConditions()
    enregistrerHandlersInventaire()
    enregistrerHandlersResume()
    enregistrerHandlersDocuments()
  } else {
    // Mêmes noms de canaux, servis par le serveur. L'interface ne voit rien.
    enregistrerHandlersDistants()
  }

  // Ce qui concerne cette machine-ci existe dans les deux modes : boîtes de
  // dialogue, fichiers, impression, mises à jour.
  enregistrerHandlersMultipostes()
  enregistrerHandlersApparence()
  enregistrerHandlersComptabilitePoste()
  enregistrerHandlersEntreprisePoste()
  enregistrerHandlersJustificatifsPoste()
  enregistrerHandlersParametresAppPoste()
  enregistrerHandlersConditionsPoste()
  enregistrerHandlersMaj()
  enregistrerHandlersPdf()

  creerFenetrePrincipale()
  verifierMajAuDemarrage()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetrePrincipale()
  })
})

app.on('window-all-closed', () => {
  // fermerBaseDeDonnees() ne fait rien si aucune base n'a été ouverte —
  // c'est le cas en mode multi-postes.
  fermerBaseDeDonnees()
  if (process.platform !== 'darwin') app.quit()
})
