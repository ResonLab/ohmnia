// Le serveur doit pouvoir être lancé par quelqu'un, pas seulement par les tests.
//
// Jusqu'à ce que ce lanceur existe, `demarrerServeur` n'était appelé que depuis
// les suites de test : la fonctionnalité passait toutes les vérifications sans
// que personne puisse s'en servir. Cette suite démarre le vrai binaire compilé
// et lui parle par le réseau.
import { readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { request } from 'node:http'
import { request as requeteTls } from 'node:https'
import { spawn, execFileSync } from 'node:child_process'
import { X509Certificate } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const DOSSIER_TESTS = dirname(fileURLToPath(import.meta.url))
const PROJET = join(DOSSIER_TESTS, '..')
const SRC = join(PROJET, 'src')

let echecs = 0
function verifier(intitule, condition, detail = '') {
  if (!condition) echecs += 1
  console.log(`  ${condition ? 'OK  ' : 'ECHEC'} ${intitule}`)
  if (!condition && detail) console.log(`        ${detail}`)
}

/* ── 1. La version annoncée par le serveur est celle du projet ───────────── */

console.log('\n=== Version ===')

const paquet = JSON.parse(readFileSync(join(PROJET, 'package.json'), 'utf-8'))
const versionSource = readFileSync(join(SRC, 'serveur/version.ts'), 'utf-8')
const versionServeur = versionSource.match(/VERSION_SERVEUR = '([^']+)'/)?.[1]

// Le serveur est copié seul sur la machine qui héberge les données : il n'a pas
// de package.json à côté et porte donc sa version en dur. Elle dérive vite.
verifier(
  `la version du serveur (${versionServeur}) est celle du projet (${paquet.version})`,
  versionServeur === paquet.version
)

verifier(
  'le projet sait construire et lancer le serveur',
  typeof paquet.scripts['serveur:build'] === 'string' && typeof paquet.scripts.serveur === 'string'
)

/* ── 2. Les arguments sont contrôlés, avec des messages en français ──────── */

console.log('\n=== Lecture des arguments ===')

const DOSSIER = join(tmpdir(), 'ohmnia-test-lancement')
rmSync(DOSSIER, { recursive: true, force: true })
mkdirSync(DOSSIER, { recursive: true })

const bundleArguments = join(DOSSIER, 'demarrer.mjs')
await build({
  entryPoints: [join(PROJET, '../Nexika/serveur/demarrer.ts')],
  outfile: bundleArguments,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['node:*'],
  plugins: [
    {
      name: 'sql-brut',
      setup(constructeur) {
        constructeur.onResolve({ filter: /\.sql\?raw$/ }, (arg) => ({
          path: join(arg.resolveDir, arg.path.replace('?raw', '')),
          namespace: 'sql-brut'
        }))
        constructeur.onLoad({ filter: /.*/, namespace: 'sql-brut' }, (arg) => ({
          contents: `export default ${JSON.stringify(readFileSync(arg.path, 'utf-8'))}`,
          loader: 'js'
        }))
      }
    }
  ],
  logLevel: 'silent'
})

const { lireArguments } = await import('file://' + bundleArguments.replace(/\\/g, '/'))

function messageDe(argv) {
  try {
    lireArguments(argv)
    return null
  } catch (erreur) {
    return erreur.message
  }
}

verifier(
  'le dossier de données est obligatoire',
  (messageDe(['--port', '8787']) ?? '').includes('dossier des données est obligatoire')
)
verifier(
  'un port qui n’est pas un nombre est refusé',
  (messageDe(['--donnees', DOSSIER, '--port', 'abc']) ?? '').includes('Port invalide')
)
verifier(
  'un port hors bornes est refusé',
  (messageDe(['--donnees', DOSSIER, '--port', '70000']) ?? '').includes('Port invalide')
)
verifier(
  'une option mal orthographiée est signalée, pas ignorée',
  (messageDe(['--donnees', DOSSIER, '--prot', '8787']) ?? '').includes('Option inconnue')
)
verifier(
  'un certificat sans clé privée est refusé',
  (messageDe(['--donnees', DOSSIER, '--certificat', 'c.pem']) ?? '').includes('vont ensemble')
)

const parDefaut = lireArguments(['--donnees', DOSSIER])
verifier(
  'sans réglage, le serveur reste sur 127.0.0.1',
  parDefaut.hote === '127.0.0.1' && parDefaut.port === 8787
)

