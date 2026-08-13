import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/**
 * Vérifie que le site vitrine reste cohérent avec l'application.
 *
 * Le piège que cette suite empêche : modifier les conditions d'utilisation dans
 * `src/shared/conditions.ts` et oublier la page publique, ou l'inverse. Les deux
 * textes divergent alors en silence, et l'utilisateur lit sur le site autre chose
 * que ce qu'il a accepté dans l'application.
 *
 * Elle contrôle aussi ce qui casse un site statique sans prévenir : un lien mort,
 * une image absente, une ressource externe glissée dans une page qui doit rester
 * autonome.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(RACINE, 'docs')

let echecs = 0
const echec = (message) => {
  console.log(`  ÉCHEC : ${message}`)
  echecs += 1
}

/* ── 1. Le texte des conditions doit être identique au code ──────────────── */

const source = readFileSync(join(RACINE, 'src/shared/conditions.ts'), 'utf-8')
const pageFr = readFileSync(join(DOCS, 'conditions.html'), 'utf-8')

// Les paragraphes sont les longues chaînes littérales du fichier source.
const paragraphes = [...source.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
  .map((m) => m[1])
  .filter((s) => s.length > 60)

if (paragraphes.length < 15) {
  echec(`seulement ${paragraphes.length} paragraphes trouvés dans conditions.ts — le format a changé`)
}

for (const p of paragraphes) {
  if (!pageFr.includes(p)) {
    echec(`paragraphe absent de docs/conditions.html : « ${p.slice(0, 70)}… »`)
  }
}

const titres = [...source.matchAll(/titre: ['"](\d\..*?)['"]/g)].map((m) => m[1])
for (const t of titres) {
  if (!pageFr.includes(t)) echec(`titre absent de docs/conditions.html : « ${t} »`)
}

// La version affichée sur le site doit suivre celle du code.
const version = source.match(/VERSION_CONDITIONS = '([^']+)'/)?.[1]
if (!version) {
  echec("VERSION_CONDITIONS introuvable dans conditions.ts")
} else if (!pageFr.includes(`Version ${version}`)) {
  echec(`docs/conditions.html n'affiche pas « Version ${version} »`)
}

/* ── 2. La version anglaise doit rester alignée ──────────────────────────── */

const pageEn = join(DOCS, 'en/terms.html')
if (!existsSync(pageEn)) {
  echec('docs/en/terms.html est absent')
} else {
  const en = readFileSync(pageEn, 'utf-8')

  // On ne peut pas comparer mot à mot une traduction : on compare la structure.
  const sectionsFr = (pageFr.match(/<h2 id="s\d"/g) ?? []).length
  const sectionsEn = (en.match(/<h2 id="s\d"/g) ?? []).length
  if (sectionsFr !== sectionsEn) {
    echec(`sections des conditions : ${sectionsFr} en français, ${sectionsEn} en anglais`)
  }

  const parasFr = (pageFr.match(/<section class="reveal">[\s\S]*?<\/section>/g) ?? [])
    .join('').match(/<p>/g)?.length ?? 0
  const parasEn = (en.match(/<section class="reveal">[\s\S]*?<\/section>/g) ?? [])
    .join('').match(/<p>/g)?.length ?? 0
  if (parasFr !== parasEn) {
    echec(`paragraphes des conditions : ${parasFr} en français, ${parasEn} en anglais`)
  }

  if (version && !en.includes(`Version ${version}`)) {
    echec(`docs/en/terms.html n'affiche pas « Version ${version} »`)
  }

  // Une traduction ne fait pas foi : la page doit le dire.
  if (!/authoritative/i.test(en)) {
    echec("docs/en/terms.html ne précise pas que la version française fait foi")
  }
}

/* ── 2 bis. L'écran d'acceptation dit lequel des deux textes fait foi ───── */

/**
 * **Le site le disait ; l'application ne le disait pas.**
 *
 * La page anglaise annonce que la version française fait foi — le contrôle
 * ci-dessus l'exige. Mais c'est dans l'**application** qu'on accepte : un
 * anglophone y voit une interface anglaise, un texte juridique français, et
 * aucune explication. Il accepte un document qu'il ne peut pas lire, sans
 * savoir qu'une traduction existe ni qu'elle ne prévaut pas.
 *
 * Trouvé le 13 août 2026 en vérifiant une hypothèse fausse : je croyais que
 * `conditions.ts` aurait dû être bilingue comme dans les quatre autres
 * applications. Il ne devait pas l'être — deux textes également contraignants
 * seraient pires qu'un seul — mais la vérification a montré le vrai manque, à
 * côté de celui que je cherchais.
 *
 * Le contrôle porte sur l'écran, pas sur la page : c'est là que le geste
 * d'acceptation a lieu.
 */
{
  const ecran = readFileSync(
    join(RACINE, 'src/renderer/src/components/ConditionsUtilisation.tsx'),
    'utf-8'
  )
  if (!ecran.includes("t('cond.texteFaitFoi')")) {
    echec(
      "l'écran d'acceptation ne dit plus lequel des deux textes fait foi — " +
        'un anglophone accepterait un texte français sans le savoir'
    )
  }

  // Et la clé doit encore porter les deux versions : la retirer de `i18n.ts`
  // ferait afficher la clé brute, ce que le typecheck ne voit pas.
  const i18n = readFileSync(join(RACINE, 'src/shared/i18n.ts'), 'utf-8')
  if (!i18n.includes("'cond.texteFaitFoi'")) {
    echec("la clé « cond.texteFaitFoi » a disparu de i18n.ts")
  }
  for (const mot of ['fait foi', 'authoritative']) {
    if (!i18n.includes(mot)) {
      echec(`le texte de « cond.texteFaitFoi » ne dit plus « ${mot} »`)
    }
  }
}

/* ── 3. Aucun lien mort, aucune ressource externe ────────────────────────── */

const pages = [
  ...readdirSync(DOCS).filter((f) => f.endsWith('.html')).map((f) => ['.', f]),
  ...(existsSync(join(DOCS, 'en'))
    ? readdirSync(join(DOCS, 'en')).filter((f) => f.endsWith('.html')).map((f) => ['en', f])
    : [])
]

for (const [dossier, fichier] of pages) {
  const chemin = join(DOCS, dossier, fichier)
  const html = readFileSync(chemin, 'utf-8')
  const etiquette = `${dossier === '.' ? '' : dossier + '/'}${fichier}`

  for (const [, cible] of html.matchAll(/href="([^"#:]+\.html)"/g)) {
    if (!existsSync(resolve(DOCS, dossier, cible))) echec(`lien mort dans ${etiquette} → ${cible}`)
  }
  for (const [, cible] of html.matchAll(/src="([^"]+\.(?:png|jpg|svg))"/g)) {
    if (!existsSync(resolve(DOCS, dossier, cible))) echec(`image absente dans ${etiquette} → ${cible}`)
  }
  for (const [, ancre] of html.matchAll(/href="#([^"]+)"/g)) {
    if (!html.includes(`id="${ancre}"`)) echec(`ancre morte dans ${etiquette} → #${ancre}`)
  }

  // GitHub Pages doit pouvoir servir ces fichiers seuls : rien ne doit être
  // chargé depuis un autre serveur, ni police, ni script, ni feuille de style.
  if (/<script[^>]+src=/.test(html)) echec(`${etiquette} charge un script externe`)
  if (/<link[^>]*rel="stylesheet"/.test(html)) echec(`${etiquette} charge une feuille de style externe`)
  for (const [, url] of html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)) {
    if (!url.startsWith('https://github.com/ResonLab')) {
      echec(`${etiquette} référence une ressource externe : ${url}`)
    }
  }
}

console.log(
  echecs === 0
    ? `SITE COHÉRENT (${pages.length} pages, ${paragraphes.length} paragraphes de conditions vérifiés)`
    : `${echecs} PROBLÈME(S) SUR LE SITE`
)
process.exit(echecs === 0 ? 0 : 1)
