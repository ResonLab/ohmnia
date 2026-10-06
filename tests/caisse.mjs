// La caisse : calcul d'un règlement, puis ventes sur une vraie base.
//
// **Pourquoi cette suite existe.** Colin a demandé le 6 octobre 2026 une vraie
// caisse (espèces, carte, mixte, change, ticket A4). L'argent d'un client se
// trompe au centime près ; cette suite éprouve le vrai code, compilé par esbuild,
// sur une vraie base — y compris les refus qui ne doivent rien écrire.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
const leve = (fonction) => {
  try {
    fonction()
    return false
  } catch {
    return true
  }
}

const DOSSIER = join(tmpdir(), 'ohmnia-test-caisse')
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
writeFileSync(entree, `export * from ${chemin('shared/caisse')}\n`)
const bundle = join(DOSSIER, 'caisse.mjs')
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
const c = await import('file://' + bundle.replace(/\\/g, '/'))

/* ── 1. Le calcul d'un règlement ─────────────────────────────────────────── */

console.log('=== Calcul du règlement ===')

verifier('12.33 s\'arrondit à 12.35', c.arrondirCinqCentimes(12.33) === 12.35)
verifier('12.32 s\'arrondit à 12.30', c.arrondirCinqCentimes(12.32) === 12.3)
verifier('12.325 s\'arrondit à 12.35', c.arrondirCinqCentimes(12.325) === 12.35)
verifier('zéro reste zéro', c.arrondirCinqCentimes(0) === 0)

const lignes = [{ quantite: 2, prixUnitaire: 10 }]
const sansTaxe = c.calculerTotalCaisse(lignes, false, 0)
verifier(
  'non assujetti : aucune taxe, total = sous-total',
  sansTaxe.sousTotal === 20 && sansTaxe.montantTva === 0 && sansTaxe.total === 20,
  JSON.stringify(sansTaxe)
)
const avecTaxe = c.calculerTotalCaisse(lignes, true, 8.1)
verifier(
  'assujetti à 8.1 % : 1.62 de taxe, 21.62 au total',
  avecTaxe.montantTva === 1.62 && avecTaxe.total === 21.62,
  JSON.stringify(avecTaxe)
)
verifier(
  'assujetti avec un taux à 0 : aucune taxe ajoutée',
  c.calculerTotalCaisse(lignes, true, 0).total === 20
)

const base = {
  total: 12.33,
  partCarte: 0,
  devise: 'CHF',
  deviseEntreprise: 'CHF',
  taux: 1,
  montantRecuEspeces: 20,
  arrondiSuisse: true
}
const especes = c.calculerReglement(base)
verifier(
  'espèces en CHF : 12.33 devient 12.35, arrondi 0.02, rendu 7.65',
  especes.especes === 12.35 && especes.arrondi === 0.02 && especes.rendu === 7.65 && especes.carte === 0,
  JSON.stringify(especes)
)
const sansArrondi = c.calculerReglement({ ...base, arrondiSuisse: false })
verifier(
  'hors CHF : aucun arrondi',
  sansArrondi.especes === 12.33 && sansArrondi.arrondi === 0 && sansArrondi.rendu === 7.67,
  JSON.stringify(sansArrondi)
)
const mixte = c.calculerReglement({ ...base, total: 50.03, partCarte: 30.03, montantRecuEspeces: 20 })
verifier(
  'mixte : la carte reste exacte, seules les espèces s\'arrondissent',
  mixte.carte === 30.03 && mixte.especes === 20 && mixte.arrondi === 0,
  JSON.stringify(mixte)
)
const mixteArrondi = c.calculerReglement({ ...base, total: 50, partCarte: 30.02, montantRecuEspeces: 20 })
verifier(
  'mixte : 19.98 en espèces devient 20.00, la carte garde ses 30.02',
  mixteArrondi.carte === 30.02 && mixteArrondi.especes === 20 && mixteArrondi.arrondi === 0.02,
  JSON.stringify(mixteArrondi)
)
const carteSeule = c.calculerReglement({ ...base, partCarte: 12.33, montantRecuEspeces: 0 })
verifier(
  'carte seule : rien en espèces, pas d\'arrondi, pas de rendu',
  carteSeule.carte === 12.33 && carteSeule.especes === 0 && carteSeule.arrondi === 0 && carteSeule.rendu === 0,
  JSON.stringify(carteSeule)
)
const change = c.calculerReglement({
  ...base,
  total: 40,
  devise: 'EUR',
  taux: 0.95,
  montantRecuEspeces: 45
})
verifier(
  'change : 40 CHF = 42.11 EUR à encaisser, 45 EUR remis, rendu 2.75 CHF',
  change.aEncaisserDeviseRecue === 42.11 && change.rendu === 2.75,
  JSON.stringify(change)
)
const memeDevise = c.calculerReglement({ ...base, taux: 7 })
verifier('devise de l\'entreprise : le taux saisi est ignoré', memeDevise.rendu === 7.65, JSON.stringify(memeDevise))

verifier('refus : part carte négative', leve(() => c.calculerReglement({ ...base, partCarte: -1 })))
verifier('refus : part carte supérieure au total', leve(() => c.calculerReglement({ ...base, partCarte: 13 })))
verifier('refus : espèces remises insuffisantes', leve(() => c.calculerReglement({ ...base, montantRecuEspeces: 10 })))
verifier(
  'refus : taux nul avec une devise étrangère',
  leve(() => c.calculerReglement({ ...base, devise: 'EUR', taux: 0 }))
)
verifier(
  'refus : taux négatif avec une devise étrangère',
  leve(() => c.calculerReglement({ ...base, devise: 'EUR', taux: -1 }))
)
verifier('refus : total nul', leve(() => c.calculerReglement({ ...base, total: 0 })))

console.log(echecs === 0 ? '\n  CAISSE : VALIDEE' : `\n  CAISSE : ${echecs} ECHEC(S)`)
process.exit(echecs === 0 ? 0 : 1)
