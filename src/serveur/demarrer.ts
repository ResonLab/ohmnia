import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { demarrerServeur } from './index'
import { fermerBaseDeDonnees } from '../main/db/database'
import { fermerBaseComptes } from './comptes'
import { fabriquerCertificatAutoSigne } from './certificat'

/**
 * Lancement du serveur multi-postes en ligne de commande.
 *
 * Jusqu'ici, seul le code de test savait démarrer le serveur : la
 * fonctionnalité existait sans que personne puisse s'en servir. Ce fichier est
 * ce qu'on lance réellement sur la machine qui héberge les données.
 *
 *   node ohmnia-serveur.mjs --donnees "D:\\OhmniaServeur" --port 8787
 *
 * Il n'y a volontairement pas de fichier de configuration : tout est sur la
 * ligne de commande, donc visible dans le raccourci ou le service qui le
 * lance. Un réglage caché dans un fichier oublié est la meilleure façon de ne
 * plus savoir sur quoi tourne sa comptabilité.
 */

const AIDE = `
Ohmnia — serveur multi-postes

  node ohmnia-serveur.mjs --donnees <dossier> [options]

Options
  --donnees <dossier>     Où vivent la base, les sauvegardes et les fichiers
                          joints. Obligatoire. Créé s'il n'existe pas.
  --port <numero>         Port d'écoute (8787 par défaut).
  --hote <adresse>        127.0.0.1 par défaut : le serveur n'est alors
                          joignable que depuis cette machine. Mettre 0.0.0.0
                          pour l'ouvrir au réseau local.
  --certificat <fichier>  Certificat au format PEM.
  --cle <fichier>         Clé privée au format PEM.
  --creer-certificat      Fabrique un certificat auto-signé dans le dossier des
                          données, puis s'arrête. Rien n'est écrasé.
  --aide                  Affiche ce message.

Si le dossier des données contient déjà « certificat.pem » et « cle.pem », le
serveur les utilise sans qu'on ait à les indiquer.

Première mise en service
  1. Démarrer sur 127.0.0.1 (le défaut).
  2. Depuis un poste Ohmnia : Paramètres de l'app -> Mode multi-postes,
     renseigner l'adresse, puis créer le premier administrateur.
  3. Arrêter le serveur, le relancer avec --hote 0.0.0.0 et un certificat.
  4. Créer les comptes des collègues depuis un poste administrateur.

Le serveur refuse d'écouter sur le réseau tant qu'aucun administrateur
n'existe, et refuse de le faire sans chiffrement : mots de passe et jetons
circuleraient en clair.

Fabriquer un certificat auto-signé (valable 5 ans), avec OpenSSL — livré avec
Git pour Windows :

  openssl req -x509 -newkey rsa:2048 -nodes -days 1825 \\
    -keyout cle.pem -out certificat.pem -subj "/CN=ohmnia"

Chaque poste devra accepter ce certificat une première fois.
`

export interface Arguments {
  donnees: string
  port: number
  hote: string
  certificat?: string
  cleePrivee?: string
  creerCertificat: boolean
}

/** Noms de fichiers repris automatiquement dans le dossier des données. */
export const NOM_CERTIFICAT = 'certificat.pem'
export const NOM_CLE = 'cle.pem'

/**
 * Lecture des arguments, séparée du démarrage pour être vérifiable :
 * un message d'erreur en français vaut mieux qu'une pile d'appels Node.
 */
