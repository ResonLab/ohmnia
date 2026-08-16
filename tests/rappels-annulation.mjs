// Annuler un rappel : ce que ça retire, et ce que ça laisse.
//
// **Cette suite existe parce qu'aucune autre n'aurait vu le défaut.** En
// branchant `rappels:supprimer` le 16 août 2026, on a trouvé que la création
// était tracée au journal d'audit et la suppression non : le journal montrait
// des rappels émis et jamais aucun annulé. Un journal d'audit incomplet est
// pire qu'absent, parce qu'on le lit comme s'il était complet. La règle de la
// maison s'applique — quand un défaut est trouvé à la main, écrire la
// vérification qui aurait dû le voir **avant** de corriger.
//
// **Elle éprouve le vrai code, compilé par esbuild**, comme
// `serveur-authentification.mjs`. Transcrire les requêtes ici ne prouverait que
// la justesse de la transcription : c'est précisément l'erreur que le harnais
// de `serveur-multipostes.mjs` assume pour le protocole, et qu'il ne faut pas
// répéter là où le comportement métier est l'objet du test.
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const PROJET = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(PROJET, 'src')

let echecs = 0
const verifier = (intitule, ok, detail = '') => {
  if (!ok) echecs += 1
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${intitule}${detail ? ` — ${detail}` : ''}`)
}

const DOSSIER = join(tmpdir(), 'ohmnia-test-rappels')
rmSync(DOSSIER, { recursive: true, force: true })
mkdirSync(DOSSIER, { recursive: true })

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

// Un point d'entrée fabriqué : il réexporte exactement ce que le test appelle,
// c'est-à-dire les vrais domaines. Aucune règle métier n'est réécrite ici.
const entree = join(DOSSIER, 'entree.ts')
const { writeFileSync } = await import('node:fs')
writeFileSync(
  entree,
  `export { definirContexte } from ${JSON.stringify(join(SRC, 'main/contexte').replace(/\\/g, '/'))}
export { ouvrirBaseDeDonnees, getDb, fermerBaseDeDonnees } from ${JSON.stringify(join(SRC, 'main/db/database').replace(/\\/g, '/'))}
export { creerRappel, supprimerRappel, listerRappels, prochainNiveauRappel, relancesAFaire } from ${JSON.stringify(join(SRC, 'main/domaines/rappels').replace(/\\/g, '/'))}
export { donneesDocument } from ${JSON.stringify(join(SRC, 'main/domaines/documents').replace(/\\/g, '/'))}
`
)

const bundle = join(DOSSIER, 'domaines.mjs')
await build({
  entryPoints: [entree],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['node:*', 'electron'],
  plugins: [chargerSqlBrut],
  logLevel: 'silent'
})

const domaines = await import('file://' + bundle.replace(/\\/g, '/'))

domaines.definirContexte({ dossierDonnees: DOSSIER, version: '0.0.0-test' })
domaines.ouvrirBaseDeDonnees()
const db = domaines.getDb()

/* ── Une facture réelle, en retard, avec un client ───────────────────────── */

db.prepare("INSERT INTO clients (nom, adresse, email, telephone) VALUES ('Client Test', '', '', '')").run()
db.prepare(
  `INSERT INTO factures (numero, client_id, date, delai_paiement_jours, statut, remise_pct, tva_pct)
   VALUES ('F-TEST-001', 1, '2026-01-10', 30, 'En attente', 0, 0)`
).run()
db.prepare(
  `INSERT INTO facture_lignes (facture_id, designation, quantite, prix_unitaire)
   VALUES (1, 'Prestation', 1, 100)`
).run()

const FACTURE = 1

/* ── 0. La carte des relances doit pouvoir s'afficher ────────────────────── */

// **Le contrôle qui manquait, et qui aurait dû exister le 13 août.** La requête
// de `relancesAFaire()` visait `factures.date_echeance`, une colonne qui
// n'existe dans aucun schéma : elle levait une erreur SQLite sur toute base, et
// l'écran de Facturation restait vide. `tests/relances.mjs` ne pouvait pas le
// voir — il éprouve la règle sans base, ce qui est sa qualité. Il fallait
// exécuter la requête, et rien d'autre ne le faisait.
console.log('=== La carte des relances ===')

let erreurRelances = null
try {
  domaines.relancesAFaire()
} catch (erreur) {
  erreurRelances = erreur.message
}
verifier(
  "la requête des relances s'exécute sur une vraie base",
  erreurRelances === null,
  erreurRelances ?? ''
)

/* ── 1. Les frais n'existent que sur la ligne du rappel ──────────────────── */

console.log('=== Où vivent les frais de rappel ===')

const rappel = domaines.creerRappel(FACTURE, 1, 25)

const lignesFactureAvecRappel = db
  .prepare('SELECT COUNT(*) AS n FROM facture_lignes WHERE facture_id = ?')
  .get(FACTURE).n
verifier(
  "émettre un rappel n'ajoute aucune ligne à la facture",
  lignesFactureAvecRappel === 1,
  `${lignesFactureAvecRappel} ligne(s)`
)

// **Le cas qui discrimine.** Si les frais étaient écrits dans la facture, le
// document « facture » les porterait aussi — et l'annulation devrait alors les
// retirer à la main. Les deux documents sont donc comparés dans la même
// exécution : c'est leur écart qui prouve où vivent les frais.
const docFacture = domaines.donneesDocument('facture', FACTURE)
const docRappel = domaines.donneesDocument('rappel', FACTURE, rappel.id)

verifier(
  'la facture ne porte pas les frais de rappel',
  docFacture.total === 100,
  `total ${docFacture.total}`
)
verifier(
  'le document de rappel les porte, lui',
  docRappel.total === 125 && docRappel.lignes.some((l) => l.total === 25),
  `total ${docRappel.total}`
)

/* ── 2. L'annulation retire les frais, et le dit au journal d'audit ──────── */

console.log("\n=== Ce que l'annulation retire ===")

const auditAvant = db.prepare("SELECT COUNT(*) AS n FROM journal_audit WHERE action = 'suppression'").get().n

domaines.supprimerRappel(rappel.id)

verifier(
  'le rappel a disparu',
  domaines.listerRappels(FACTURE).length === 0
)

// Les frais ne survivent nulle part : ni sur la facture, ni dans un document.
const docApres = domaines.donneesDocument('facture', FACTURE)
verifier(
  'aucun frais ne survit à l’annulation',
  docApres.total === 100 && !docApres.lignes.some((l) => /rappel/i.test(l.designation)),
  `total ${docApres.total}`
)

const auditApres = db.prepare("SELECT * FROM journal_audit WHERE action = 'suppression' ORDER BY id DESC").all()
verifier(
  "l'annulation est tracée au journal d'audit",
  auditApres.length === auditAvant + 1,
  `${auditApres.length} trace(s) de suppression`
)
verifier(
  'la trace nomme la facture, le niveau et les frais retirés',
  auditApres.length > 0 &&
    auditApres[0].reference === 'F-TEST-001' &&
    /niveau 1/.test(auditApres[0].details) &&
    /25/.test(auditApres[0].details),
  auditApres.length > 0 ? auditApres[0].details : 'aucune trace'
)

/* ── 3. Le niveau redevient disponible, et un id inconnu est refusé ──────── */

console.log('\n=== Après annulation ===')

verifier(
  'le niveau annulé peut être réémis',
  domaines.prochainNiveauRappel(FACTURE).niveau === 1
)

let refus = null
try {
  domaines.supprimerRappel(9999)
} catch (erreur) {
  refus = erreur.message
}
verifier(
  'annuler un rappel inexistant est refusé et nommé',
  refus !== null && /n'existe pas/.test(refus),
  refus ?? 'aucun refus'
)

// Fermer la base avant d'effacer le dossier : sous Windows, un fichier encore
// ouvert refuse d'être supprimé, et le test échouait sur son propre ménage
// après avoir tout validé. **Un faux échec use un contrôle aussi sûrement qu'un
// faux succès.**
domaines.fermerBaseDeDonnees()
rmSync(DOSSIER, { recursive: true, force: true })

console.log(
  echecs === 0
    ? '\nANNULATION DE RAPPEL : les frais partent avec le rappel, et la trace reste'
    : `\n${echecs} PROBLÈME(S)`
)
process.exit(echecs === 0 ? 0 : 1)
