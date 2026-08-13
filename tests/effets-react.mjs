import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * Un `useEffect` qui sort sur une valeur doit déclarer cette valeur en
 * dépendance.
 *
 * **Le défaut que cette suite existe pour attraper**, signalé par
 * l'utilisateur le 13 août 2026 : il ne parvenait pas à changer la langue.
 *
 * ```js
 * useEffect(() => {
 *   if (enAttenteDeConnexion || multipostes === null) return
 *   window.api.parametresApp.lire().then(appliquer)
 * }, [])                                   // ← la liste est vide
 * ```
 *
 * Au montage, `multipostes` vaut `null` — c'est sa valeur de départ. L'effet
 * sortait donc aussitôt, et la liste vide lui interdisait de repasser une fois
 * la valeur connue. **La langue et le thème enregistrés n'étaient jamais
 * appliqués au lancement**, et l'application retombait sur ses valeurs par
 * défaut à chaque démarrage.
 *
 * **Aucune relecture ne pouvait le voir** : l'effet est écrit correctement. Ce
 * qui manque n'est pas dans ce qu'on lit, c'est dans ce qui n'est pas rejoué.
 * Et aucune suite ne le voyait non plus — c'est pourquoi celle-ci est écrite
 * avant le correctif, selon la règle de la maison : quand un défaut est trouvé
 * à la main, se demander quelle suite aurait dû le voir, et si la réponse est
 * « aucune », l'écrire.
 *
 * **Le contrôle est volontairement étroit.** Il ne prétend pas remplacer
 * `react-hooks/exhaustive-deps` — ajouter ESLint à un projet dont le principe
 * est « pas d'abstraction inutile » coûterait plus cher que ce qu'il rapporte
 * ici. Il ne regarde qu'un motif, celui qui a mordu : un `if (…) return` en
 * tête d'effet. Les identifiants du garde-fou doivent figurer dans la liste.
 *
 * Le champ restreint est ce qui le rend utilisable : **un faux échec use un
 * contrôle aussi sûrement qu'un faux succès**. Un contrôle qui crie sur du code
 * correct finit contourné, puis supprimé.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let echecs = 0
const echec = (message) => {
  console.log(`  ÉCHEC : ${message}`)
  echecs += 1
}

function fichiersTsx(dossier) {
  const resultats = []
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) resultats.push(...fichiersTsx(chemin))
    else if (chemin.endsWith('.tsx')) resultats.push(chemin)
  }
  return resultats
}

/**
 * Ce qui n'est pas une valeur réactive, et n'a donc rien à faire en dépendance.
 *
 * `window`, `document` et consorts ne changent pas d'un rendu à l'autre. Les
 * exiger produirait exactement le faux échec qu'on veut éviter.
 */
const NON_REACTIFS = new Set([
  'window',
  'document',
  'navigator',
  'localStorage',
  'console',
  'null',
  'undefined',
  'true',
  'false',
  'Number',
  'String',
  'Boolean',
  'Date',
  'Math',
  'JSON',
  'Object',
  'Array'
])

let effetsTrouves = 0
let effetsExamines = 0

