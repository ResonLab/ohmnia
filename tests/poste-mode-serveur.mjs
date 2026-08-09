// Étape 3 : un poste réglé en mode serveur travaille sur les données du
// serveur, et plus sur sa base locale.
//
// Comme pour l'étape 2, rien n'est transcrit : on compile le vrai serveur et
// le vrai client du poste (`src/main/multipostes/client.ts`) avec esbuild, et
// on les fait dialoguer pour de bon. Un test qui rejouerait le protocole à la
// main prouverait seulement que la copie est fidèle.
import { readFileSync, rmSync, mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

/* ── 1. Le poste n'ouvre pas sa base locale en mode serveur ──────────────── */

console.log('\n=== Choix du mode au démarrage ===')

const indexMain = readFileSync(join(SRC, 'main/index.ts'), 'utf-8')
verifier(
  'le mode est lu avant toute ouverture de base',
  indexMain.indexOf('lireConfigurationMultipostes()') < indexMain.indexOf('ouvrirBaseDeDonnees()')
)
verifier(
  "la base locale n'est ouverte que dans la branche locale",
  /if \(mode === 'local'\) \{[\s\S]*?ouvrirBaseDeDonnees\(\)/.test(indexMain)
)
verifier(
  'le mode serveur enregistre les canaux distants à la place',
  indexMain.includes('enregistrerHandlersDistants()')
)

// Le mode local reste le défaut : c'est un principe de la maison, pas un détail.
const configuration = readFileSync(join(SRC, 'main/multipostes/configuration.ts'), 'utf-8')
verifier("le mode local est le défaut", /mode: 'local'/.test(configuration))
verifier(
  "le mot de passe n'est jamais écrit dans la configuration",
  !/motDePasse/.test(configuration)
)

const client = readFileSync(join(SRC, 'main/multipostes/client.ts'), 'utf-8')
verifier(
  "le jeton ne vit qu'en mémoire, jamais sur le disque",
  !/writeFileSync|ecrireConfiguration/.test(client)
)

/* ── 1 bis. Aucun canal enregistré deux fois en mode serveur ─────────────── */

console.log('\n=== Pas de canal en double ===')

// En mode serveur, deux séries de handlers cohabitent : ceux renvoyés au
// serveur (la liste vient de DROITS) et ceux qui concernent ce poste-ci.
// Si un canal figurait dans les deux, `ipcMain.handle` lèverait au démarrage —
// l'application ne s'ouvrirait plus du tout, et seulement en mode serveur.
function canauxDeLaFonction(fichier, nomFonction) {
  const source = readFileSync(join(SRC, fichier), 'utf-8')
  const debut = source.indexOf(`export function ${nomFonction}`)
  if (debut < 0) return []
  const suite = source.slice(debut + 16)
  const fin = suite.indexOf('\nexport function ')
  const corps = fin < 0 ? suite : suite.slice(0, fin)
  return [...corps.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)].map((m) => m[1])
}

function canauxDuFichier(fichier) {
  const source = readFileSync(join(SRC, fichier), 'utf-8')
  return [...source.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)].map((m) => m[1])
}

const canauxPoste = [
  ...canauxDeLaFonction('main/ipc/comptabilite.ts', 'enregistrerHandlersComptabilitePoste'),
  ...canauxDeLaFonction('main/ipc/entreprise.ts', 'enregistrerHandlersEntreprisePoste'),
  ...canauxDeLaFonction('main/ipc/justificatifs.ts', 'enregistrerHandlersJustificatifsPoste'),
  ...canauxDeLaFonction('main/ipc/parametresApp.ts', 'enregistrerHandlersParametresAppPoste'),
  ...canauxDeLaFonction('main/ipc/conditions.ts', 'enregistrerHandlersConditionsPoste'),
  ...canauxDuFichier('main/pdf.ts'),
  ...canauxDuFichier('main/maj.ts'),
  ...canauxDuFichier('main/multipostes/handlers.ts')
]

const droitsSourcePoste = readFileSync(join(SRC, 'serveur/droits.ts'), 'utf-8')
const canauxDistants = [...droitsSourcePoste.matchAll(/^\s*'([^']+)':\s*'\w+'/gm)].map((m) => m[1])

const collisions = canauxPoste.filter((c) => canauxDistants.includes(c))
verifier(
  `les ${canauxPoste.length} canaux du poste ne recoupent aucun des ${canauxDistants.length} canaux distants`,
  collisions.length === 0,
  collisions.join(', ')
)

const doublonsPoste = canauxPoste.filter((c, i) => canauxPoste.indexOf(c) !== i)
verifier('aucun canal du poste enregistré deux fois', doublonsPoste.length === 0, doublonsPoste.join(', '))

/* ── 2. Compilation du serveur et du client ──────────────────────────────── */

const DOSSIER = join(tmpdir(), 'ohmnia-test-poste')
rmSync(DOSSIER, { recursive: true, force: true })
const DOSSIER_SERVEUR = join(DOSSIER, 'serveur')
const DOSSIER_POSTE = join(DOSSIER, 'poste')
mkdirSync(DOSSIER_SERVEUR, { recursive: true })
mkdirSync(DOSSIER_POSTE, { recursive: true })

