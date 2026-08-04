// Teste les analyseurs de relevés en réutilisant le code source du main process.
import { readFileSync } from 'node:fs'

import { fileURLToPath } from 'node:url'
import { dirname, join as joindre } from 'node:path'

// Racine du projet, déduite de l'emplacement de ce fichier.
const DOSSIER_TESTS = dirname(fileURLToPath(import.meta.url))
const PROJET = joindre(DOSSIER_TESTS, '..')



const source = readFileSync(joindre(PROJET, 'src/main/ipc/comptabilite.ts'), 'utf-8')

// On isole les fonctions pures (aucune dépendance Electron/SQLite) et on retire
// les annotations de types pour pouvoir les exécuter directement en JS.
const debut = source.indexOf('/** Découpe une ligne CSV')
const fin = source.indexOf('/** Marque les mouvements')
const code = source
  .slice(debut, fin)
  .replace(/interface ColonnesReleve \{[^}]*\}/s, '')
  .replace(/: ColonnesReleve/g, '')
  .replace(/: MouvementBancaire\[\]/g, '')
  .replace(/: string\[\]/g, '')
  .replace(/: string \| null/g, '')
  .replace(/: number \| null/g, '')
  .replace(/: string/g, '')
  .replace(/: number/g, '')
  .replace(/: boolean/g, '')

const module = await import(
  'data:text/javascript,' +
    encodeURIComponent(
      code + '\nexport { analyserCsvBancaire, analyserCamt, normaliserDate, normaliserMontant };'
    )
)

let echecs = 0
function verifier(intitule, obtenu, attendu) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu)
  if (!ok) echecs += 1
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${intitule}`)
  if (!ok) {
    console.log(`        attendu : ${JSON.stringify(attendu)}`)
    console.log(`        obtenu  : ${JSON.stringify(obtenu)}`)
  }
}

const resume = (mouvements) => mouvements.map((m) => [m.date, m.montant])

console.log('--- Normalisation ---')
verifier('date europeenne', module.normaliserDate('31.12.2026'), '2026-12-31')
verifier('date iso', module.normaliserDate('2026-12-31'), '2026-12-31')
verifier('date courte', module.normaliserDate('5/1/26'), '2026-01-05')
verifier('non-date', module.normaliserDate('Total'), null)
verifier('montant apostrophe', module.normaliserMontant("1'234.50"), 1234.5)
verifier('montant virgule', module.normaliserMontant('1 234,50'), 1234.5)
verifier('montant negatif', module.normaliserMontant('-45.60'), -45.6)

console.log('\n--- CSV avec colonnes Debit/Credit/Solde ---')
const csv1 = module.analyserCsvBancaire(readFileSync(`${DOSSIER_TESTS}/exemples-releve.csv`, 'utf-8'))
verifier('montants (pas le solde)', resume(csv1), [
  ['2026-12-31', -45.6],
  ['2026-12-30', 260.83],
  ['2026-12-28', -650]
])
verifier('libelle lu depuis la colonne Libelle', csv1[0].libelle, 'PAIEMENT TWINT MIGROS SION')

console.log('\n--- CSV avec colonne Montant unique ---')
verifier(
  'montants signes',
  resume(module.analyserCsvBancaire(readFileSync(`${DOSSIER_TESTS}/exemple-releve-montant.csv`, 'utf-8'))),
  [
    ['2026-11-05', -320.5],
    ['2026-11-12', 1450]
  ]
)

console.log('\n--- CSV sans en-tete (montant + solde) ---')
verifier(
  'ignore la derniere colonne (solde)',
  resume(module.analyserCsvBancaire(readFileSync(`${DOSSIER_TESTS}/exemple-releve-sans-entete.csv`, 'utf-8'))),
  [
    ['2026-10-05', -28.9],
    ['2026-10-08', 500]
  ]
)

console.log('\n--- CAMT.053 ---')
const camt = module.analyserCamt(readFileSync(`${DOSSIER_TESTS}/exemple-camt053.xml`, 'utf-8'))
verifier('credit / debit / nom du debiteur', resume(camt), [
  ['2026-12-20', 150],
  ['2026-12-18', -82.4],
  ['2026-12-15', 1250]
])
verifier('libelle Ustrd', camt[0].libelle, 'Paiement devis D0001 Garage Dupont')
verifier('libelle AddtlNtryInf', camt[1].libelle, 'CARTE ESSENCE SOCAR SION')
verifier('libelle Nm', camt[2].libelle, 'Commune de Sion')

console.log(`\n${echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} TEST(S) EN ECHEC`}`)
process.exit(echecs === 0 ? 0 : 1)
