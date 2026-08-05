// Prouve que la contrainte bloquait l'enregistrement, et que la migration corrige.
const { DatabaseSync } = require('node:sqlite')
const { rmSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')

const DOSSIER = join(tmpdir(), 'ohmnia-test-fk')
rmSync(DOSSIER, { recursive: true, force: true })
mkdirSync(DOSSIER, { recursive: true })

let echecs = 0
const verifier = (intitule, condition, detail = '') => {
  if (!condition) echecs += 1
  console.log(`  ${condition ? 'OK  ' : 'ECHEC'} ${intitule}${detail ? ` (${detail})` : ''}`)
}

// --- Base "ancienne version" avec la contrainte bloquante ---
const db = new DatabaseSync(join(DOSSIER, 'test.sqlite'))
db.exec('PRAGMA foreign_keys = ON')
db.exec(`
  CREATE TABLE clients (id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT NOT NULL);
  CREATE TABLE inventaire (reference TEXT PRIMARY KEY, designation TEXT NOT NULL);
  CREATE TABLE factures (
    id INTEGER PRIMARY KEY AUTOINCREMENT, numero TEXT NOT NULL UNIQUE, date TEXT NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id)
  );
  CREATE TABLE facture_lignes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    facture_id INTEGER NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
    designation TEXT NOT NULL,
    reference_inventaire TEXT REFERENCES inventaire(reference),
    quantite REAL NOT NULL DEFAULT 1,
    prix_unitaire REAL NOT NULL DEFAULT 0
  );
`)
db.prepare("INSERT INTO clients (nom) VALUES ('Cliente Exemple')").run()
db.prepare("INSERT INTO factures (numero, date, client_id) VALUES ('F0001', date('now'), 1)").run()
// Une ligne existante SANS reference : elle doit survivre a la migration.
db.prepare(
  "INSERT INTO facture_lignes (facture_id, designation, reference_inventaire, quantite, prix_unitaire) VALUES (1, 'Ligne existante', NULL, 2, 7.355)"
).run()

console.log('--- Avant correctif (inventaire vide) ---')
const essayerInsertion = (ref) => {
  try {
    db.prepare(
      'INSERT INTO facture_lignes (facture_id, designation, reference_inventaire, quantite, prix_unitaire) VALUES (1, ?, ?, 1, 10)'
    ).run(`Test ${JSON.stringify(ref)}`, ref)
    return null
  } catch (e) {
    return e.message
  }
}
verifier('reference inexistante -> BLOQUEE (bug reproduit)', essayerInsertion('ART-0001') !== null)
verifier('chaine vide -> BLOQUEE (bug reproduit)', essayerInsertion('') !== null)
verifier('NULL -> acceptee', essayerInsertion(null) === null)

// --- Migration : reconstruction de la table sans la contrainte ---
console.log('\n--- Migration ---')
const lignesAvant = db.prepare('SELECT COUNT(*) AS n FROM facture_lignes').get().n

db.exec('PRAGMA foreign_keys = OFF')
db.exec('BEGIN')
db.exec(`CREATE TABLE facture_lignes_migration (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facture_id INTEGER NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  reference_inventaire TEXT,
  quantite REAL NOT NULL DEFAULT 1,
  prix_unitaire REAL NOT NULL DEFAULT 0
)`)
db.exec(
  'INSERT INTO facture_lignes_migration ("id", "facture_id", "designation", "reference_inventaire", "quantite", "prix_unitaire") SELECT "id", "facture_id", "designation", "reference_inventaire", "quantite", "prix_unitaire" FROM facture_lignes'
)
db.exec('DROP TABLE facture_lignes')
db.exec('ALTER TABLE facture_lignes_migration RENAME TO facture_lignes')
db.exec('COMMIT')
db.exec('PRAGMA foreign_keys = ON')

const lignesApres = db.prepare('SELECT COUNT(*) AS n FROM facture_lignes').get().n
verifier('aucune ligne perdue', lignesApres === lignesAvant, `${lignesApres}/${lignesAvant}`)

const ligneConservee = db.prepare("SELECT * FROM facture_lignes WHERE designation = 'Ligne existante'").get()
verifier('les valeurs sont intactes', ligneConservee?.quantite === 2 && ligneConservee?.prix_unitaire === 7.355)

const fks = db.prepare('PRAGMA foreign_key_list(facture_lignes)').all()
verifier(
  'la contrainte vers inventaire a disparu',
  !fks.some((fk) => fk.from === 'reference_inventaire')
)
verifier(
  'la contrainte vers factures est conservee',
  fks.some((fk) => fk.from === 'facture_id' && fk.table === 'factures')
)

console.log('\n--- Apres correctif ---')
verifier('reference inexistante -> ACCEPTEE', essayerInsertion('ART-0001') === null)
verifier('chaine vide -> ACCEPTEE', essayerInsertion('') === null)

// La cascade doit toujours fonctionner : supprimer la facture retire ses lignes.
db.prepare('DELETE FROM factures WHERE id = 1').run()
verifier(
  'la suppression en cascade fonctionne toujours',
  db.prepare('SELECT COUNT(*) AS n FROM facture_lignes').get().n === 0
)

// Une ligne rattachee a une facture inexistante reste refusee.
try {
  db.prepare(
    "INSERT INTO facture_lignes (facture_id, designation, quantite, prix_unitaire) VALUES (999, 'Orpheline', 1, 10)"
  ).run()
  verifier('une ligne sans facture reste refusee', false)
} catch {
  verifier('une ligne sans facture reste refusee', true)
}

db.close()
rmSync(DOSSIER, { recursive: true, force: true })
console.log(`\n${echecs === 0 ? 'CORRECTIF VALIDE' : `${echecs} TEST(S) EN ECHEC`}`)
process.exit(echecs === 0 ? 0 : 1)