const chargerSqlBrut = {
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

async function compiler(entree, sortie, entreeAbsolue = null) {
  await build({
    entryPoints: [entreeAbsolue ?? join(SRC, entree)],
    outfile: join(DOSSIER, sortie),
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['node:*', 'electron'],
    plugins: [chargerSqlBrut],
    logLevel: 'silent'
  })
  return import('file://' + join(DOSSIER, sortie).replace(/\\/g, '/'))
}

const serveurModule = await compiler('serveur/index.ts', 'serveur.mjs')

// Le client et le contexte doivent être dans le *même* bundle : compilés
// séparément, chacun aurait sa copie du contexte, et le client ne verrait
// jamais celui qu'on renseigne. C'est exactement ce qui se passe en vrai —
// dans l'application, tout partage un seul module.
const entreePoste = join(DOSSIER, 'entree-poste.ts')
const enChemin = (relatif) => join(SRC, relatif).split('\\').join('/')
writeFileSync(
  entreePoste,
  [
    `export * from '${enChemin('main/multipostes/client.ts')}'`,
    `export { definirContexte } from '${enChemin('main/contexte.ts')}'`,
    ''
  ].join('\n'),
  'utf-8'
)
const clientModule = await compiler(null, 'client.mjs', entreePoste)

/* ── 3. Le poste travaille bien sur les données du serveur ───────────────── */

console.log('\n=== Le poste écrit et lit sur le serveur ===')

const serveur = serveurModule.demarrerServeur({
  dossierDonnees: DOSSIER_SERVEUR,
  version: '0.0.0-test',
  port: 0,
  hote: '127.0.0.1'
})
await new Promise((resoudre) => serveur.on('listening', resoudre))
const adresse = `http://127.0.0.1:${serveur.address().port}`

// Le client lit son adresse dans la configuration du poste : on l'écrit comme
// le ferait l'écran de réglages.
clientModule.definirContexte({ dossierDonnees: DOSSIER_POSTE, version: '0.0.0-test' })
writeFileSync(
  join(DOSSIER_POSTE, 'multipostes.json'),
  JSON.stringify({ mode: 'serveur', adresse, dernierIdentifiant: '' }),
  'utf-8'
)

const etatServeur = await clientModule.testerServeur(adresse)
verifier('le poste joint le serveur', etatServeur.installe === false)

let refusAvantConnexion = null
try {
  await clientModule.appelerServeur('clients:lister', [])
} catch (e) {
  refusAvantConnexion = e.message
}
verifier(
  'sans session ouverte, le poste ne peut rien faire',
  refusAvantConnexion !== null && refusAvantConnexion.includes('session'),
  refusAvantConnexion ?? 'aucune erreur'
)

await clientModule.creerPremierAdministrateurDistant('patron', 'motdepasse1', 'Le patron')
const session = await clientModule.ouvrirSessionDistante('patron', 'motdepasse1')
verifier('le poste ouvre une session', session.role === 'administration')

await clientModule.appelerServeur('clients:ajouter', [
  { nom: 'Client distant', adresse: '', email: '', telephone: '' }
])
const clients = await clientModule.appelerServeur('clients:lister', [])
verifier(
  'le client créé depuis le poste est bien chez le serveur',
  clients.length === 1 && clients[0].nom === 'Client distant'
)

// Le point qui compte vraiment : rien n'a été écrit sur le poste.
verifier(
  "aucune base n'a été créée sur le poste",
  !existsSync(join(DOSSIER_POSTE, 'gestion.sqlite'))
)
verifier(
  'la base du serveur, elle, existe',
  existsSync(join(DOSSIER_SERVEUR, 'gestion.sqlite'))
)

/* ── 4. Les PDF ne sortent pas vides en mode serveur ─────────────────────── */

console.log('\n=== Impression à distance ===')

const facture = await clientModule.appelerServeur('factures:creerBrouillon', [clients[0].id])
await clientModule.appelerServeur('factures:enregistrer', [
  {
    ...facture,
    lignes: [{ id: 0, designation: 'Dépannage', referenceInventaire: null, quantite: 2, prixUnitaire: 90 }]
  }
])

const donnees = await clientModule.appelerServeur('documents:donnees', ['facture', facture.id])
verifier(
  'les données du document viennent du serveur, complètes',
  donnees.numero === facture.numero &&
    donnees.lignes.length === 1 &&
    donnees.total === 180,
  JSON.stringify({ numero: donnees.numero, lignes: donnees.lignes.length, total: donnees.total })
)

/* ── 5. La session perdue est signalée, pas subie ────────────────────────── */

console.log('\n=== Session perdue ===')

let prevenu = false
clientModule.prevenirSurSessionPerdue(() => {
  prevenu = true
})

// On ferme la session côté serveur : le jeton du poste ne vaut plus rien.
await clientModule.appelerServeur('session:fermer', [])
let messageApres = null
try {
  await clientModule.appelerServeur('clients:lister', [])
} catch (e) {
  messageApres = e.message
}
verifier(
  'un jeton devenu invalide donne un message clair',
  messageApres !== null && messageApres.includes('Reconnectez-vous'),
  messageApres ?? 'aucune erreur'
)
verifier("l'interface est prévenue qu'il faut se reconnecter", prevenu)

await new Promise((resoudre) => serveur.close(resoudre))

console.log(echecs === 0 ? '\nMODE SERVEUR : ETAPE 3 VALIDEE' : `\n${echecs} TEST(S) EN ECHEC`)
process.exitCode = echecs === 0 ? 0 : 1
