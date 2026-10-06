// Les statuts d'une facture, et le moment où l'argent entre au Journal.
//
// **Pourquoi cette suite existe.** Colin a signalé le 30 septembre 2026 qu'une
// facture « en attente » créait déjà une entrée d'argent : le chiffre d'affaires
// comptait des factures que personne n'avait payées. Elle éprouve le vrai code,
// compilé par esbuild, sur une vraie base — y compris le passage d'une base
// ancienne (trois statuts) à la nouvelle (quatre), là où un défaut ferait
// perdre ou mal classer des factures réelles.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { build } from 'esbuild'

const PROJET = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(PROJET, 'src')

let echecs = 0
const verifier = (intitule, ok, detail = '') => {
  if (!ok) echecs += 1
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${intitule}${detail ? ` — ${detail}` : ''}`)
}

const DOSSIER = join(tmpdir(), 'ohmnia-test-statuts')
rmSync(DOSSIER, { recursive: true, force: true })
mkdirSync(DOSSIER, { recursive: true })

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

const chemin = (p) => JSON.stringify(join(SRC, p).replace(/\\/g, '/'))
const entree = join(DOSSIER, 'entree.ts')
writeFileSync(
  entree,
  `export { definirContexte } from ${chemin('main/contexte')}
export { ouvrirBaseDeDonnees, getDb, fermerBaseDeDonnees } from ${chemin('main/db/database')}
export { creerBrouillonFacture, enregistrerFacture, changerStatutFacture, totalFacture, historiqueFactures, confirmerEnregistrementHistorique, chargerDetailFacture } from ${chemin('main/domaines/factures')}
export { chargerTableauDeBord } from ${chemin('main/domaines/tableauDeBord')}
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
const d = await import('file://' + bundle.replace(/\\/g, '/'))
d.definirContexte({ dossierDonnees: DOSSIER, version: '0.0.0-test' })

/* ── 1. Une base d'avant : trois statuts ─────────────────────────────────── */

// On crée la base avec le schéma courant, puis on la ramène à l'ancien état :
// table `factures` à trois statuts, sans `remise_montant`.
d.ouvrirBaseDeDonnees()
d.fermerBaseDeDonnees()

const brute = new DatabaseSync(join(DOSSIER, 'gestion.sqlite'))
brute.exec('PRAGMA foreign_keys = OFF')
brute.exec('DROP TABLE factures')
brute.exec(`CREATE TABLE factures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  delai_paiement_jours INTEGER NOT NULL DEFAULT 30,
  remise_pct REAL NOT NULL DEFAULT 0,
  impression_incluse INTEGER NOT NULL DEFAULT 0,
  tva_pct REAL NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'En attente' CHECK (statut IN ('Payée', 'En attente', 'Annulée')),
  notes_internes TEXT NOT NULL DEFAULT '',
  stock_deduit INTEGER NOT NULL DEFAULT 0,
  devis_origine_id INTEGER
)`)
brute.exec("INSERT INTO clients (nom, adresse, email, telephone) VALUES ('Client', '', '', '')")
const ancienne = (numero, statut, stock = 0) =>
  brute
    .prepare(
      `INSERT INTO factures (numero, client_id, date, delai_paiement_jours, statut, remise_pct, tva_pct, stock_deduit)
       VALUES (?, 1, '2026-09-01', 30, ?, 0, 0, ?)`
    )
    .run(numero, statut, stock)
ancienne('F-ECRITURE', 'En attente') // exportée et confirmée : une écriture au Journal
ancienne('F-STOCK', 'En attente', 1) // stock déjà déduit : elle est partie
ancienne('F-RIEN', 'En attente') // créée, jamais terminée
ancienne('F-PAYEE', 'Payée')
ancienne('F-ANNULEE', 'Annulée')
brute
  .prepare(
    `INSERT INTO journal (date, type, categorie_id, description, montant, numero_facture, notes, tva_pct)
     VALUES ('2026-09-01', 'Entrée', (SELECT id FROM categories_journal WHERE libelle = 'Facture client'), 'Facture F-ECRITURE', 100, 'F-ECRITURE', '', 0)`
  )
  .run()
brute.close()

d.ouvrirBaseDeDonnees()
const db = d.getDb()
const statutDe = (numero) => db.prepare('SELECT statut FROM factures WHERE numero = ?').get(numero)?.statut

verifier('avec une écriture au Journal, une ancienne « En attente » devient Envoyée', statutDe('F-ECRITURE') === 'Envoyée', String(statutDe('F-ECRITURE')))
verifier('avec le stock déjà déduit, elle devient Envoyée', statutDe('F-STOCK') === 'Envoyée', String(statutDe('F-STOCK')))
verifier('jamais exportée ni confirmée, elle devient Brouillon', statutDe('F-RIEN') === 'Brouillon', String(statutDe('F-RIEN')))
verifier('une facture Payée reste Payée', statutDe('F-PAYEE') === 'Payée')
verifier('une facture Annulée reste Annulée', statutDe('F-ANNULEE') === 'Annulée')
verifier('aucune facture n\'a été perdue', db.prepare('SELECT COUNT(*) AS n FROM factures').get().n === 5)
verifier('le Journal n\'a pas été touché', db.prepare('SELECT COUNT(*) AS n FROM journal').get().n === 1)
verifier(
  'la nouvelle contrainte refuse l\'ancien statut',
  (() => {
    try {
      db.prepare("UPDATE factures SET statut = 'En attente' WHERE numero = 'F-RIEN'").run()
      return false
    } catch {
      return true
    }
  })()
)

/* ── 2. Le comportement neuf, sur la base migrée ─────────────────────────── */

const ecritures = (numero) =>
  db.prepare("SELECT COUNT(*) AS n FROM journal WHERE numero_facture = ?").get(numero).n

// Une facture de 1000 : un brouillon, puis envoyée, puis payée.
const f = d.creerBrouillonFacture(1)
f.lignes = [{ designation: 'Prestation', referenceInventaire: null, quantite: 1, prixUnitaire: 1000 }]
d.enregistrerFacture(f)

verifier('une facture neuve est un Brouillon', d.chargerDetailFacture(f.id).statut === 'Brouillon')
verifier('un brouillon n\'a aucune écriture au Journal', ecritures(f.numero) === 0)
verifier('son montant se calcule depuis ses lignes', d.totalFacture(f.id) === 1000, String(d.totalFacture(f.id)))

const entreesAvant = d.chargerTableauDeBord().caAnnee
d.confirmerEnregistrementHistorique(f.id)
verifier('l\'envoi la fait passer à Envoyée', d.chargerDetailFacture(f.id).statut === 'Envoyée')
verifier('une facture envoyée n\'a toujours aucune écriture', ecritures(f.numero) === 0)
verifier('elle ne fait pas monter le chiffre d\'affaires', d.chargerTableauDeBord().caAnnee === entreesAvant)

const tableau = d.chargerTableauDeBord()
verifier(
  'elle figure parmi les montants à encaisser, pour son vrai montant',
  tableau.montantEnAttente >= 1000 && tableau.prochainesEcheances.some((e) => e.numero === f.numero && e.montant === 1000)
)

const res = d.changerStatutFacture(f.id, 'Payée')
verifier('le paiement ajoute l\'entrée d\'argent', res.entreeAjoutee === true && ecritures(f.numero) === 1)
verifier('pour le bon montant', db.prepare('SELECT montant FROM journal WHERE numero_facture = ?').get(f.numero).montant === 1000)
d.changerStatutFacture(f.id, 'Annulée')
d.changerStatutFacture(f.id, 'Payée')
verifier('payer deux fois ne duplique jamais l\'écriture', ecritures(f.numero) === 1)
verifier('le chiffre d\'affaires monte de 1000, une seule fois', d.chargerTableauDeBord().caAnnee === entreesAvant + 1000, String(d.chargerTableauDeBord().caAnnee - entreesAvant))

// Une ancienne facture dont l'écriture existe déjà ne doit pas être doublée.
d.changerStatutFacture(db.prepare("SELECT id FROM factures WHERE numero = 'F-ECRITURE'").get().id, 'Payée')
verifier('une ancienne facture avec écriture n\'est pas doublée au paiement', ecritures('F-ECRITURE') === 1)

// Le contrôle qui rend le tout crédible : on refuse une écriture dans un exercice clos.
db.exec("INSERT OR IGNORE INTO exercices_clotures (annee) VALUES (CAST(strftime('%Y','now') AS INTEGER))")
const g = d.creerBrouillonFacture(1)
g.lignes = [{ designation: 'X', referenceInventaire: null, quantite: 1, prixUnitaire: 50 }]
d.enregistrerFacture(g)
let refuse = false
try {
  d.changerStatutFacture(g.id, 'Payée')
} catch {
  refuse = true
}
verifier(
  'dans un exercice clôturé, le paiement est refusé et la facture ne change pas',
  refuse && d.chargerDetailFacture(g.id).statut === 'Brouillon' && ecritures(g.numero) === 0
)

d.fermerBaseDeDonnees()
rmSync(DOSSIER, { recursive: true, force: true })
console.log(echecs === 0 ? '\nSTATUTS DE FACTURES : tout tient' : `\n${echecs} PROBLÈME(S)`)
process.exit(echecs === 0 ? 0 : 1)
