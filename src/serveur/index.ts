import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { definirContexte } from '../main/contexte'
import { ouvrirBaseDeDonnees } from '../main/db/database'
import { REGISTRE } from './registre'

/**
 * Serveur multi-postes — squelette.
 *
 * Il réutilise telle quelle la logique métier de `main/domaines/`, sans Electron :
 * c'est tout l'objet de l'étape 1. Une opération donne le même résultat qu'elle
 * passe par la fenêtre de l'application ou par le réseau.
 *
 * ⚠️ **Il n'y a encore aucune authentification.** C'est l'étape 2. Tant qu'elle
 * n'est pas faite, ce serveur ne doit jamais écouter ailleurs que sur la machine
 * locale : n'importe qui sur le réseau pourrait lire et modifier la
 * comptabilité. Le code refuse d'ailleurs de démarrer sur une autre adresse
 * (voir `demarrerServeur`).
 *
 * Protocole, volontairement minimal :
 *   POST /api/<canal>   corps : { "arguments": [ ... ] }
 *   → 200 { "resultat": ... }
 *   → 400 { "erreur": "message en français" }
 */

const TAILLE_MAX_CORPS = 5 * 1024 * 1024

export interface OptionsServeur {
  /** Dossier des données, comme `%APPDATA%\Ohmnia` côté application. */
  dossierDonnees: string
  version: string
  port: number
  /**
   * Adresse d'écoute. Tant que l'authentification n'existe pas, seule
   * l'écoute locale est acceptée.
   */
  hote?: string
}

function repondre(reponse: ServerResponse, code: number, corps: unknown): void {
  const texte = JSON.stringify(corps)
  reponse.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texte)
  })
  reponse.end(texte)
}

function lireCorps(requete: IncomingMessage): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    let corps = ''
    requete.on('data', (morceau) => {
      corps += morceau
      // Une requête démesurée est refusée avant de remplir la mémoire.
      if (corps.length > TAILLE_MAX_CORPS) {
        rejeter(new Error('Requête trop volumineuse.'))
        requete.destroy()
      }
    })
    requete.on('end', () => resoudre(corps))
    requete.on('error', rejeter)
  })
}

async function traiter(requete: IncomingMessage, reponse: ServerResponse): Promise<void> {
  if (requete.method !== 'POST') {
    return repondre(reponse, 405, { erreur: 'Seules les requêtes POST sont acceptées.' })
  }

  const chemin = (requete.url ?? '').split('?')[0]
  if (!chemin.startsWith('/api/')) {
    return repondre(reponse, 404, { erreur: 'Adresse inconnue.' })
  }

  const canal = decodeURIComponent(chemin.slice('/api/'.length))
  const operation = REGISTRE[canal]
  if (!operation) {
    return repondre(reponse, 404, { erreur: `L'opération « ${canal} » n'existe pas.` })
  }

  let arguments_: unknown[]
  try {
    const corps = await lireCorps(requete)
    const analyse = corps ? JSON.parse(corps) : {}
    arguments_ = Array.isArray(analyse.arguments) ? analyse.arguments : []
  } catch {
    return repondre(reponse, 400, { erreur: 'Le corps de la requête est illisible.' })
  }

  try {
    // Les messages d'erreur métier sont écrits en français à destination de
    // l'utilisateur : on les transmet tels quels.
    return repondre(reponse, 200, { resultat: operation(...arguments_) ?? null })
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur)
    return repondre(reponse, 400, { erreur: message })
  }
}

export function demarrerServeur(options: OptionsServeur): ReturnType<typeof createServer> {
  const hote = options.hote ?? '127.0.0.1'

  // Garde-fou volontaire, à retirer seulement quand l'étape 2 aura apporté les
  // comptes et les droits. Exposer ces données sans authentification serait
  // pire que de ne pas avoir de serveur du tout.
  if (hote !== '127.0.0.1' && hote !== 'localhost') {
    throw new Error(
      "Le serveur n'a pas encore d'authentification : il ne peut écouter que sur " +
        `127.0.0.1, pas sur « ${hote} ». Sans cela, n'importe qui sur le réseau ` +
        'pourrait lire et modifier vos données.'
    )
  }

  definirContexte({ dossierDonnees: options.dossierDonnees, version: options.version })
  ouvrirBaseDeDonnees()

  const serveur = createServer((requete, reponse) => {
    traiter(requete, reponse).catch(() => {
      repondre(reponse, 500, { erreur: 'Erreur interne du serveur.' })
    })
  })

  serveur.listen(options.port, hote)
  return serveur
}
