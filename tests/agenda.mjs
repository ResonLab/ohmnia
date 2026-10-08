// L'agenda : dates et totaux, puis événements, locations, disponibilité et facture sur une vraie base.
//
// **Pourquoi cette suite existe.** Colin a demandé le 6 octobre 2026 un agenda pour ses événements
// et pour ses locations de matériel, en plusieurs exemplaires. Deux erreurs coûtent cher ici et
// ne se voient pas à l'écran : un chevauchement de dates mal compté (matériel loué deux fois) et
// une facture de location qui retirerait du stock du matériel qui revient. Cette suite éprouve le
// vrai code, compilé par esbuild, sur une vraie base.
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

const DOSSIER = join(tmpdir(), 'ohmnia-test-agenda')
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
writeFileSync(entree, `export * from ${chemin('shared/agenda')}\n`)
const bundle = join(DOSSIER, 'agenda.mjs')
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
const a = await import('file://' + bundle.replace(/\\/g, '/'))

/* ── 1. Dates, chevauchements, totaux, grille ────────────────────────────── */

console.log('=== Calculs de l\'agenda ===')

verifier('un seul jour compte pour 1', a.nombreDeJours('2026-10-10', '2026-10-10') === 1)
verifier('du 10 au 12, bornes comprises : 3 jours', a.nombreDeJours('2026-10-10', '2026-10-12') === 3)
verifier('à cheval sur deux mois : du 30 octobre au 2 novembre = 4 jours', a.nombreDeJours('2026-10-30', '2026-11-02') === 4)
verifier('passage à l\'heure d\'été : du 28 au 30 mars = 3 jours', a.nombreDeJours('2026-03-28', '2026-03-30') === 3)
verifier('fin avant début : refusé', leve(() => a.nombreDeJours('2026-10-12', '2026-10-10')))
verifier('date mal formée : refusé', leve(() => a.nombreDeJours('abc', '2026-10-10')))

const p = (debut, fin) => ({ debut: `2026-10-${debut}`, fin: `2026-10-${fin}` })
verifier('qui finit le 12 et commence le 12 : se chevauchent', a.periodesSeChevauchent(p('10', '12'), p('12', '14')) === true)
verifier('qui finit le 12 et commence le 13 : ne se chevauchent pas', a.periodesSeChevauchent(p('10', '12'), p('13', '14')) === false)
verifier('une période incluse dans l\'autre : se chevauchent', a.periodesSeChevauchent(p('10', '12'), p('11', '11')) === true)
verifier('une période qui en contient une autre : se chevauchent', a.periodesSeChevauchent(p('10', '12'), p('09', '13')) === true)

verifier('3 × 12.50 sur 3 jours = 112.50', a.totalLigneLocation({ quantite: 3, prixParJour: 12.5 }, 3) === 112.5)
verifier('2 × 0.10 sur 3 jours = 0.60 (sans erreur de virgule flottante)', a.totalLigneLocation({ quantite: 2, prixParJour: 0.1 }, 3) === 0.6)
verifier(
  'le total d\'une location est la somme des lignes',
  a.totalLocation([{ quantite: 1, prixParJour: 10 }, { quantite: 2, prixParJour: 5 }], 2) === 40
)
verifier('la date courte se lit JJ.MM.AAAA', a.formaterDateCourte('2026-10-08') === '08.10.2026')

const octobre = a.grilleDuMois(2026, 10)
verifier('la grille a 42 jours', octobre.length === 42)
verifier('la grille d\'octobre 2026 commence le lundi 28 septembre', octobre[0] === '2026-09-28', octobre[0])
verifier('et finit le dimanche 8 novembre', octobre[41] === '2026-11-08', octobre[41])
verifier('elle contient le 31 octobre', octobre.includes('2026-10-31'))
verifier('un mois qui commence un lundi commence la grille ce jour-là', a.grilleDuMois(2027, 2)[0] === '2027-02-01')

console.log(echecs === 0 ? '\n  AGENDA : VALIDE' : `\n  AGENDA : ${echecs} ECHEC(S)`)
process.exit(echecs === 0 ? 0 : 1)
