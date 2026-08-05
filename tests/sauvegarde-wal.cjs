// Démontre le bug WAL et vérifie que le checkpoint le corrige.
const { DatabaseSync } = require('node:sqlite')
const { copyFileSync, existsSync, rmSync, mkdirSync, statSync } = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')

const DOSSIER = join(tmpdir(), 'ohmnia-test-wal')
rmSync(DOSSIER, { recursive: true, force: true })
mkdirSync(DOSSIER, { recursive: true })

const BASE = join(DOSSIER, 'test.sqlite')

let echecs = 0
const verifier = (intitule, condition, detail = '') => {
  if (!condition) echecs += 1
  console.log(`  ${condition ? 'OK  ' : 'ECHEC'} ${intitule}${detail ? ` (${detail})` : ''}`)
}

// Base en mode WAL avec des écritures récentes non encore repliées.
const db = new DatabaseSync(BASE)
db.exec('PRAGMA journal_mode = WAL')
db.exec('CREATE TABLE factures (id INTEGER PRIMARY KEY, numero TEXT)')
for (let i = 1; i <= 200; i += 1) {
  db.prepare('INSERT INTO factures (numero) VALUES (?)').run(`F${String(i).padStart(4, '0')}`)
}

const tailleWal = existsSync(BASE + '-wal') ? statSync(BASE + '-wal').size : 0
console.log(`Journal WAL : ${tailleWal} octets de donnees non repliees\n`)
verifier('le WAL contient bien des donnees', tailleWal > 0, `${tailleWal} octets`)

console.log('\n--- Sans checkpoint (ancien comportement) ---')
const copieSansCheckpoint = join(DOSSIER, 'sans-checkpoint.sqlite')
copyFileSync(BASE, copieSansCheckpoint)
const dbSans = new DatabaseSync(copieSansCheckpoint, { readOnly: true })
let nbSans = 0
try {
  nbSans = dbSans.prepare('SELECT COUNT(*) AS n FROM factures').get().n
} catch {
  nbSans = -1 // table absente : la copie est inutilisable
}
dbSans.close()
console.log(`  factures retrouvees dans la copie : ${nbSans === -1 ? 'table absente' : nbSans} / 200`)
verifier('la copie sans checkpoint est incomplete (bug demontre)', nbSans !== 200)

console.log('\n--- Avec checkpoint (correctif applique) ---')
db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
const copieAvecCheckpoint = join(DOSSIER, 'avec-checkpoint.sqlite')
copyFileSync(BASE, copieAvecCheckpoint)
const dbAvec = new DatabaseSync(copieAvecCheckpoint, { readOnly: true })
const nbAvec = dbAvec.prepare('SELECT COUNT(*) AS n FROM factures').get().n
const derniere = dbAvec.prepare('SELECT numero FROM factures ORDER BY id DESC LIMIT 1').get().numero
dbAvec.close()
db.close()

console.log(`  factures retrouvees dans la copie : ${nbAvec} / 200`)
verifier('la copie avec checkpoint est complete', nbAvec === 200, `${nbAvec}/200`)
verifier('la derniere ecriture est presente', derniere === 'F0200', derniere)
verifier(
  'le WAL est vide apres checkpoint',
  !existsSync(BASE + '-wal') || statSync(BASE + '-wal').size === 0
)

rmSync(DOSSIER, { recursive: true, force: true })
console.log(`\n${echecs === 0 ? 'CORRECTIF WAL VALIDE' : `${echecs} TEST(S) EN ECHEC`}`)
process.exit(echecs === 0 ? 0 : 1)
