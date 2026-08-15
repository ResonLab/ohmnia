import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/**
 * Ce qui part sur un document ne suit jamais la langue de l'interface.
 *
 * **Le défaut que cette suite empêche.** « Mon entreprise » a été le dernier
 * écran d'Ohmnia à traduire, et il attendait une décision plutôt que du
 * travail : ses libellés viennent de `pays.ts`, et ces chaînes ne sont pas
 * toutes de la même nature.
 *
 * · le **nom du pays**, l'**aide de saisie** et le **seuil indicatif** sont du
 *   texte d'écran : ils expliquent à celui qui règle l'application, et ils
 *   doivent suivre sa langue ;
 * · le **nom de la taxe**, le **libellé de l'identifiant fiscal** et la
 *   **mention de non-assujettissement** sont recopiés par `documents.ts` dans
 *   la facture imprimée. Les traduire produirait une facture allemande dont la
 *   taxe s'appellerait « VAT », ou une facture française portant une mention
 *   légale en anglais. **Ce défaut-là ne se découvre pas ici : il se découvre
 *   chez le client**, et il touche un document fiscal.
 *
 * La règle retenue est donc : *ce qui reste à l'écran suit le lecteur, ce qui
 * part sur le document appartient au pays d'émission.* La mention allemande est
 * en allemand parce que l'Allemagne l'exige ainsi, pas parce que l'interface
 * est dans une langue ou dans une autre.
 *
 * **Le type porte déjà la règle** — `EcranPays` n'a pas de champ pour les trois
 * chaînes de document. Cette suite vérifie ce que le type ne peut pas dire :
 * que personne n'a contourné en les faisant passer par `t()`, et que la mention
 * de chaque pays est bien restée dans sa langue.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lire = (relatif) => readFileSync(join(RACINE, relatif), 'utf-8').replaceAll('\r\n', '\n')

let echecs = 0
function verifier(intitule, condition, detail = '') {
  if (!condition) echecs += 1
  console.log(`  ${condition ? 'OK  ' : 'ÉCHEC'} ${intitule}`)
  if (!condition && detail) console.log(`        ${detail}`)
}

const pays = lire('src/shared/pays.ts')
const documents = lire('src/main/domaines/documents.ts')

console.log('=== Ce qui part sur le document ===')

/**
 * Les champs recopiés dans le document, relevés dans `documents.ts` et non
 * écrits ici : une liste à la main cesserait de décrire le code au premier
 * champ ajouté, et c'est exactement le défaut qu'on cherche à empêcher.
 */
// Le champ peut être recopié tel quel — `nomTaxe: profil.nomTaxe` — ou sous
// condition : `mentionNonAssujetti: entreprise.assujettiTva ? '' : profil.…`.
// Le premier jet ne voyait que le cas simple et en manquait un sur trois : il
// aurait laissé passer la traduction de la mention légale, c'est-à-dire
// exactement ce que cette suite existe pour empêcher.
const CHAMPS_DOCUMENT = [...new Set([...documents.matchAll(/profil\.(\w+)/g)].map((t) => t[1]))]

verifier(
  'on relève bien les champs recopiés dans le document',
  CHAMPS_DOCUMENT.length >= 3,
  `${CHAMPS_DOCUMENT.length} champ(s) : ${CHAMPS_DOCUMENT.join(', ')}`
)

// Le type `EcranPays` énumère ce qui a le droit de changer de langue. Un champ
// de document qui s'y glisserait ouvrirait la porte sans qu'on s'en aperçoive.
const bloc = pays.slice(pays.indexOf('export interface EcranPays'), pays.indexOf('export interface ProfilPays'))
const champsEcran = [...bloc.matchAll(/^\s{2}(\w+):/gm)].map((t) => t[1])

verifier(
  'on relève bien les champs traduisibles',
  champsEcran.length >= 3,
  `${champsEcran.length} champ(s) : ${champsEcran.join(', ')}`
)

const fuites = CHAMPS_DOCUMENT.filter((champ) => champsEcran.includes(champ))
verifier(
  'aucun champ imprimé ne figure parmi les champs traduisibles',
  fuites.length === 0,
  fuites.length > 0
    ? `${fuites.join(', ')} part sur la facture ET suit la langue de l’interface — ` +
      `une facture porterait une mention dans la mauvaise langue`
    : ''
)

console.log('\n=== Aucun champ imprimé ne passe par t() ===')

