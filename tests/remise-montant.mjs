import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/**
 * La remise en montant fixe, en plus de la remise en pourcentage.
 *
 * Chaque cas dit ce qu'il exclut : un test qui passerait aussi avec l'ordre
 * inverse (montant puis pourcentage) ou sans plancher à zéro ne prouverait rien.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { calculerTotalDocument } = await import(
  'file://' + join(RACINE, 'src/shared/calculs.ts').split(String.fromCharCode(92)).join('/')
)

let echecs = 0
const verifier = (intitule, condition, detail = '') => {
  if (!condition) echecs += 1
  console.log(`  ${condition ? 'OK  ' : 'ÉCHEC'} ${intitule}${!condition && detail ? ` — ${detail}` : ''}`)
}

const lignes = [{ quantite: 1, prixUnitaire: 1000 }]
const proche = (a, b) => Math.abs(a - b) < 1e-9

const sans = calculerTotalDocument(lignes, 0, 0)
verifier('sans remise, le total est le sous-total', proche(sans.totalApresRemise, 1000))

const montant = calculerTotalDocument(lignes, 0, 0, 0, 150)
verifier('150 de remise sur 1000 donnent 850', proche(montant.totalApresRemise, 850), String(montant.totalApresRemise))

// 10 % puis 50 : (1000 × 0,9) − 50 = 850. Dans l'ordre inverse : (1000 − 50) × 0,9 = 855.
const les2 = calculerTotalDocument(lignes, 10, 0, 0, 50)
verifier('pourcentage d\'abord, montant ensuite (850, pas 855)', proche(les2.totalApresRemise, 850), String(les2.totalApresRemise))

const trop = calculerTotalDocument(lignes, 0, 0, 0, 5000)
verifier('une remise plus grosse que la facture ne donne jamais un total négatif', trop.totalApresRemise === 0 && trop.total === 0)

const tva = calculerTotalDocument(lignes, 0, 10, 0, 100)
verifier('la TVA se calcule après la remise (900 + 90)', proche(tva.total, 990), String(tva.total))

const frais = calculerTotalDocument(lignes, 0, 0, 40, 100)
verifier('les frais s\'ajoutent après la remise (900 + 40)', proche(frais.totalApresRemise, 940), String(frais.totalApresRemise))

console.log(echecs === 0 ? '\nREMISE EN MONTANT : TOUS LES TESTS PASSENT' : `\n${echecs} TEST(S) EN ÉCHEC`)
process.exitCode = echecs === 0 ? 0 : 1
