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
  'src/renderer/src/pages/Parametres.tsx',
  'src/renderer/src/pages/Inventaire.tsx',
  'src/renderer/src/pages/Clients.tsx',
  'src/renderer/src/pages/ResumeAnnuelPage.tsx',
  'src/renderer/src/pages/Comptabilite.tsx',
  'src/renderer/src/pages/Modeles.tsx',
  'src/renderer/src/pages/Audit.tsx',
  'src/renderer/src/pages/ImpressionDocument.tsx',
  'src/renderer/src/pages/Tarifs.tsx',
  'src/renderer/src/pages/Journal.tsx',
  'src/renderer/src/pages/SuiviTemps.tsx',
  'src/renderer/src/pages/ChargesMarge.tsx',
  'src/renderer/src/pages/AjoutRapide.tsx',
  'src/renderer/src/pages/DevisPage.tsx',
  'src/renderer/src/pages/Facturation.tsx',
  'src/renderer/src/pages/ParametresApp.tsx',
  // Les composants partagés. Ils ne sont pas des « écrans » — le compte affiché
  // plus bas ne les inclut pas — mais ils portent du texte que l'utilisateur
  // lit, et rien ne protégerait ce texte sans les inscrire ici.
  'src/renderer/src/components/RechercheGlobale.tsx',
  'src/renderer/src/components/BarresAnnuelles.tsx',
  'src/renderer/src/components/Camembert.tsx',
  'src/renderer/src/components/ClientSelecteur.tsx',
  'src/renderer/src/components/Justificatifs.tsx',
  'src/renderer/src/components/ConditionsUtilisation.tsx',
  'src/renderer/src/components/ReglageMultipostes.tsx',
  'src/renderer/src/components/ConnexionServeur.tsx'
]

/**
 * Les fins de ligne sont normalisées avant toute analyse.
 *
 * Sans cela, la suite passait en local et **échouait sur le runner Windows de
 * GitHub Actions**, qui extrait les fichiers en CRLF : le motif attendait un
 * saut de ligne juste après `}`, et trouvait un retour chariot. Elle
 * n'annonçait pas une erreur de traduction mais « 0 clé trouvée » — un
 * contrôle qui ne regarde plus rien.
 */
const sansRetourChariot = (texte) => texte.replaceAll('\r\n', '\n')

const lireNormalise = (relatif) =>
  sansRetourChariot(readFileSync(join(RACINE, relatif), 'utf-8'))

const i18n = lireNormalise('src/shared/i18n.ts')

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
  .map((f) => sansRetourChariot(readFileSync(f, 'utf-8')))
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
/**
 * **Ce que ce relevé ne verra jamais, et il faut le savoir.**
 *
 * Il repose sur l'accent, qui est le seul indice sûr de français dans du code
 * écrit en français. Une phrase française **sans aucun accent** lui échappe par
 * construction — et ce n'est pas théorique : « Actuellement : … sauvegarde(s). »
 * s'affichait au milieu d'un écran anglais, dans un fichier déclaré traduit, et
 * aucune des cinq passes de ce contrôle ne pouvait le voir.
 *
 * Il a été trouvé **en lançant l'application en anglais**, comme les autres
 * défauts que la relecture ne montre pas. C'est la parade, et la seule : passer
 * chaque écran dans les deux langues avant de le déclarer traduit.
 */
