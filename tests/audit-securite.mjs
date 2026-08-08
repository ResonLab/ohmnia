// Audit statique : sécurité Electron, injections SQL, divisions non protégées.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { fileURLToPath } from 'node:url'
import { dirname, join as joindre } from 'node:path'

// Racine du projet, déduite de l'emplacement de ce fichier.
const DOSSIER_TESTS = dirname(fileURLToPath(import.meta.url))
const PROJET = joindre(DOSSIER_TESTS, '..')


const SRC = joindre(PROJET, 'src')

function fichiers(dossier, ext = ['.ts', '.tsx']) {
  const out = []
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin, ext))
    else if (ext.some((e) => chemin.endsWith(e))) out.push(chemin)
  }
  return out
}

let problemes = 0
const verifier = (intitule, ok, detail = '') => {
  if (!ok) problemes += 1
  console.log(`  ${ok ? 'OK  ' : 'ALERTE'} ${intitule}${detail ? ` — ${detail}` : ''}`)
}

const tous = fichiers(SRC)
const lire = (f) => readFileSync(f, 'utf-8')

console.log('=== Sécurité Electron ===')
const mainIndex = lire(join(SRC, 'main/index.ts'))
verifier('contextIsolation activé', mainIndex.includes('contextIsolation: true'))
verifier('nodeIntegration désactivé', mainIndex.includes('nodeIntegration: false'))
verifier('sandbox activé', mainIndex.includes('sandbox: true'))
verifier('liens externes bloqués', mainIndex.includes('setWindowOpenHandler'))

const html = lire(join(SRC, 'renderer/index.html'))
verifier('CSP déclarée', html.includes('Content-Security-Policy'))
verifier("CSP sans 'unsafe-eval'", !html.includes('unsafe-eval'))

const preload = lire(join(SRC, 'preload/index.ts'))
verifier('preload expose via contextBridge', preload.includes('contextBridge.exposeInMainWorld'))
verifier(
  "preload n'expose pas ipcRenderer brut",
  !/exposeInMainWorld\(\s*['"][^'"]+['"]\s*,\s*ipcRenderer\s*\)/.test(preload)
)