/* ── 3. Le binaire compilé démarre et répond ─────────────────────────────── */

console.log('\n=== Démarrage réel ===')

execFileSync(process.execPath, [join(PROJET, 'scripts/construire-serveur.mjs')], {
  stdio: 'ignore'
})
const binaire = join(PROJET, 'out/serveur/ohmnia-serveur.mjs')
verifier('le serveur se compile en un seul fichier', existsSync(binaire))

const DOSSIER_EXECUTION = join(DOSSIER, 'donnees')
const PORT = 8899

const processus = spawn(process.execPath, [binaire, '--donnees', DOSSIER_EXECUTION, '--port', String(PORT)], {
  stdio: ['ignore', 'pipe', 'pipe']
})

let sortie = ''
processus.stdout.on('data', (m) => (sortie += m))
processus.stderr.on('data', (m) => (sortie += m))

// On attend que le serveur annonce son écoute plutôt qu'un délai fixe : une
// attente au jugé rend le test capricieux sur une machine chargée.
await new Promise((resoudre, rejeter) => {
  const limite = setTimeout(() => rejeter(new Error(`Le serveur n'a rien annoncé :\n${sortie}`)), 20000)
  const verifierSortie = () => {
    if (sortie.includes('Ctrl+C')) {
      clearTimeout(limite)
      resoudre()
    }
  }
  processus.stdout.on('data', verifierSortie)
  processus.on('exit', () => {
    clearTimeout(limite)
    rejeter(new Error(`Le serveur s'est arrêté aussitôt :\n${sortie}`))
  })
})

verifier('le serveur annonce où il écoute et où sont les données', sortie.includes(`:${PORT}`) && sortie.includes(DOSSIER_EXECUTION))
verifier("l'absence de chiffrement est annoncée, pas tue", sortie.includes('Chiffrement aucun'))

const reponse = await new Promise((resoudre, rejeter) => {
  const corps = JSON.stringify({ arguments: [] })
  const requete = request(
    {
      host: '127.0.0.1',
      port: PORT,
      path: '/api/' + encodeURIComponent('serveur:etat'),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(corps),
        Connection: 'close'
      }
    },
    (rep) => {
      let texte = ''
      rep.on('data', (m) => (texte += m))
      rep.on('end', () => resoudre({ code: rep.statusCode, corps: JSON.parse(texte) }))
    }
  )
  requete.on('error', rejeter)
  requete.end(corps)
})

verifier(
  'le serveur lancé en ligne de commande répond vraiment',
  reponse.code === 200 && reponse.corps.resultat.installe === false
)

verifier(
  'les deux bases sont créées dans le dossier indiqué',
  existsSync(join(DOSSIER_EXECUTION, 'gestion.sqlite')) &&
    existsSync(join(DOSSIER_EXECUTION, 'comptes.sqlite'))
)

processus.kill()
await new Promise((resoudre) => processus.on('exit', resoudre))

/* ── 4. Le certificat fabriqué par l'application sert vraiment ───────────── */

console.log('\n=== Certificat auto-signé ===')

// Le serveur refuse le réseau sans chiffrement. Si obtenir un certificat
// demandait d'aller chercher OpenSSL, on contournerait le refus plutôt que de
// le satisfaire : la mesure de sécurité échouerait par sa mise en œuvre.
const DOSSIER_TLS = join(DOSSIER, 'tls')

function lancer(arguments_) {
  return new Promise((resoudre, rejeter) => {
    const enfant = spawn(process.execPath, [binaire, ...arguments_], { stdio: ['ignore', 'pipe', 'pipe'] })
    let texte = ''
    enfant.stdout.on('data', (m) => (texte += m))
    enfant.stderr.on('data', (m) => (texte += m))
    enfant.on('exit', (code) => resoudre({ code, texte }))
    enfant.on('error', rejeter)
  })
}