const ACCENTS = /[àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/

for (const relatif of ECRANS_TRADUITS) {
  const chemin = join(RACINE, relatif)
  const contenu = sansRetourChariot(readFileSync(chemin, 'utf-8'))
  const etiquette = relatif

  let dansCommentaire = false
  contenu.split('\n').forEach((ligne, index) => {
    const nue = ligne.trim()
    // `{/*` ouvre un commentaire JSX. Ne reconnaître que `/*` laissait passer
    // tout le bloc : les apostrophes du texte y formaient de fausses chaînes,
    // et le contrôle accusait un commentaire d'être du français en dur. **Un
    // faux échec use un contrôle aussi sûrement qu'un faux succès** — on
    // apprend à ignorer sa sortie, puis on le supprime.
    if (nue.startsWith('/*') || nue.startsWith('{/*')) dansCommentaire = true
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

    /**
     * **Et les chaînes littérales**, qui sont l'essentiel de ce qui échappait.
     *
     * Le contrôle ci-dessus ne regardait que le texte entre balises. Il ne
     * pouvait donc pas voir un `placeholder="Rechercher un client…"`, un
     * `alert('Client créé.')`, un `title=`, ni un ternaire
     * `{paye ? 'Payée' : 'En attente'}` — c'est-à-dire une bonne part du texte
     * qu'un utilisateur lit vraiment.
     *
     * **Ce n'était pas un contrôle incapable d'échouer** : il échouait très
     * bien sur ce qu'il regardait. C'est la troisième forme, plus sournoise —
     * une vérification dont on a étendu la confiance au-delà de son champ. Le
     * symptôme est le même : on ne cherche plus à la main ce qu'on croit
     * couvert. Et il a laissé passer, sous une suite verte, trois messages
     * français en dur dans `Clients.tsx` et la liste des catégories
     * d'`Inventaire.tsx`, deux écrans **déclarés traduits**.
     *
     * Toute chaîne accentuée est refusée, sans exception de commodité : dans un
     * écran déclaré traduit, il n'y a aucune raison légitime d'en écrire une.
     * Une exception serait la porte par laquelle le contrôle recommencerait à
     * ne plus rien regarder.
     */
    // Les trois sortes de délimiteur, l'accent grave compris : `${nb} écritures`
    // est du texte affiché autant que 'Client créé.'. Le gabarit manquait, et
    // quatre messages français y dormaient dans `ParametresApp.tsx`.
    const litteraux = [...ligne.matchAll(/(['"`])((?:[^\\\n]|\\.)*?)\1/g)].map((m) => m[2])
    for (const texte of litteraux) {
      if (ACCENTS.test(texte)) {
        echec(`${etiquette}:${index + 1} — chaîne française en dur : « ${texte.trim()} »`)
      }
    }

    /**
     * **Et le texte seul sur sa ligne**, entre deux balises écrites sur des
     * lignes différentes :
     *
     * ```jsx
     * <label>
     *   Entretien/usure véhicule ({symboleDevise()}/km)
     *   <input … />
     * </label>
     * ```
     *
     * Ni entre `>` et `<` sur la même ligne, ni entre guillemets : les deux
     * contrôles ci-dessus passaient à côté. C'est pourtant la mise en forme la
     * plus courante d'un libellé de champ dans ce projet — donc le cas le plus
     * fréquent, pas un cas tordu.
     *
     * **Trouvé par ricochet** : une clé déclarée et jamais employée a signalé
     * que le libellé n'était pas passé par `t()`. Sans ce troisième contrôle,
     * un libellé oublié qui n'aurait pas laissé de clé morte serait resté
     * français sous une suite verte.
     *
     * On écarte ce qui n'est pas du texte affiché : une ligne d'attribut, une
     * accolade JSX, une balise. Ce qui reste est du texte lu par l'utilisateur.
     */
    const estDuCode =
      nue.startsWith('<') ||
      nue.startsWith('{') ||
      nue.startsWith('}') ||
      nue.endsWith(',') ||
      nue.endsWith(';') ||
      nue.endsWith('=>') ||
      /^[\w$]+[=:]/.test(nue) ||
      // Un appel de fonction — `afficherSucces(…)`, `window.confirm(…)`. Le
      // contenu, lui, est déjà couvert par le relevé des littéraux ci-dessus :
      // le laisser passer ici donnerait deux messages pour un seul défaut.
      /^[\w$.]+\(/.test(nue) ||
      /[=;{}()[\]]/.test(nue.replace(/\([^)]*\)/g, ''))

    /**
     * **Une phrase reste une phrase, même avec une parenthèse ouverte.**
     *
     * La règle ci-dessus retire les parenthèses **appariées** avant de chercher
     * de la ponctuation de code. Quand une phrase est coupée en deux lignes au
     * milieu d'une parenthèse — « … externe (AES-256-GCM, mot de passe » —, la
     * parenthèse reste ouverte, ne peut pas être retirée, et toute la ligne
     * passe pour du code. Deux phrases françaises s'affichaient ainsi au milieu
     * d'un écran anglais **déclaré traduit**, sous une suite verte.
     *
     * On récupère donc ce que la prose a de reconnaissable : plusieurs mots,
     * un accent, et aucune ponctuation de programmation. Un identifiant ou un
     * appel de fonction n'a jamais quatre mots séparés par des espaces.
     */
    const estDeLaProse =
      nue.split(/\s+/).length >= 4 &&
      ACCENTS.test(nue) &&
      !/[=;{}[\]]/.test(nue) &&
      !nue.includes('=>') &&
      !/^[\w$.]+\(/.test(nue)

    if ((!estDuCode || estDeLaProse) && ACCENTS.test(nue) && nue.length >= 3) {
      echec(`${etiquette}:${index + 1} — texte français seul sur sa ligne : « ${nue} »`)
    }

    /**
     * **Cinquième forme : le texte qui ouvre la ligne et qu'une balise suit.**
     *
     * ```jsx
     * >
     *   Actuellement : <strong>{nb}</strong> sauvegarde(s).
     * ```
     *
     * « Actuellement : » n'est ni entre `>` et `<` sur la même ligne — le `>`
     * est à la ligne d'avant —, ni seul sur sa ligne, ni entre guillemets. Les
     * quatre relevés précédents passaient tous à côté, et la règle « une ligne
     * qui contient une accolade est du code » l'écartait explicitement.
     *
     * **Trouvé en lançant l'application en anglais**, pas en la relisant : deux
     * phrases françaises s'affichaient au milieu d'un écran anglais **déclaré
     * traduit**. C'est la cinquième passe sur la même question — « ce texte
     * est-il traduit ? » — et chacune des quatre précédentes semblait complète.
     */
    const avantBalise = ligne.split(/[<{]/)[0].trim()
    const estUnDebutDeTexte =
      avantBalise.length >= 3 &&
      avantBalise !== nue &&
      ACCENTS.test(avantBalise) &&
      // De la prose contient des espaces ; un identifiant, non.
      avantBalise.includes(' ') &&
      // **Les parenthèses ne sont pas exclues ici**, contrairement au relevé
      // précédent : une phrase en contient légitimement — « (AES-256-GCM, mot
      // de passe jamais enregistré) ». Les exclure faisait rater la moitié de
      // ce que cette règle existe pour trouver.
      !/[=;{}[\]]/.test(avantBalise) &&
      !/^[\w$.]+\(/.test(avantBalise)

    if (estUnDebutDeTexte) {
      echec(`${etiquette}:${index + 1} — texte français avant une balise : « ${avantBalise} »`)
    }
  })
}

/**
 * Le compte affiché distingue les écrans des composants.
 *
 * **Il a annoncé « 25 écrans sur 18 » le jour où les composants ont rejoint la
 * liste protégée**, parce qu'il comptait toute la liste contre le seul nombre
 * d'écrans. Un compte absurde décrédibilise une sortie aussi sûrement qu'un
 * faux échec : on cesse de la lire, et le jour où elle dit quelque chose de
 * vrai, personne ne le voit.
 *
 * Les deux familles sont donc comptées séparément, chacune contre son propre
 * total, et les totaux sont relevés sur le disque plutôt qu'écrits à la main.
 */
const estUnEcran = (relatif) =>
  relatif.includes('/pages/') || relatif.endsWith('/App.tsx')

const ecransTraduits = ECRANS_TRADUITS.filter(estUnEcran).length
const composantsTraduits = ECRANS_TRADUITS.length - ecransTraduits

const totalEcrans = fichiersTs(join(RACINE, 'src/renderer/src/pages')).length + 1
// Deux composants ne portent aucun texte — le logo et la modale générique — et
// n'ont donc rien à traduire. On compte ce qui existe, pas ce qu'on croit.
const totalComposants = fichiersTs(join(RACINE, 'src/renderer/src/components')).length

console.log(
  echecs === 0
    ? `TRADUCTIONS : ${entrees.length} clés · ${ecransTraduits} écran(s) sur ${totalEcrans} · ` +
        `${composantsTraduits} composant(s) sur ${totalComposants}`
    : `${echecs} PROBLÈME(S) DE TRADUCTION`
)
process.exit(echecs === 0 ? 0 : 1)
