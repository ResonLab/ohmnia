// Vérifie que CONTEXTE.md ne contient pas d'affirmation fausse sur le projet.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Racine du projet, deduite de l'emplacement de ce fichier.
const PROJET = join(dirname(fileURLToPath(import.meta.url)), '..')
const contexte = readFileSync(join(PROJET, 'CONTEXTE.md'), 'utf-8')

let problemes = 0
const verifier = (intitule, ok, detail = '') => {
  if (!ok) problemes += 1
  console.log(`  ${ok ? 'OK  ' : 'FAUX'} ${intitule}${detail ? ` — ${detail}` : ''}`)
}

const compter = (dossier, ext) =>
  readdirSync(join(PROJET, dossier)).filter((f) => f.endsWith(ext)).length

console.log('=== Chiffres annoncés ===')
const nbIpc = compter('src/main/ipc', '.ts')
verifier(`ipc/ : ${nbIpc} fichiers`, contexte.includes(`ipc/                un fichier par domaine (${nbIpc} fichiers)`))

const nbPages = compter('src/renderer/src/pages', '.tsx')
verifier(`pages/ : ${nbPages} écrans`, contexte.includes(`pages/              ${nbPages} écrans`))

const nbComposants = compter('src/renderer/src/components', '.tsx')
verifier(
  `components/ : ${nbComposants} composants`,
  contexte.includes(`components/         ${nbComposants} composants`)
)

const nbSuites = readdirSync(join(PROJET, 'tests')).filter(
  (f) => (f.endsWith('.mjs') || f.endsWith('.cjs')) && f !== 'lancer-tout.mjs'
).length
verifier(`tests/ : ${nbSuites} suites`, contexte.includes(`tests/                  ${nbSuites} suites`))

console.log('\n=== Fichiers cités existent ===')
for (const chemin of [
  'src/shared/conditions.ts',
  'src/shared/pays.ts',
  'src/shared/i18n.ts',
  'src/shared/calculs.ts',
  'src/main/db/migrations.ts',
  'src/main/db/sauvegardeExterne.ts',
  'src/main/db/migration-dossier.ts',
  'SITE-GITHUB.md',
  'README.md'
]) {
  verifier(chemin, existsSync(join(PROJET, chemin)))
}

console.log('\n=== Commandes citées existent ===')
const pkg = JSON.parse(readFileSync(join(PROJET, 'package.json'), 'utf-8'))
for (const cmd of ['verifier', 'dev', 'test', 'publish:win', 'package:win']) {
  verifier(`npm run ${cmd}`, cmd in pkg.scripts)
}

// Ces placeholders doivent disparaître avant diffusion. Tant qu'ils sont là,
// on le signale sans faire échouer : c'est un rappel, pas une erreur de code.
console.log('\n=== Placeholders restant à remplacer ===')
const placeholders = [
  ['electron-builder.yml', 'VOTRE-COMPTE-GITHUB', 'compte GitHub pour la publication'],
  ['src/shared/conditions.ts', 'github.com/', 'adresse GitHub Pages des conditions']
]
let restants = 0
for (const [fichier, marqueur, role] of placeholders) {
  const present = readFileSync(join(PROJET, fichier), 'utf-8').includes(marqueur)
  if (present) restants += 1
  console.log(`  ${present ? 'À FAIRE' : 'FAIT   '} ${role} (${fichier})`)
}
if (restants === 0) console.log('  Tous les placeholders ont été remplacés.')

console.log('\n=== Règles citées correspondent au code ===')
const database = readFileSync(join(PROJET, 'src/main/db/database.ts'), 'utf-8')
verifier('dansUneTransaction() existe', database.includes('export function dansUneTransaction'))
verifier('viderJournalWal() existe', database.includes('export function viderJournalWal'))
const calculs = readFileSync(join(PROJET, 'src/shared/calculs.ts'), 'utf-8')
verifier('diviserSansErreur() existe', calculs.includes('export function diviserSansErreur'))

console.log(`\n${problemes === 0 ? 'CONTEXTE.md : COHÉRENT' : `${problemes} INCOHÉRENCE(S)`}`)
process.exit(problemes === 0 ? 0 : 1)
