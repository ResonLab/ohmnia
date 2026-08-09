import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { definirContexte } from '../main/contexte'
import { ouvrirBaseDeDonnees } from '../main/db/database'
import { REGISTRE, type Operation } from './registre'
import { roleExige } from './droits'
import {
  changerMotDePasse,
  changerRole,
  compteDeLaSession,
  creerCompte,
  creerPremierAdministrateur,
  desactiverCompte,
  existeAdministrateurActif,
  fermerSession,
  listerAcces,
  listerComptes,
  nombreDeComptes,
  ouvrirBaseComptes,
  ouvrirSession,
  reactiverCompte,
  roleSuffit,
  tracerAcces,
  type Compte,
  type Role
} from './comptes'

/**
 * Serveur multi-postes.
 *
 * Il réutilise telle quelle la logique métier de `main/domaines/`, sans Electron :
 * c'était l'objet de l'étape 1. Une opération donne le même résultat qu'elle
 * passe par la fenêtre de l'application ou par le réseau.
 *
 * **Étape 2 : toute opération métier exige une session ouverte.** Le jeton
 * voyage dans l'en-tête `Authorization: Bearer <jeton>`. Le rôle nécessaire se
 * lit dans `./droits.ts`, et une opération sans droit déclaré est refusée.
 *
 * Protocole, volontairement minimal :
 *   POST /api/<canal>   corps : { "arguments": [ ... ] }
 *   → 200 { "resultat": ... }
 *   → 400 { "erreur": "message en français" }   erreur métier
 *   → 401 { "erreur": ... }                      pas de session valable
 *   → 403 { "erreur": ... }                      session valable, droits insuffisants
 *
 * ⚠️ **Ce qui manque encore : le chiffrement du transport.** Les mots de passe
 * et les jetons circulent en clair en HTTP. Sur le réseau local d'une petite
 * entreprise c'est un risque assumé ; sur un réseau ouvert ou à travers
 * Internet, il faut mettre ce serveur derrière un reverse-proxy HTTPS.
 * C'est écrit ici parce que personne ne doit le découvrir en production.
 */

const TAILLE_MAX_CORPS = 5 * 1024 * 1024

export interface OptionsServeur {
  /** Dossier des données, comme `%APPDATA%\Ohmnia` côté application. */
  dossierDonnees: string
  version: string
  port: number
  /**
   * Adresse d'écoute. Ouvrir le serveur au réseau exige au moins un compte
   * administrateur : sinon n'importe qui pourrait s'en octroyer un.
   */
  hote?: string
}

/* ── Opérations propres au serveur ────────────────────────────────────────── */

/**
 * Ces opérations-là ne viennent pas de `domaines/` : elles n'existent que
 * parce qu'il y a un serveur. Elles ne peuvent donc pas figurer dans le
 * registre, dont chaque entrée doit correspondre à un canal IPC.
 */

/** Opérations accessibles sans session — la porte d'entrée, rien d'autre. */
const OPERATIONS_PUBLIQUES: Record<string, Operation> = {
  'session:ouvrir': (identifiant, motDePasse) =>
    ouvrirSession(identifiant as string, motDePasse as string),

  /**
   * Permet au client de savoir s'il doit proposer une connexion ou la création
   * du premier administrateur. Ne révèle rien d'autre qu'un état d'installation.
   */
  'serveur:etat': () => ({
    installe: nombreDeComptes() > 0,
    versionProtocole: 1
  }),

  /** N'aboutit que tant qu'aucun compte n'existe (voir `comptes.ts`). */
  'comptes:creerPremierAdministrateur': (identifiant, motDePasse, nomAffiche) =>
    creerPremierAdministrateur(
      identifiant as string,
      motDePasse as string,
      (nomAffiche as string) ?? ''
    )
}

/** Opérations d'administration du serveur, réservées au rôle `administration`. */
const OPERATIONS_ADMINISTRATION: Record<string, Operation> = {
  'comptes:lister': () => listerComptes(),
  'comptes:creer': (identifiant, motDePasse, role, nomAffiche) =>
    creerCompte(
      identifiant as string,
      motDePasse as string,
      role as Role,
      (nomAffiche as string) ?? ''
    ),
  'comptes:changerRole': (identifiant, role) => changerRole(identifiant as string, role as Role),
  'comptes:desactiver': (identifiant) => desactiverCompte(identifiant as string),
  'comptes:reactiver': (identifiant) => reactiverCompte(identifiant as string),
  'acces:lister': (limite) => listerAcces((limite as number) ?? 300)
}

/**
 * Opérations qu'un compte exécute sur lui-même, quel que soit son rôle.
 * Changer son propre mot de passe ne doit pas demander d'être administrateur.
 */
const OPERATIONS_PERSONNELLES: Record<string, (compte: Compte, ...a: unknown[]) => unknown> = {
  'session:fermer': () => null, // traité à part : le jeton n'est pas un argument
  'session:moi': (compte) => compte,
  'moncompte:changerMotDePasse': (compte, nouveau) =>
    changerMotDePasse(compte.identifiant, nouveau as string)
}

