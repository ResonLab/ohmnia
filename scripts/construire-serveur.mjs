// Compile le serveur multi-postes en un seul fichier exécutable par Node.
//
// Pourquoi un bundle : la machine qui héberge les données n'a pas à recevoir
// tout le projet ni un `npm install`. On y copie un fichier, et Node le lance.
// Aucune dépendance native — `node:sqlite` est intégré à Node 24.
//
// Le bundle réunit deux choses : le serveur commun de la maison
// (`../../Nexika/serveur/`, partagé avec Scenika) et les opérations propres à
// Ohmnia. L'application Electron, elle, ne dépend pas de `Nexika/` : elle ne
// parle au serveur que par le réseau. C'est ce qui permet au dépôt d'Ohmnia de
// se construire seul.
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const PROJET = join(dirname(fileURLToPath(import.meta.url)), '..')
const SORTIE = join(PROJET, 'out/serveur')

// `db/database.ts` importe le schéma via `./schema.sql?raw`, une syntaxe propre
// à Vite qu'esbuild ne connaît pas : on la résout à la main.
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

mkdirSync(SORTIE, { recursive: true })

await build({
  entryPoints: [join(PROJET, 'src/serveur/principal.ts')],
  outfile: join(SORTIE, 'ohmnia-serveur.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  external: ['node:*'],
  plugins: [chargerSqlBrut],
  banner: { js: '// Ohmnia — serveur multi-postes. Lancer avec : node ohmnia-serveur.mjs --aide' },
  logLevel: 'info'
})

console.log('Serveur compilé : out/serveur/ohmnia-serveur.mjs')
