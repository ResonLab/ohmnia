import { request as requeteHttp } from 'node:http'
import { request as requeteHttps } from 'node:https'
import { lireConfigurationMultipostes } from './configuration'
import type { SessionMultipostes } from '../../shared/types'

/**
 * Le poste vu comme client du serveur multi-postes.
 *
 * Il rejoue le protocole de `src/serveur/index.ts` : `POST /api/<canal>` avec
 * `{ "arguments": [...] }`. Les noms de canaux sont ceux de l'IPC, donc
 * l'interface appelle exactement les mêmes qu'en mode local — c'est tout
 * l'intérêt d'avoir gardé les mêmes noms depuis l'étape 1.
 *
 * **Le jeton ne vit qu'en mémoire.** Fermer l'application ferme la session :
 * un jeton écrit sur le disque survivrait au vol de l'ordinateur.
 *
 * On passe par `node:http` plutôt que `fetch` : `fetch` garde des connexions
 * dans un pool, ce qui faisait planter Node à la fermeture (piège déjà
 * rencontré, voir CONTEXTE.md).
 */

export type SessionCourante = SessionMultipostes

let jeton: string | null = null
let session: SessionCourante | null = null

/**
 * Prévenu quand la session tombe. Sans cela, l'utilisateur verrait la même
 * erreur à chaque clic sans comprendre qu'il doit se reconnecter — et pourrait
 * croire que son travail est perdu alors qu'il suffit de rouvrir une session.
 */
let surSessionPerdue: (() => void) | null = null

export function prevenirSurSessionPerdue(rappel: () => void): void {
  surSessionPerdue = rappel
}

/** Erreur reconnaissable : la session est tombée, il faut se reconnecter. */
export class SessionPerdue extends Error {
  constructor() {
    super('Votre session a expiré. Reconnectez-vous pour continuer.')
    this.name = 'SessionPerdue'
  }
}

export function sessionCourante(): SessionCourante | null {
  return session
}

export function estConnecte(): boolean {
  return jeton !== null
}

function adresseServeur(): string {
  const { adresse } = lireConfigurationMultipostes()
  if (!adresse) throw new Error("Aucune adresse de serveur n'est configurée.")
  return adresse
}

interface ReponseServeur {
  code: number
  corps: { resultat?: unknown; erreur?: string }
}

function envoyer(
  adresse: string,
  canal: string,
  arguments_: unknown[],
  jetonUtilise: string | null,
  delaiMs = 15000
): Promise<ReponseServeur> {
  return new Promise((resoudre, rejeter) => {
    let cible: URL
    try {
      cible = new URL(adresse)
    } catch {
      return rejeter(new Error(`Adresse de serveur invalide : « ${adresse} ».`))
    }

    const corps = JSON.stringify({ arguments: arguments_ })
    const entetes: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(corps)),
      Connection: 'close'
    }
    if (jetonUtilise) entetes.Authorization = `Bearer ${jetonUtilise}`

    const emettre = cible.protocol === 'https:' ? requeteHttps : requeteHttp
    const requete = emettre(
      {
        protocol: cible.protocol,
        hostname: cible.hostname,
        port: cible.port || (cible.protocol === 'https:' ? 443 : 80),
        path: '/api/' + encodeURIComponent(canal),
        method: 'POST',
        headers: entetes,
        timeout: delaiMs
      },
      (reponse) => {
        let texte = ''
        reponse.on('data', (m) => (texte += m))
        reponse.on('end', () => {
          try {
            resoudre({ code: reponse.statusCode ?? 0, corps: JSON.parse(texte || '{}') })
          } catch {
            rejeter(new Error("Le serveur a répondu quelque chose d'illisible."))
          }
        })
      }
    )

    requete.on('timeout', () => {
      requete.destroy()
      rejeter(
        new Error(
          `Le serveur ${adresse} ne répond pas. Vérifiez qu'il est allumé et que le réseau fonctionne.`
        )
      )
    })
    requete.on('error', () => {
      // Le message système ("ECONNREFUSED") ne dit rien à l'utilisateur.
      rejeter(
        new Error(
          `Impossible de joindre le serveur ${adresse}. Vérifiez l'adresse, ` +
            'que le serveur est démarré, et que le pare-feu laisse passer.'
        )
      )
    })
    requete.end(corps)
  })
}

/** Vérifie qu'un serveur répond à cette adresse, sans ouvrir de session. */
export async function testerServeur(adresse: string): Promise<{ installe: boolean }> {
  const reponse = await envoyer(adresse, 'serveur:etat', [], null, 5000)
  if (reponse.code !== 200) {
    throw new Error(
      reponse.corps.erreur ?? "Cette adresse répond, mais ce n'est pas un serveur Ohmnia."
    )
  }
  return reponse.corps.resultat as { installe: boolean }
}

export async function ouvrirSessionDistante(
  identifiant: string,
  motDePasse: string
): Promise<SessionCourante> {
  const reponse = await envoyer(adresseServeur(), 'session:ouvrir', [identifiant, motDePasse], null)
  if (reponse.code !== 200) {
    throw new Error(reponse.corps.erreur ?? 'Connexion refusée.')
  }

  const resultat = reponse.corps.resultat as {
    jeton: string
    expireLe: string
    compte: { identifiant: string; nomAffiche: string; role: SessionCourante['role'] }
  }
  jeton = resultat.jeton
  session = {
    identifiant: resultat.compte.identifiant,
    nomAffiche: resultat.compte.nomAffiche,
    role: resultat.compte.role,
    expireLe: resultat.expireLe
  }
  return session
}

export async function creerPremierAdministrateurDistant(
  identifiant: string,
  motDePasse: string,
  nomAffiche: string
): Promise<void> {
  const reponse = await envoyer(
    adresseServeur(),
    'comptes:creerPremierAdministrateur',
    [identifiant, motDePasse, nomAffiche],
    null
  )
  if (reponse.code !== 200) throw new Error(reponse.corps.erreur ?? 'Création refusée.')
}

export async function fermerSessionDistante(): Promise<void> {
  if (!jeton) return
  try {
    await envoyer(adresseServeur(), 'session:fermer', [], jeton, 5000)
  } catch {
    // Le serveur est peut-être déjà injoignable ; on oublie le jeton de toute
    // façon, sinon l'utilisateur resterait coincé dans un état « connecté ».
  }
  jeton = null
  session = null
}

/**
 * Exécute une opération sur le serveur. C'est le pendant exact d'un
 * `ipcMain.handle` local : mêmes arguments, même résultat, mêmes messages
 * d'erreur en français — ils viennent de la même fonction métier.
 */
export async function appelerServeur(canal: string, arguments_: unknown[]): Promise<unknown> {
  if (!jeton) throw new SessionPerdue()

  const reponse = await envoyer(adresseServeur(), canal, arguments_, jeton)

  if (reponse.code === 401) {
    // Le jeton ne vaut plus rien : l'oublier tout de suite, sinon chaque appel
    // suivant repartirait vers le serveur pour se faire refuser pareil.
    jeton = null
    session = null
    surSessionPerdue?.()
    throw new SessionPerdue()
  }
  if (reponse.code !== 200) {
    throw new Error(reponse.corps.erreur ?? 'Le serveur a refusé cette opération.')
  }
  return reponse.corps.resultat
}