export function lireArguments(argv: string[]): Arguments {
  const valeurs = new Map<string, string>()

  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i]
    if (!argument.startsWith('--')) continue

    const nom = argument.slice(2)
    const suivant = argv[i + 1]
    if (suivant === undefined || suivant.startsWith('--')) {
      valeurs.set(nom, '')
    } else {
      valeurs.set(nom, suivant)
      i += 1
    }
  }

  const connus = ['donnees', 'port', 'hote', 'certificat', 'cle', 'creer-certificat', 'aide']
  for (const nom of valeurs.keys()) {
    if (!connus.includes(nom)) {
      throw new Error(`Option inconnue : « --${nom} ». Lancez avec --aide pour la liste.`)
    }
  }

  const donnees = valeurs.get('donnees')
  if (!donnees) {
    throw new Error(
      'Le dossier des données est obligatoire : --donnees "D:\\OhmniaServeur". ' +
        "C'est là que vivront la base, les sauvegardes et les fichiers joints."
    )
  }

  const portBrut = valeurs.get('port') ?? '8787'
  const port = Number(portBrut)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Port invalide : « ${portBrut} ». Attendu : un nombre entre 1 et 65535.`)
  }

  const certificat = valeurs.get('certificat') || undefined
  const cleePrivee = valeurs.get('cle') || undefined
  if (Boolean(certificat) !== Boolean(cleePrivee)) {
    throw new Error(
      'Le certificat et la clé privée vont ensemble : fournissez --certificat et --cle, ou aucun des deux.'
    )
  }

  const dossier = resolve(donnees)

  // Repris tout seuls s'ils sont là : sans cela, on relance le serveur sur le
  // réseau, il refuse faute de chiffrement, et on est tenté de chercher
  // comment contourner le refus plutôt que de retaper deux chemins.
  const certificatParDefaut = join(dossier, NOM_CERTIFICAT)
  const cleParDefaut = join(dossier, NOM_CLE)
  const trouves =
    !certificat && !cleePrivee && existsSync(certificatParDefaut) && existsSync(cleParDefaut)

  return {
    donnees: dossier,
    port,
    hote: valeurs.get('hote') || '127.0.0.1',
    certificat: certificat ? resolve(certificat) : trouves ? certificatParDefaut : undefined,
    cleePrivee: cleePrivee ? resolve(cleePrivee) : trouves ? cleParDefaut : undefined,
    creerCertificat: valeurs.has('creer-certificat')
  }
}

/**
 * Écrit un certificat auto-signé dans le dossier des données.
 * Refuse d'écraser : un certificat déjà accepté sur les postes serait remplacé
 * par un inconnu, et chaque poste redemanderait confirmation sans qu'on
 * comprenne pourquoi.
 */
function creerCertificat(dossier: string): boolean {
  const cheminCertificat = join(dossier, NOM_CERTIFICAT)
  const cheminCle = join(dossier, NOM_CLE)

  if (existsSync(cheminCertificat) || existsSync(cheminCle)) {
    console.error(
      `\nUn certificat existe déjà dans ${dossier}.\n` +
        'Supprimez « certificat.pem » et « cle.pem » si vous voulez vraiment en ' +
        'fabriquer un autre — les postes devront alors tous le réaccepter.\n'
    )
    return false
  }

  const certificat = fabriquerCertificatAutoSigne()
  writeFileSync(cheminCertificat, certificat.certificatPem, 'utf-8')
  writeFileSync(cheminCle, certificat.clePem, { encoding: 'utf-8', mode: 0o600 })

  console.log('\nCertificat auto-signé créé.')
  console.log(`  Certificat  ${cheminCertificat}`)
  console.log(`  Clé privée  ${cheminCle}`)
  console.log(`  Valable     jusqu'au ${certificat.expireLe.toISOString().slice(0, 10)}`)
  console.log(`  Couvre      ${certificat.couvre.join(', ')}`)
  console.log(
    '\nLe serveur le reprendra tout seul au prochain démarrage.\n' +
      "Chaque poste devra l'accepter une première fois : c'est normal pour un\n" +
      'certificat auto-signé, il chiffre la liaison mais aucune autorité ne le\n' +
      'garantit. Gardez la clé privée pour vous.\n'
  )
  return true
}

export function demarrerDepuisLaLigneDeCommande(argv: string[], version: string): void {
  if (argv.includes('--aide') || argv.includes('-h') || argv.length === 0) {
    console.log(AIDE)
    return
  }

  let options: Arguments
  try {
    options = lireArguments(argv)
  } catch (erreur) {
    // Message en français, sans pile d'appels : celui qui lance le serveur
    // n'est pas forcément celui qui a écrit le code.
    console.error(`\n${erreur instanceof Error ? erreur.message : String(erreur)}\n`)
    process.exitCode = 1
    return
  }

  if (!existsSync(options.donnees)) mkdirSync(options.donnees, { recursive: true })

  if (options.creerCertificat) {
    if (!creerCertificat(options.donnees)) process.exitCode = 1
    return
  }

  let serveur: ReturnType<typeof demarrerServeur>
  try {
    serveur = demarrerServeur({
      dossierDonnees: options.donnees,
      version,
      port: options.port,
      hote: options.hote,
      certificat: options.certificat,
      cleePrivee: options.cleePrivee
    })
  } catch (erreur) {
    console.error(`\n${erreur instanceof Error ? erreur.message : String(erreur)}\n`)
    process.exitCode = 1
    return
  }

  const protocole = options.certificat ? 'https' : 'http'
  const affichage = options.hote === '0.0.0.0' ? "l'adresse de cette machine" : options.hote

  serveur.on('listening', () => {
    console.log(`\nOhmnia serveur ${version}`)
    console.log(`  Écoute      ${protocole}://${affichage}:${options.port}`)
    console.log(`  Données     ${options.donnees}`)
    if (options.certificat) {
      console.log(`  Chiffrement ${options.certificat}`)
    } else {
      console.log('  Chiffrement aucun (accepté seulement en local)')
    }
    console.log('\nCtrl+C pour arrêter.\n')
  })

  serveur.on('error', (erreur: NodeJS.ErrnoException) => {
    if (erreur.code === 'EADDRINUSE') {
      console.error(
        `\nLe port ${options.port} est déjà utilisé sur cette machine. ` +
          'Choisissez-en un autre avec --port, ou arrêtez le programme qui l’occupe.\n'
      )
    } else if (erreur.code === 'EACCES') {
      console.error(
        `\nAccès refusé au port ${options.port}. Sous Windows, les ports inférieurs à 1024 ` +
          'demandent des droits administrateur : prenez un port plus élevé, 8787 par exemple.\n'
      )
    } else {
      console.error(`\nLe serveur n'a pas pu démarrer : ${erreur.message}\n`)
    }
    process.exitCode = 1
  })

  // Arrêt propre : les bases sont refermées, sinon le journal WAL resterait
  // en plan et la prochaine sauvegarde pourrait être incomplète.
  let arretEnCours = false
  const arreter = (): void => {
    if (arretEnCours) return
    arretEnCours = true
    console.log('\nArrêt du serveur…')
    serveur.close(() => {
      fermerBaseDeDonnees()
      fermerBaseComptes()
      console.log('Bases refermées proprement.')
    })
  }

  process.on('SIGINT', arreter)
  process.on('SIGTERM', arreter)
}
