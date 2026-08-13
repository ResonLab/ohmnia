import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/**
 * Le calcul des relances à envoyer.
 *
 * **Les cas sont choisis pour discriminer, pas pour passer.** Un test qui
 * passerait aussi avec la règle inverse ne prouve rien — la maison l'a payé une
 * fois sur le tri « le plus gourmand d'abord », dont le premier cas passait dans
 * les deux sens. Chaque cas ci-dessous est accompagné de ce qu'il exclut.
 *
 * Le module est chargé en dépouillant les types : `shared/calculs.ts` ne dépend
 * ni d'Electron, ni de la base, ni de l'empaqueteur. Un test qu'on peut lancer
 * sans `npm install` reste lançable dans six mois.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let echecs = 0
const verifier = (intitule, condition, detail = '') => {
  if (condition) {
    console.log(`  OK   ${intitule}`)
  } else {
    console.log(`  ÉCHEC ${intitule}${detail ? ` — ${detail}` : ''}`)
    echecs += 1
  }
}

const { calculerRelances, NIVEAU_MAX_RELANCE, DELAI_ENTRE_RELANCES } = await import(
  'file://' + join(RACINE, 'src/shared/calculs.ts').replaceAll('\\', '/')
)

const AUJOURDHUI = '2026-08-13'

/** Une facture en attente, échue il y a `retard` jours, sans rappel. */
const facture = (id, retard, extras = {}) => ({
  id,
  numero: `F-${String(id).padStart(4, '0')}`,
  clientNom: `Client ${id}`,
  statut: 'En attente',
  dateEcheance: new Date(Date.parse(AUJOURDHUI) - retard * 86400000)
    .toISOString()
    .slice(0, 10),
  nombreRappels: 0,
  dernierRappelLe: null,
  ...extras
})

console.log('\n=== Le seuil de première relance ===')

// **Ce cas discrimine** : à 6 jours de retard avec un seuil de 7, une règle
// « tout ce qui est en retard » proposerait quand même la facture.
verifier(
  'une facture en retard mais sous le seuil n est pas proposée',
  calculerRelances([facture(1, 6)], AUJOURDHUI, 7).length === 0
)
verifier(
  'la même facture est proposée dès que le seuil est atteint',
  calculerRelances([facture(1, 7)], AUJOURDHUI, 7).length === 1
)
verifier(
  'une facture pas encore échue n est jamais proposée',
  calculerRelances([facture(1, -5)], AUJOURDHUI, 7).length === 0
)

console.log('\n=== Le statut prime sur le retard ===')

// Une facture payée avec 300 jours de retard : si le statut n était pas le
// premier filtre, elle arriverait en tête de liste.
for (const statut of ['Payée', 'Annulée']) {
  verifier(
    `une facture « ${statut} » très en retard n est pas relancée`,
    calculerRelances([facture(1, 300, { statut })], AUJOURDHUI, 7).length === 0
  )
}

console.log('\n=== Le délai entre deux relances ===')

// **Ce cas discrimine aussi** : la facture est très en retard, donc une règle
// qui ne regarderait que le retard la proposerait. C est le rappel récent qui
// doit la suspendre.
const relanceeHier = facture(1, 90, {
  nombreRappels: 1,
  dernierRappelLe: '2026-08-12'
})
verifier(
  'une facture relancée hier n est pas reproposée, même très en retard',
  calculerRelances([relanceeHier], AUJOURDHUI, 7).length === 0
)

const relanceeIlYaLongtemps = facture(1, 90, {
  nombreRappels: 1,
  dernierRappelLe: '2026-07-01'
})
const suite = calculerRelances([relanceeIlYaLongtemps], AUJOURDHUI, 7)
verifier(
  'passé le délai, elle revient — au niveau suivant',
  suite.length === 1 && suite[0].niveau === 2,
  JSON.stringify(suite)
)
verifier(
  'et le nombre de jours depuis le dernier rappel est rendu',
  suite[0].joursDepuisDernierRappel === 43,
  String(suite[0].joursDepuisDernierRappel)
)

// La borne exacte : à `DELAI_ENTRE_RELANCES` jours pile, on relance.
const pile = facture(1, 90, {
  nombreRappels: 1,
  dernierRappelLe: new Date(Date.parse(AUJOURDHUI) - DELAI_ENTRE_RELANCES * 86400000)
    .toISOString()
    .slice(0, 10)
})
verifier(
  'la borne du délai est inclusive : à J+délai, on relance',
  calculerRelances([pile], AUJOURDHUI, 7).length === 1
)

console.log('\n=== Le niveau maximal ===')

const epuisee = facture(1, 200, {
  nombreRappels: NIVEAU_MAX_RELANCE,
  dernierRappelLe: '2026-01-01'
})
const resultatEpuise = calculerRelances([epuisee], AUJOURDHUI, 7)
verifier(
  'au-delà du niveau maximal, la facture est encore listée',
  resultatEpuise.length === 1
)
verifier(
  'mais elle est marquée « épuisée » : on cesse de proposer un rappel',
  resultatEpuise[0].epuisee === true
)
verifier(
  'une facture sous le niveau maximal ne l est pas',
  calculerRelances(
    [facture(1, 200, { nombreRappels: 1, dernierRappelLe: '2026-01-01' })],
    AUJOURDHUI,
    7
  )[0].epuisee === false
)

console.log("\n=== L'ordre de la liste ===")

// **Ce cas discrimine** : sans tri, l ordre serait celui de la saisie, et les
// deux factures sortiraient dans l ordre inverse.
const ordre = calculerRelances([facture(1, 10), facture(2, 120), facture(3, 45)], AUJOURDHUI, 7)
verifier(
  'le plus en retard sort en premier',
  ordre.map((r) => r.factureId).join(',') === '2,3,1',
  ordre.map((r) => r.factureId).join(',')
)

console.log('\n=== La formule vit à un seul endroit ===')

/**
 * Le garde-fou de la maison : personne ne doit recompter un retard ailleurs.
 * Une seconde implémentation finirait par contredire celle-ci, et on ne saurait
 * plus laquelle croit l'écran.
 */
const ecran = readFileSync(join(RACINE, 'src/renderer/src/pages/Facturation.tsx'), 'utf-8')
verifier(
  "l'écran n'implémente pas son propre calcul de retard",
  !/joursDeRetard\s*=\s*Math\.floor/.test(ecran)
)

console.log(
  echecs === 0 ? '\nRELANCES : TOUS LES TESTS PASSENT' : `\n${echecs} TEST(S) EN ÉCHEC`
)
process.exit(echecs === 0 ? 0 : 1)