console.log('\n=== Injections SQL ===')
// Une requête construite par concaténation avec une variable est suspecte.
const concatSql = []
for (const f of tous.filter((f) => f.includes('main'))) {
  const contenu = lire(f)
  // prepare(`... ${variable} ...`) hors listes de colonnes maîtrisées
  for (const m of contenu.matchAll(/prepare\(\s*`([^`]*\$\{[^`]*)`/g)) {
    const requete = m[1]
    // Les interpolations de noms de tables/colonnes internes sont acceptables.
    const interpolations = [...requete.matchAll(/\$\{([^}]+)\}/g)].map((x) => x[1].trim())
    // Ces identifiants désignent des fragments SQL internes (noms de tables,
    // clauses construites par le code), jamais une saisie utilisateur.
    const internes = [
      'table',
      'tableTemporaire',
      'listeColonnes',
      'clause',
      'name',
      'conditions',
      'REQUETE_BASE'
    ]
    const suspectes = interpolations.filter((v) => !internes.includes(v))
    if (suspectes.length) concatSql.push(`${relative(SRC, f)} : ${suspectes.join(', ')}`)
  }
}
verifier(
  'aucune requête SQL construite avec une saisie utilisateur',
  concatSql.length === 0,
  concatSql.join(' | ')
)

const nbPrepare = tous.filter((f) => f.includes('main')).reduce((n, f) => n + (lire(f).match(/\.prepare\(/g) ?? []).length, 0)
console.log(`  info : ${nbPrepare} requêtes préparées`)

console.log('\n=== Divisions ===')
const divisionsSuspectes = []
for (const f of tous) {
  const contenu = lire(f)
  const lignes = contenu.split('\n')
  lignes.forEach((ligne, i) => {
    // Division par une variable, hors constantes numériques et hors helper protégé.
    const m = ligne.match(/\/\s*([a-zA-Z_][\w.]*)\b/)
    if (!m) return
    if (ligne.includes('diviserSansErreur')) return
    if (/\/\s*(100|3600|1000|86400|60|24|1024|2)\b/.test(ligne)) return
    if (ligne.trim().startsWith('//') || ligne.trim().startsWith('*')) return
    if (ligne.includes('import ') || ligne.includes("from '")) return
    if (/\/\s*(maxValeur|total|TAILLE)/.test(ligne)) return
    divisionsSuspectes.push(`${relative(SRC, f)}:${i + 1}`)
  })
}
console.log(`  info : ${divisionsSuspectes.length} division(s) à vérifier manuellement`)
if (divisionsSuspectes.length <= 12) divisionsSuspectes.forEach((d) => console.log(`         ${d}`))

console.log('\n=== Transactions ===')
const facturesTs = lire(join(SRC, 'main/ipc/factures.ts'))
verifier(
  'enregistrement de facture en transaction',
  facturesTs.includes('dansUneTransaction')
)
const devisTs = lire(join(SRC, 'main/ipc/devis.ts'))
verifier('enregistrement de devis en transaction', devisTs.includes('dansUneTransaction'))

console.log('\n=== Sauvegardes ===')
const backupTs = lire(join(SRC, 'main/db/backup.ts'))
verifier('checkpoint WAL avant copie', backupTs.includes('viderJournalWal'))
const externeTs = lire(join(SRC, 'main/db/sauvegardeExterne.ts'))
verifier('checkpoint WAL avant chiffrement', externeTs.includes('viderJournalWal'))
verifier('chiffrement authentifié (GCM)', externeTs.includes('aes-256-gcm'))
verifier('dérivation de clé par scrypt', externeTs.includes('scryptSync'))

console.log('\n=== Interface ===')
const tousRenderer = tous.filter((f) => f.includes('renderer'))
// On ignore les commentaires : seul un appel réel pose problème.
const codeSansCommentaires = (f) =>
  lire(f)
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n')
verifier(
  'aucun window.prompt (non supporté par Electron)',
  !tousRenderer.some((f) => codeSansCommentaires(f).includes('window.prompt('))
)
verifier(
  'aucun dangerouslySetInnerHTML',
  !tousRenderer.some((f) => lire(f).includes('dangerouslySetInnerHTML'))
)

console.log('\n=== Migrations ===')
const migrations = lire(join(SRC, 'main/db/migrations.ts'))
const schema = lire(join(SRC, 'main/db/schema.sql'))
const colonnesMigrees = [...migrations.matchAll(/colonne: '([^']+)'/g)].map((m) => m[1])
const absentesDuSchema = colonnesMigrees.filter((c) => !schema.includes(c))
verifier(
  'toute colonne migrée existe aussi dans schema.sql',
  absentesDuSchema.length === 0,
  absentesDuSchema.join(', ')
)

console.log('\n=== Logique métier réutilisable par le serveur ===')
// Le serveur multi-postes n'a ni fenêtre ni Electron. Tout ce qui vit dans
// src/main/domaines/ doit donc rester utilisable sans lui : c'est précisément
// ce qui permettra d'exposer les mêmes opérations par le réseau.
// Un import d'Electron glissé là casserait cette réutilisation en silence.
const dossierDomaines = join(SRC, 'main/domaines')
if (existsSync(dossierDomaines)) {
  const fautifs = fichiers(dossierDomaines).filter((f) =>
    /from 'electron'|require\('electron'\)/.test(lire(f))
  )
  verifier(
    "aucun import d'Electron dans src/main/domaines/",
    fautifs.length === 0,
    fautifs.map((f) => relative(SRC, f)).join(', ')
  )
} else {
  console.log('  (dossier domaines/ absent, contrôle sans objet)')
}

console.log(`\n${problemes === 0 ? 'AUDIT STATIQUE : AUCUNE ALERTE' : `${problemes} ALERTE(S)`}`)
process.exit(problemes === 0 ? 0 : 1)