/* ── Transport ────────────────────────────────────────────────────────────── */

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

/** Extrait le jeton de `Authorization: Bearer <jeton>`. */
function jetonDeLaRequete(requete: IncomingMessage): string {
  const entete = requete.headers.authorization ?? ''
  return entete.startsWith('Bearer ') ? entete.slice('Bearer '.length).trim() : ''
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

  let arguments_: unknown[]
  try {
    const corps = await lireCorps(requete)
    const analyse = corps ? JSON.parse(corps) : {}
    arguments_ = Array.isArray(analyse.arguments) ? analyse.arguments : []
  } catch {
    return repondre(reponse, 400, { erreur: 'Le corps de la requête est illisible.' })
  }

  const executer = (operation: () => unknown): void => {
    try {
      // Les messages d'erreur métier sont écrits en français à destination de
      // l'utilisateur : on les transmet tels quels.
      return repondre(reponse, 200, { resultat: operation() ?? null })
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur)
      return repondre(reponse, 400, { erreur: message })
    }
  }

  // 1. La porte d'entrée, sans session.
  const publique = OPERATIONS_PUBLIQUES[canal]
  if (publique) return executer(() => publique(...arguments_))

  // 2. Tout le reste exige une session valable.
  const jeton = jetonDeLaRequete(requete)
  const compte = jeton ? compteDeLaSession(jeton) : null
  if (!compte) {
    return repondre(reponse, 401, {
      erreur: 'Session expirée ou absente. Reconnectez-vous.'
    })
  }

  if (canal === 'session:fermer') {
    return executer(() => {
      fermerSession(jeton)
      tracerAcces(compte.identifiant, 'session:fermer', 'succes')
      return null
    })
  }

  const personnelle = OPERATIONS_PERSONNELLES[canal]
  if (personnelle) return executer(() => personnelle(compte, ...arguments_))

  const administration = OPERATIONS_ADMINISTRATION[canal]
  if (administration) {
    if (!roleSuffit(compte.role, 'administration')) {
      tracerAcces(compte.identifiant, canal, 'refus', `Rôle ${compte.role}`)
      return repondre(reponse, 403, {
        erreur: "Cette opération est réservée aux administrateurs du serveur."
      })
    }
    return executer(() => administration(...arguments_))
  }

  // 3. Les opérations métier, communes aux deux modes.
  const operation = REGISTRE[canal]
  if (!operation) {
    return repondre(reponse, 404, { erreur: `L'opération « ${canal} » n'existe pas.` })
  }

  const exige = roleExige(canal)
  if (!exige) {
    // Ne devrait jamais arriver : `npm test` vérifie que chaque opération du
    // registre a un droit déclaré. Si cela se produit malgré tout, refuser est
    // la seule réponse sûre.
    tracerAcces(compte.identifiant, canal, 'refus', 'Aucun droit déclaré')
    return repondre(reponse, 403, {
      erreur: `Aucun droit n'est déclaré pour « ${canal} » : l'opération est refusée par précaution.`
    })
  }

  if (!roleSuffit(compte.role, exige)) {
    tracerAcces(compte.identifiant, canal, 'refus', `Rôle ${compte.role}, exigé ${exige}`)
    return repondre(reponse, 403, {
      erreur: `Votre rôle « ${compte.role} » ne permet pas cette opération (rôle « ${exige} » requis).`
    })
  }

  // Seules les opérations qui modifient quelque chose sont tracées : tracer
  // chaque lecture noierait le journal et le rendrait inutile.
  if (exige !== 'lecture') tracerAcces(compte.identifiant, canal, 'succes')

  return executer(() => operation(...arguments_))
}

export function demarrerServeur(options: OptionsServeur): ReturnType<typeof createServer> {
  const hote = options.hote ?? '127.0.0.1'

  definirContexte({ dossierDonnees: options.dossierDonnees, version: options.version })
  ouvrirBaseComptes()
  ouvrirBaseDeDonnees()

  // Ouvrir le serveur au réseau alors qu'aucun compte n'existe reviendrait à
  // laisser le premier venu créer l'administrateur — donc à donner les clés de
  // la comptabilité à qui passe par là. En local, l'installation reste possible.
  const estLocal = hote === '127.0.0.1' || hote === 'localhost'
  if (!estLocal && !existeAdministrateurActif()) {
    throw new Error(
      `Le serveur ne peut pas écouter sur « ${hote} » : aucun compte administrateur ` +
        "n'existe encore. Démarrez-le d'abord sur 127.0.0.1, créez le premier " +
        'administrateur, puis rouvrez-le sur le réseau.'
    )
  }

  const serveur = createServer((requete, reponse) => {
    traiter(requete, reponse).catch(() => {
      repondre(reponse, 500, { erreur: 'Erreur interne du serveur.' })
    })
  })

  serveur.listen(options.port, hote)
  return serveur
}