const creation = await lancer(['--creer-certificat', '--donnees', DOSSIER_TLS])
verifier(
  'le certificat est fabriqué sans OpenSSL',
  creation.code === 0 &&
    existsSync(join(DOSSIER_TLS, 'certificat.pem')) &&
    existsSync(join(DOSSIER_TLS, 'cle.pem')),
  creation.texte
)
// On relit le certificat produit plutôt que ce que le programme a affiché :
// annoncer « couvre 127.0.0.1 » et ne pas l'inscrire dans le fichier est
// exactement le genre d'écart qu'une vérification doit attraper.
const certificatLu = new X509Certificate(readFileSync(join(DOSSIER_TLS, 'certificat.pem')))
verifier(
  'il couvre 127.0.0.1, sinon aucun poste ne pourrait vérifier la liaison',
  (certificatLu.subjectAltName ?? '').includes('IP Address:127.0.0.1'),
  certificatLu.subjectAltName ?? 'aucun autre nom'
)

// La liaison TLS du test se vérifie contre ce certificat lui-même : elle ne
// dirait donc rien d'une signature fausse. On la contrôle explicitement.
verifier('la signature du certificat est valide', certificatLu.verify(certificatLu.publicKey))

// `X509Certificate.ca` ne reflète pas de façon fiable ce qu'on a encodé : on
// contrôle plutôt l'usage étendu, qui, lui, est lisible tel qu'écrit.
verifier(
  "il ne sert qu'à authentifier un serveur TLS",
  (certificatLu.keyUsage ?? []).join(',') === '1.3.6.1.5.5.7.3.1',
  (certificatLu.keyUsage ?? []).join(', ')
)

verifier(
  'il est valable plusieurs années, pas quelques jours',
  new Date(certificatLu.validTo).getTime() - Date.now() > 4 * 365 * 86400000
)

// Écraser un certificat déjà accepté sur les postes les ferait tous
// redemander confirmation sans qu'on comprenne pourquoi.
const secondeCreation = await lancer(['--creer-certificat', '--donnees', DOSSIER_TLS])
verifier(
  "un certificat existant n'est jamais écrasé",
  secondeCreation.code === 1 && secondeCreation.texte.includes('existe déjà')
)

// La seule preuve qui vaille : une vraie liaison TLS, vérifiée contre ce
// certificat. Un certificat mal encodé serait rejeté ici.
const PORT_TLS = 8901
const processusTls = spawn(
  process.execPath,
  [binaire, '--donnees', DOSSIER_TLS, '--port', String(PORT_TLS)],
  { stdio: ['ignore', 'pipe', 'pipe'] }
)
let sortieTls = ''
processusTls.stdout.on('data', (m) => (sortieTls += m))
processusTls.stderr.on('data', (m) => (sortieTls += m))

await new Promise((resoudre, rejeter) => {
  const limite = setTimeout(() => rejeter(new Error(`Rien annoncé :\n${sortieTls}`)), 20000)
  processusTls.stdout.on('data', () => {
    if (sortieTls.includes('Ctrl+C')) {
      clearTimeout(limite)
      resoudre()
    }
  })
  processusTls.on('exit', () => {
    clearTimeout(limite)
    rejeter(new Error(`Arrêt immédiat :\n${sortieTls}`))
  })
})

verifier(
  'le certificat du dossier est repris sans qu’on ait à le désigner',
  sortieTls.includes('certificat.pem') && sortieTls.includes('https://')
)

const reponseTls = await new Promise((resoudre) => {
  const corps = JSON.stringify({ arguments: [] })
  const requete = requeteTls(
    {
      host: '127.0.0.1',
      port: PORT_TLS,
      path: '/api/' + encodeURIComponent('serveur:etat'),
      method: 'POST',
      ca: readFileSync(join(DOSSIER_TLS, 'certificat.pem')),
      servername: 'localhost',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(corps),
        Connection: 'close'
      }
    },
    (rep) => {
      let texte = ''
      rep.on('data', (m) => (texte += m))
      rep.on('end', () => resoudre({ code: rep.statusCode, corps: JSON.parse(texte) }))
    }
  )
  requete.on('error', (erreur) => resoudre({ code: 0, corps: { erreur: erreur.message } }))
  requete.end(corps)
})

verifier(
  'une vraie liaison chiffrée est établie et vérifiée contre ce certificat',
  reponseTls.code === 200,
  reponseTls.corps.erreur ?? ''
)

processusTls.kill()
await new Promise((resoudre) => processusTls.on('exit', resoudre))

console.log(echecs === 0 ? '\nLANCEMENT DU SERVEUR : VALIDE' : `\n${echecs} TEST(S) EN ECHEC`)
process.exitCode = echecs === 0 ? 0 : 1
