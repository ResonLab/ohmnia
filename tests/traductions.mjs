import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/**
 * Vérifie que l'interface est réellement traduisible.
 *
 * Le piège que cette suite empêche : traduire un écran, puis y remettre un
 * bouton en français en dur trois semaines plus tard. Rien ne casse, rien
 * n'échoue — l'écran est simplement à moitié anglais, et personne ne le voit
 * avant qu'un utilisateur anglophone le signale.
 *
 * **Ohmnia n'est pas encore traduite en entier**, et cette suite le dit au lieu
 * de le taire. `ECRANS_TRADUITS` énumère ce qui est fait, et le contrôle du
 * texte en dur ne porte que sur ces fichiers-là. Ce n'est pas une exemption
 * commode : un écran traduit qu'on oublierait d'y inscrire ne serait plus
 * protégé contre une régression, et le compte affiché à chaque exécution dit
 * franchement où en est le chantier.
 *
 * Trois contrôles :
 *   1. aucune clé de `TEXTES` sans version anglaise ni française ;
 *   2. aucune clé déclarée mais jamais employée — une clé morte laisse croire
 *      qu'un écran est traduit alors qu'il ne l'est plus ;
 *   3. aucun texte français en dur dans un écran **déclaré traduit**.
 *
 * `npm run typecheck` couvre déjà le cas inverse — employer une clé qui
 * n'existe pas — parce que `t()` n'accepte que les clés de `TEXTES`.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let echecs = 0
const echec = (message) => {
  console.log(`  ÉCHEC : ${message}`)
  echecs += 1
}

/**
 * Les écrans dont tout le texte passe par `t()`.
 *
 * En ajouter un : le traduire entièrement, puis l'inscrire ici. Le faire dans
 * l'autre sens ferait échouer la suite, ce qui est exactement le but.
 */
const ECRANS_TRADUITS = [
  'src/renderer/src/App.tsx',
  'src/renderer/src/pages/Accueil.tsx',
  'src/renderer/src/pages/Inventaire.tsx',
  'src/renderer/src/pages/Clients.tsx'
]

const i18n = readFileSync(join(RACINE, 'src/shared/i18n.ts'), 'utf-8')

/* ── 1. Toute clé a une version anglaise ─────────────────────────────────── */

// On lit le bloc TEXTES seulement : le reste du fichier contient les fonctions.
const bloc = i18n.slice(i18n.indexOf('const TEXTES = {'), i18n.indexOf('} satisfies'))
const entrees = [...bloc.matchAll(/'([\w.]+)':\s*\{([\s\S]*?)\n?\s*\},?\n/g)]

if (entrees.length < 60) {
  echec(`seulement ${entrees.length} clés trouvées — le format de i18n.ts a changé`)
}

// Ni l'une ni l'autre version n'a le droit d'être vide : elle sortirait à
// l'écran comme une chaîne vide — invisible, donc jamais signalée.
for (const [, cle, corps] of entrees) {
  const litteral = (nom) => {
    // Le littéral de `fr:` ou de `en:`, guillemets simples ou doubles.
    const motif = new RegExp(nom + ":\\s*(['\"])((?:[^\\\\]|\\\\.)*?)\\1")
    return corps.match(motif)?.[2]
  }

  const en = litteral('en')
  if (en === undefined) echec(`« ${cle} » n'a pas de version anglaise`)
  else if (en.trim() === '') echec(`« ${cle} » a une version anglaise vide`)

  const fr = litteral('fr')
  if (fr === undefined) echec(`« ${cle} » n'a pas de version française`)
  else if (fr.trim() === '') echec(`« ${cle} » a une version française vide`)
}

/* ── 2. Aucune clé déclarée et jamais employée ───────────────────────────── */

function fichiersTs(dossier) {
  const resultats = []
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) resultats.push(...fichiersTs(chemin))
    else if (/\.tsx?$/.test(chemin)) resultats.push(chemin)
  }
  return resultats
}

const sources = fichiersTs(join(RACINE, 'src'))
  .filter((f) => !f.endsWith('i18n.ts'))
  .map((f) => readFileSync(f, 'utf-8'))
  .join('\n')

// `i18n.ts` est écarté du relevé des littéraux — il les contient tous, et rien
// n'y paraîtrait jamais inutilisé. Mais c'est là que vit `traduireErreur`, qui
// bâtit ses clés dynamiquement : on y cherche donc les préfixes, et eux seuls.
const prefixesDynamiques = [...(sources + i18n).matchAll(/`(\w+)\.\$\{/g)].map((m) => `${m[1]}.`)

const inutilisees = []
for (const [, cle] of entrees) {
  // Une clé peut être écrite en toutes lettres — t('plan.zone') — ou bâtie à
  // partir d'un préfixe — t(`erreur.${cle}`). On accepte les deux.
  if (sources.includes(`'${cle}'`)) continue
  if (prefixesDynamiques.some((prefixe) => cle.startsWith(prefixe))) continue
  inutilisees.push(cle)
}
if (inutilisees.length > 0) {
  echec(`clés déclarées mais jamais employées : ${inutilisees.join(', ')}`)
}

/* ── 3. Aucun texte français en dur dans un composant ────────────────────── */

// On ne cherche pas « du français » — indécidable. On cherche ce qui le trahit
// à coup sûr dans du code écrit en français : un mot accentué, hors chaîne
// technique, dans du texte que React affichera.
const ACCENTS = /[àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/

for (const relatif of ECRANS_TRADUITS) {
  const chemin = join(RACINE, relatif)
  const contenu = readFileSync(chemin, 'utf-8')
  const etiquette = relatif

  let dansCommentaire = false
  contenu.split('\n').forEach((ligne, index) => {
    const nue = ligne.trim()
    if (nue.startsWith('/*')) dansCommentaire = true
    if (dansCommentaire) {
      if (nue.includes('*/')) dansCommentaire = false
      return
    }
    if (nue.startsWith('//') || nue.startsWith('*')) return

    // Le texte entre balises : > Bonjour <
    const entreBalises = [...ligne.matchAll(/>\s*([^<>{}\n]{3,})\s*</g)].map((m) => m[1])
    for (const texte of entreBalises) {
      if (ACCENTS.test(texte)) {
        echec(`${etiquette}:${index + 1} — texte français en dur : « ${texte.trim()} »`)
      }
    }
  })
}

const totalEcrans = fichiersTs(join(RACINE, 'src/renderer/src/pages')).length + 1

console.log(
  echecs === 0
    ? `TRADUCTIONS : ${entrees.length} clés · ${ECRANS_TRADUITS.length} écran(s) sur ${totalEcrans} entièrement traduits`
    : `${echecs} PROBLÈME(S) DE TRADUCTION`
)
process.exit(echecs === 0 ? 0 : 1)