for (const chemin of fichiersTsx(join(RACINE, 'src/renderer/src'))) {
  const source = readFileSync(chemin, 'utf-8').replaceAll('\r\n', '\n')
  const etiquette = relative(RACINE, chemin).replaceAll('\\', '/')
  const lignes = source.split('\n')

  for (const [index, ligne] of lignes.entries()) {
    if (!/useEffect\(\(\) => \{\s*$/.test(ligne.trim())) continue
    effetsTrouves += 1

    /**
     * Le garde-fou, s'il existe, est la **première instruction** de l'effet.
     *
     * On ne regarde que celle-là, et c'est délibérément étroit. Deux raisons :
     * plus loin dans le corps, un `return` conditionnel relève de la logique de
     * l'effet et non de sa condition d'exécution ; et surtout, un garde posé
     * après une lecture de référence — `const zone = ref.current` puis
     * `if (!zone) return` — porte sur une **référence**, qui n'a rien à faire
     * dans une liste de dépendances. L'exiger produirait un faux échec sur du
     * code parfaitement correct, et c'est exactement ce qui use un contrôle.
     *
     * Les trois autres applications de la maison n'ont que des gardes de ce
     * genre : elles affichent donc « 0 effet gardé », et c'est la vérité.
     */
    let premiere = index + 1
    while (
      premiere < lignes.length &&
      (lignes[premiere].trim() === '' || lignes[premiere].trim().startsWith('//'))
    ) {
      premiere += 1
    }
    const garde = lignes[premiere]?.trim() ?? ''
    const condition = garde.match(/^if \((.+)\) return$/)?.[1]
    if (!condition) continue

    // La liste de dépendances ferme l'effet : `}, [ … ])`.
    let fin = premiere
    let deps = null
    while (fin < lignes.length && fin < premiere + 400) {
      const trouve = lignes[fin].match(/^\s*\}, \[(.*)\]\)/)
      if (trouve) {
        deps = trouve[1]
        break
      }
      fin += 1
    }
    if (deps === null) continue

    effetsExamines += 1

    const declarees = new Set(
      deps
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
    )

    /**
     * Les chaînes littérales sont retirées **avant** de relever les
     * identifiants.
     *
     * Sans cela, `if (theme !== 'auto') return` réclamait « auto » en
     * dépendance : un faux échec sur du code parfaitement correct, trouvé au
     * premier essai de cette suite. C'est le genre de bruit qui fait perdre
     * confiance à un contrôle, et un contrôle auquel on ne croit plus ne
     * protège plus rien.
     */
    const conditionNue = condition.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, ' ')

    // Les identifiants du garde-fou, sans les accès à une propriété
    // (`params.langue` dépend de `params`, qu'on relève seul) ni les appels.
    const identifiants = new Set(
      [...conditionNue.matchAll(/\b([A-Za-z_$][\w$]*)\b(?!\s*[.(])/g)]
        .map((m) => m[1])
        .filter((nom) => !NON_REACTIFS.has(nom))
    )

    for (const nom of identifiants) {
      if (!declarees.has(nom)) {
        echec(
          `${etiquette}:${index + 1} — l'effet sort sur « ${nom} » ` +
            `mais ne le déclare pas en dépendance : il ne repassera jamais ` +
            `(dépendances : [${deps}])`
        )
      }
    }
  }
}

/**
 * **Un contrôle qui n'examine rien dirait OK.**
 *
 * Si le motif de reconnaissance des `useEffect` cesse un jour de correspondre —
 * une mise en forme différente, un effet écrit autrement — cette suite
 * passerait au vert en ne regardant plus rien. C'est la panne rencontrée trois
 * fois dans la maison, et elle ne se signale pas d'elle-même.
 *
 * **Ce garde-fou compte les effets trouvés, pas les effets gardés**, et la
 * distinction a été payée : un premier jet exigeait au moins trois effets
 * *gardés*, et il a échoué dans les trois autres applications de la maison —
 * lesquelles n'ont que des gardes sur des références, légitimement ignorées.
 * Le contrôle criait donc sur du code correct, ce qui est le plus sûr moyen
 * qu'on cesse de l'écouter. Zéro effet gardé est une réponse valable ; zéro
 * effet trouvé ne l'est pas, dans une application React.
 */
if (effetsTrouves === 0) {
  echec(
    'aucun useEffect trouvé — le motif ne correspond plus, ' +
      'ce contrôle ne regarde plus rien'
  )
}

console.log(
  echecs === 0
    ? `EFFETS REACT : ${effetsTrouves} effet(s), dont ${effetsExamines} gardé(s) — ` +
        'tous déclarent leur garde-fou'
    : `${echecs} PROBLÈME(S) SUR LES EFFETS REACT`
)
process.exit(echecs === 0 ? 0 : 1)
