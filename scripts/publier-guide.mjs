import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Fabrique les pages du guide, dans les deux langues.
 *
 * **Le texte n'est écrit qu'une fois**, dans `src/shared/guide.ts`, et les
 * pages en sont déduites — comme les conditions, et pour la même raison : deux
 * versions d'une même explication qui divergent, c'est pire que pas
 * d'explication, parce qu'on ne sait plus laquelle est à jour.
 *
 * La coque des pages vient de `docs/index.html` : le CSS n'est jamais recopié.
 *
 *   npm run guide:publier
 */
const PROJET = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Lit le guide sans compiler le TypeScript.
 *
 * Le fichier ne contient que des données : on en extrait les littéraux plutôt
 * que d'ajouter un empaqueteur à un script qui écrit deux pages HTML. **Le
 * format est vérifié** — un fichier qu'on ne sait plus lire fait échouer le
 * script, il ne produit pas une page vide.
 */
function lireGuide() {
  const source = readFileSync(join(PROJET, 'src/shared/guide.ts'), 'utf-8')

  const bloc = source.slice(
    source.indexOf('export const GUIDE'),
    source.indexOf("/** Ce qu'on retient")
  )

  const motifCouple = /(fr|en): (['"])((?:[^\\]|\\.)*?)\2/g
  const sections = []

  // Une section commence à `titre:` au premier niveau d'indentation du tableau.
  for (const morceau of bloc.split(/\n  \{\n    titre:/).slice(1)) {
    const couples = [...('titre:' + morceau).matchAll(motifCouple)].map((m) => ({
      langue: m[1],
      texte: m[3]
    }))
    // Ordre garanti par la structure du fichier : titre, intro, puis chaque
    // étape — titre, texte, et le piège quand il y en a un.
    if (couples.length < 4) continue

    const titre = { fr: couples[0].texte, en: couples[1].texte }
    const intro = { fr: couples[2].texte, en: couples[3].texte }

    const etapes = []
    const restes = couples.slice(4)
    // Chaque étape est un `titre` + un `texte`, éventuellement suivi d'un
    // `piege`. On repère les pièges par leur présence dans la source.
    const nomsChamps = [...('titre:' + morceau).matchAll(/(titre|texte|piege):\s*\{/g)].map(
      (m) => m[1]
    )
    // Le premier `titre` est celui de la section ; `intro` n'est pas un objet.
    const champsEtapes = nomsChamps.slice(1)

    let i = 0
    let etape = null
    for (const champ of champsEtapes) {
      const couple = { fr: restes[i]?.texte ?? '', en: restes[i + 1]?.texte ?? '' }
      i += 2
      if (champ === 'titre') {
        if (etape) etapes.push(etape)
        etape = { titre: couple, texte: { fr: '', en: '' }, piege: null }
      } else if (champ === 'texte' && etape) {
        etape.texte = couple
      } else if (champ === 'piege' && etape) {
        etape.piege = couple
      }
    }
    if (etape) etapes.push(etape)

    sections.push({ titre, intro, etapes })
  }

  if (sections.length < 4) {
    throw new Error(`Seulement ${sections.length} sections lues dans guide.ts — le format a changé.`)
  }

  const resume = source.slice(source.indexOf('RESUME_GUIDE = {'))
  const resumeFr = resume.match(/fr: (['"])((?:[^\\]|\\.)*?)\1/)?.[2]
  const resumeEn = resume.match(/en: (['"])((?:[^\\]|\\.)*?)\1/)?.[2]
  if (!resumeFr || !resumeEn) throw new Error('RESUME_GUIDE illisible')

  return { sections, resume: { fr: resumeFr, en: resumeEn } }
}

/** Les apostrophes typographiques du code passent telles quelles en HTML. */
function echapper(texte) {
  return texte
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll("\\'", "'")
}

function corps(guide, langue) {
  const fr = langue === 'fr'
  const choisir = (couple) => echapper(fr ? couple.fr : couple.en)

  const sections = guide.sections
    .map(
      (section) => `
    <h2 class="titre reveal">${choisir(section.titre)}</h2>
    <p class="intro reveal">${choisir(section.intro)}</p>
${section.etapes
  .map(
    (etape) => `    <div class="card reveal">
      <h3>${choisir(etape.titre)}</h3>
      <p>${choisir(etape.texte)}</p>${
        etape.piege
          ? `\n      <p class="piege"><strong>${fr ? 'Le piège' : 'The catch'}</strong> — ${choisir(etape.piege)}</p>`
          : ''
      }
    </div>`
  )
  .join('\n')}`
    )
    .join('\n')

  return `<main>
  <section class="hero wrap">
    <p class="etat-ligne">${fr ? 'GUIDE DE PRISE EN MAIN' : 'GETTING STARTED'}</p>
    <h1>${
      fr
        ? 'Par où <span class="grad-text">commencer</span>.'
        : 'Where to <span class="grad-text">start</span>.'
    }</h1>
    <p class="chapo">${echapper(fr ? guide.resume.fr : guide.resume.en)}</p>
  </section>

  <section class="wrap">${sections}
  </section>
</main>`
}

function fabriquer(guide, source, cible, langue, titre, description) {
  const modele = readFileSync(join(PROJET, source), 'utf-8')
  const avant = modele.slice(0, modele.indexOf('<main>'))
  const apres = modele.slice(modele.indexOf('</main>') + '</main>'.length)

  let page = avant
    .replace(/<title>.*?<\/title>/, `<title>${titre}</title>`)
    .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${description}" />`)

  // **Toutes** les ancres du bandeau renvoient à l'accueil, pas une liste
  // choisie à la main. Les sections d'une page d'accueil ne portent pas les
  // mêmes noms d'une application à l'autre — `#modules` ici, `#fonctionnalites`
  // là — et une liste figée laissait des ancres mortes sur le guide, que seul
  // le contrôle du site voyait. La règle générale n'a rien à maintenir.
  page = page.replaceAll('href="#', 'href="index.html#')

  // Le sélecteur de langue relie les deux guides entre eux.
  page =
    langue === 'fr'
      ? page.replace(
          '<a href="en/" class="langue" hreflang="en">EN</a>',
          '<a href="en/guide.html" class="langue" hreflang="en">EN</a>'
        )
      : page.replace(
          '<a href="../" class="langue" hreflang="fr">FR</a>',
          '<a href="../guide.html" class="langue" hreflang="fr">FR</a>'
        )

  const pied = apres.replaceAll('href="#', 'href="index.html#')
  writeFileSync(join(PROJET, cible), page + corps(guide, langue) + pied, 'utf-8')
  console.log(`${cible} écrit`)
}

const guide = lireGuide()

fabriquer(
  guide,
  'docs/index.html',
  'docs/guide.html',
  'fr',
  'Ohmnia — par où commencer',
  "Le guide de prise en main d'Ohmnia : entreprise, clients, factures, comptabilité, sauvegardes. Dans cet ordre, et pourquoi."
)
fabriquer(
  guide,
  'docs/en/index.html',
  'docs/en/guide.html',
  'en',
  'Ohmnia — where to start',
  'Getting started with Ohmnia: business, customers, invoices, bookkeeping, backups. In that order, and why.'
)

const etapes = guide.sections.reduce((total, s) => total + s.etapes.length, 0)
const pieges = guide.sections.reduce(
  (total, s) => total + s.etapes.filter((e) => e.piege).length,
  0
)
console.log(`${guide.sections.length} sections, ${etapes} étapes, ${pieges} pièges`)