/**
 * **Ce qu'on cherche est une traduction, pas une insertion.**
 *
 * Le premier jet refusait toute apparition du champ dans un appel à `t()` — et
 * il a refusé l'implémentation correcte. Écrire
 * `t('ent.assujettiNon', { mention: profil.mentionNonAssujetti })` est
 * précisément ce qu'il faut faire : **la phrase autour est traduite, la mention
 * y est insérée mot pour mot.** C'est le seul moyen de dire « Aucune TVA n'est
 * facturée. La mention « … » est imprimée » dans les deux langues sans toucher
 * à la mention.
 *
 * Le contournement à empêcher est autre : passer le champ **en position de
 * clé**, `t(profil.nomTaxe)`, ce qui chercherait une traduction de la valeur
 * elle-même. On ne regarde donc que ce qui précède la première virgule.
 */
const sources = ['src/renderer/src/pages/Parametres.tsx', 'src/main/domaines/documents.ts']
for (const champ of CHAMPS_DOCUMENT) {
  const coupables = sources.filter((f) => new RegExp(`t\\(\\s*[^,)]*\\b${champ}\\b`).test(lire(f)))
  verifier(
    `${champ} n’est jamais passé à t()`,
    coupables.length === 0,
    coupables.join(', ')
  )
}

console.log('\n=== Chaque mention légale est dans la langue de son pays ===')

/**
 * **Le contrôle porte sur ce qui trahit une traduction, pas sur la langue.**
 * Reconnaître l'allemand demanderait un dictionnaire ; constater qu'une mention
 * allemande s'est mise à contenir du français est à la fois plus simple et plus
 * utile. On surveille donc les tournures françaises courantes dans les mentions
 * des pays non francophones.
 */
// **On découpe par pays avant de lire.** Une expression qui balaie tout le
// fichier saute d'un pays à l'autre, et les mentions écrites entre guillemets
// doubles échappaient au motif : trois pays sur cinq étaient relevés, et les
// deux manquants passaient pour conformes sans être regardés. Un contrôle qui
// mord sur une partie de ce qu'il examine inspire exactement la même confiance
// qu'un contrôle complet.
const MENTIONS = []
for (const trouve of pays.matchAll(/^ {4}code: '(\w+)',$/gm)) {
  const debut = trouve.index
  const suivant = pays.indexOf("\n    code: '", debut + 1)
  const bloc = pays.slice(debut, suivant === -1 ? pays.length : suivant)
  const mention = bloc.match(/mentionNonAssujetti:\s*(?:\n\s*)?(['"])(.+?)\1/)
  if (mention) MENTIONS.push({ code: trouve[1], mention: mention[2] })
}

verifier(
  'on relève bien une mention par pays',
  MENTIONS.length === 5,
  MENTIONS.map((m) => m.code).join(', ')
)

const FRANCOPHONES = ['CH', 'FR', 'BE', 'LU']
const TOURNURES_FRANCAISES = [' de la ', ' des ', ' du ', ' non applicable', 'régime', 'entreprises']

for (const { code, mention } of MENTIONS) {
  if (FRANCOPHONES.includes(code)) continue
  const trouvees = TOURNURES_FRANCAISES.filter((mot) => mention.toLowerCase().includes(mot))
  verifier(
    `la mention de ${code} ne contient pas de français`,
    trouvees.length === 0,
    trouvees.length > 0
      ? `« ${mention} » — contient ${trouvees.map((m) => `« ${m.trim()} »`).join(', ')}. ` +
        `Cette phrase est imprimée sur une facture ${code} et lue par son administration fiscale.`
      : ''
  )
}

console.log('\n=== Chaque pays a sa version d’écran ===')

const codes = [...pays.matchAll(/^\s{4}code: '(\w+)',$/gm)].map((t) => t[1])
const anglais = (pays.match(/^\s{4}anglais: \{$/gm) ?? []).length
verifier(
  'autant de blocs anglais que de pays',
  codes.length > 0 && codes.length === anglais,
  `${codes.length} pays (${codes.join(', ')}) · ${anglais} bloc(s) anglais`
)

// Un libellé de taux oublié laisserait « Taux normal » au milieu d'un écran
// anglais — le genre de détail qui trahit une traduction à moitié.
const nbTaux = (pays.match(/libelle: '/g) ?? []).length
const nbTraduits = [...pays.matchAll(/libellesTaux: \[([^\]]*)\]/g)].reduce(
  (total, t) => total + t[1].split(',').filter((x) => x.trim()).length,
  0
)
verifier(
  'chaque taux a son libellé anglais',
  nbTaux > 0 && nbTaux === nbTraduits,
  `${nbTaux} taux · ${nbTraduits} libellé(s) anglais`
)

console.log(
  echecs === 0
    ? '\nPAYS ET DOCUMENTS : la frontière écran / document tient'
    : `\n${echecs} PROBLÈME(S)`
)
process.exitCode = echecs === 0 ? 0 : 1
