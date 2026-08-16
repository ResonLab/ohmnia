import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Ce qui existe dans le code sans être atteignable à l'écran.
 *
 * **C'est la panne la moins soupçonnée de toute la maison**, et elle est
 * arrivée trois fois : `appliquerRepartition` de Lumika, écrite, exposée par le
 * pont, et qu'aucun bouton n'appelait ; l'écran des conditions de Scenika, dont
 * le garde-fou fonctionnait parfaitement derrière un CSS manquant qui empêchait
 * de défiler ; et le logo d'Acustika, jamais écrit alors que l'en-tête lui
 * gardait une place. Aucune relecture ne voit ces cas-là : le code est correct,
 * les suites sont vertes, et la fonction n'existe pas pour l'utilisateur.
 *
 * Ce contrôle cherche donc **le contraire de ce qui manque** : ce qui est là et
 * qu'on ne peut pas atteindre.
 *
 * 1. une opération du pont que personne n'appelle ;
 * 2. une fonction exportée d'un module commun que personne n'importe ;
 * 3. une classe CSS employée dans le code et qui n'a **aucune règle** — le cas
 *    Scenika, le plus grave, parce que l'élément existe et ne se voit pas ;
 * 4. une règle CSS dont plus aucune classe ne porte le nom — moins grave, mais
 *    c'est la trace d'un morceau d'interface retiré à moitié.
 *
 * **Ce qu'il ne voit pas, et il faut le savoir pour ne pas lui faire confiance
 * au-delà.** Il constate qu'une opération est *appelée quelque part dans un
 * écran*, pas qu'un geste de l'utilisateur mène jusqu'à cet appel. Vérifié en
 * retirant le bouton « Modifier » du Parc de Scenika : l'appel restait dans la
 * fonction d'enregistrement, plus rien ne pouvait l'atteindre, et le contrôle
 * passait au vert. Seul le retrait de l'appel lui-même le fait échouer.
 *
 * Autrement dit il attrape le mécanisme **jamais branché** — le cas
 * `appliquerRepartition`, celui pour lequel il existe — et pas la branche morte
 * derrière un bouton disparu. Voir cela demanderait de suivre les états d'un
 * composant, c'est-à-dire de l'exécuter. **C'est le lancement de l'application
 * qui couvre ce second cas, et rien d'autre.**
 */

const PROJET = join(dirname(fileURLToPath(import.meta.url)), '..')

let echecs = 0
function verifier(intitule, condition, detail = '') {
  if (!condition) echecs += 1
  console.log(`  ${condition ? 'OK  ' : 'ECHEC'} ${intitule}`)
  if (!condition && detail) console.log(`        ${detail}`)
}

/** Tous les fichiers d'un dossier, récursivement, filtrés par extension. */
function fichiers(dossier, extensions) {
  const trouves = []
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin, extensions))
    else if (extensions.some((e) => entree.endsWith(e))) trouves.push(chemin)
  }
  return trouves
}

/**
 * Le code que l'utilisateur peut atteindre : les écrans et leurs composants.
 *
 * **Le pont et le processus principal en sont exclus exprès.** Une opération
 * appelée uniquement par le pont qui la déclare n'est atteignable par personne :
 * c'est précisément ce qu'on cherche.
 */
const SOURCES_ECRAN = fichiers(join(PROJET, 'src/renderer'), ['.tsx', '.ts'])
const codeEcran = SOURCES_ECRAN.map((f) => readFileSync(f, 'utf8')).join('\n')

/** Le texte est nettoyé de ses commentaires : un appel cité en exemple n'en est pas un. */
function sansCommentaires(texte) {
  return texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const codeEcranVif = sansCommentaires(codeEcran)

/**
 * Le même code, avec les appels en chaîne recollés.
 *
 * **Un appel coupé par le formateur est un appel quand même.** `Accueil.tsx`
 * écrit `window.api.tableauDeBord` puis `.charger(…)` sur la ligne suivante :
 * cherché d'un seul tenant, `api.tableauDeBord.charger` reste introuvable et le
 * contrôle accuse à tort une opération d'être hors d'atteinte. C'est le même
 * piège que le canal IPC qui doit tenir sur la ligne d'`ipcMain.handle(` dans
 * Ohmnia — sauf qu'ici c'est la vérification qui doit s'adapter, pas le code.
 */
const codeEcranRecolle = codeEcranVif.replace(/\s*\.\s*/g, '.')

console.log('\n── Les opérations du pont ──')

// Le pont déclare `domaine: { operation: ... }`. On relève les deux niveaux
// pour pouvoir chercher `api.domaine.operation` dans les écrans.
const preload = sansCommentaires(readFileSync(join(PROJET, 'src/preload/index.ts'), 'utf8'))
const corpsApi = preload.slice(preload.indexOf('const api = {'))
const operations = []
let domaineCourant = null
for (const ligne of corpsApi.split('\n')) {
  const domaine = ligne.match(/^ {2}(\w+): \{/)
  if (domaine) domaineCourant = domaine[1]
  const operation = ligne.match(/^ {4}(\w+):/)
  if (operation && domaineCourant) operations.push(`${domaineCourant}.${operation[1]}`)
}

verifier(
  'le pont expose des opérations, et on sait les lire',
  operations.length > 0,
  `${operations.length} opération(s) relevée(s)`
)

/**
 * Les opérations qu'aucun écran n'appelle **et dont on a décidé qu'il en soit
 * ainsi**.
 *
 * **Ce n'est pas une exemption de commodité, c'est le motif d'`ECRANS_TRADUITS`.**
 * Un chantier à moitié fait doit se dire au lieu de se taire : la liste nomme ce
 * qui est connu et pourquoi, le compte s'affiche à chaque exécution, et toute
 * opération **nouvelle** hors d'atteinte fait échouer la suite. Ce qui est ici
 * a été examiné ; ce qui n'y est pas ne l'a pas été.
 *
 * *La liste s'appelait `EN_ATTENTE_DE_DECISION`, et les deux décisions ont été
 * prises le 16 août 2026.* Garder ce nom aurait annoncé du travail en suspens
 * là où il n'y en a plus — la forme la moins soupçonnée de documentation qui
 * dérive, et celle qui pousse à refaire ce qui est fait.
 *
 * **La liste est vide, et c'est le bon état.** Elle doit le rester : une
 * opération qu'on y ajoute est une décision qu'on remet à plus tard, et le
 * compte s'affiche à chaque exécution pour qu'on ne l'oublie pas.
 *
 * `journal:modifier` en est sorti le 16 août 2026, non pas branché mais
 * **retiré de bout en bout** — domaine, IPC, pont, registre du serveur et table
 * des droits. La décision était « il reste fermé » ; le laisser publié sur le
 * serveur pendant qu'aucun écran ne l'appelait aurait été une porte condamnée
 * d'un seul côté, puisqu'une opération du registre est appelable par le réseau
 * sans passer par le moindre écran.
 *
 * `rappels:supprimer` en est sorti le 16 août 2026, branché dans la
 * Facturation. **Le motif qui le retenait était faux** : il disait que la
 * suppression laissait les frais sur la facture. Les frais ne sont jamais
 * écrits dans `facture_lignes` — ils vivent sur la ligne `rappels` et ne
 * deviennent une ligne de document que dans `construireDonneesRappel`, qui les
 * relit par l'id du rappel. Effacer la ligne les efface partout. *Une réserve
 * écrite n'est pas une mesure : celle-ci a survécu à deux relectures et n'a
 * coûté qu'un `grep` à réfuter.*
 */
const HORS_DATTEINTE_ASSUME = []

const pontOrphelin = operations
  .filter((op) => !codeEcranRecolle.includes(`api.${op}`))
  .filter((op) => !HORS_DATTEINTE_ASSUME.includes(op))

// Une opération de la liste qui se retrouve branchée doit en sortir : l'y
// laisser ferait croire qu'elle est encore fermée alors qu'un écran l'appelle.
// Même règle que pour une clé de traduction déclarée et jamais employée — et il
// a mordu pour de vrai le 16 août, sur `rappels.supprimer`.
const assumesEtBranches = HORS_DATTEINTE_ASSUME.filter((op) =>
  codeEcranRecolle.includes(`api.${op}`)
)
if (assumesEtBranches.length > 0) {
  verifier(
    'la liste des opérations volontairement fermées est à jour',
    false,
    `${assumesEtBranches.join(', ')} est branché(e) : à retirer de HORS_DATTEINTE_ASSUME`
  )
}
if (HORS_DATTEINTE_ASSUME.length > 0) {
  console.log(
    `  ····  ${HORS_DATTEINTE_ASSUME.length} opération(s) volontairement hors ` +
      `d’atteinte : ${HORS_DATTEINTE_ASSUME.join(', ')}`
  )
}
verifier(
  'chaque opération du pont est appelée par un écran',
  pontOrphelin.length === 0,
  pontOrphelin.length > 0
    ? `jamais appelée(s) : ${pontOrphelin.join(', ')} — exposée(s) mais hors d’atteinte`
    : `${operations.length} opération(s), toutes atteignables`
)

console.log('\n── Les modules communs ──')

const MODULES = fichiers(join(PROJET, 'src/shared'), ['.ts'])
const codeToutSaufCommun = [
  ...SOURCES_ECRAN,
  ...fichiers(join(PROJET, 'src/main'), ['.ts']),
  ...fichiers(join(PROJET, 'src/preload'), ['.ts']),
  // **Les scripts de publication sont des consommateurs comme les autres.**
  // Les oublier faisait accuser `RESUME_GUIDE` d'être mort alors que
  // `scripts/publier-guide.mjs` s'en sert pour fabriquer les pages du guide.
  ...fichiers(join(PROJET, 'scripts'), ['.mjs']),
  ...fichiers(join(PROJET, 'tests'), ['.mjs'])
]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

const communOrphelin = []
for (const module of MODULES) {
  const source = sansCommentaires(readFileSync(module, 'utf8'))
  const nom = relative(PROJET, module).replace(/\\/g, '/')
  for (const trouve of source.matchAll(/^export (?:function|const) (\w+)/gm)) {
    const symbole = trouve[1]
    // On cherche le symbole ailleurs que dans son propre fichier.
    const autres = MODULES.filter((m) => m !== module)
      .map((m) => sansCommentaires(readFileSync(m, 'utf8')))
      .join('\n')
    const employe = new RegExp(`\\b${symbole}\\b`).test(codeToutSaufCommun + '\n' + autres)
    if (!employe) communOrphelin.push(`${nom} → ${symbole}`)
  }
}

verifier(
  'chaque fonction exportée de src/shared est employée quelque part',
  communOrphelin.length === 0,
  communOrphelin.join(' · ')
)

console.log('\n── Le CSS et les classes ──')

// **Les commentaires CSS sont retirés d'abord.** Sans cela, un commentaire qui
// cite un nom de fichier — « voir Plan.tsx » — déclare une classe `.tsx` qui
// n'existe pas, et le contrôle signale un défaut inventé. Un faux échec use un
// contrôle aussi sûrement qu'un faux succès.
const css = readFileSync(join(PROJET, 'src/renderer/src/styles.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ''
)

/**
 * Les classes déclarées par une règle CSS. On garde chaque segment d'un
 * sélecteur composé : `.marque strong` déclare bien `.marque`.
 */
const classesDeclarees = new Set()

/**
 * Les classes qui paraissent **seules** au moins une fois dans un sélecteur.
 *
 * `.appareil-pastille.trad` ne déclare pas une classe `trad` autonome : elle
 * dit « une pastille, lorsqu'elle est de genre trad ». Le code écrit
 * `` className={`appareil-pastille ${appareil.genre}`} ``, où le genre vient
 * des données — aucune chaîne « trad » n'apparaît donc dans le code, et le
 * contrôle accusait la règle de ne plus servir.
 *
 * On distingue les deux par ce qui précède le point : un espace, une virgule,
 * un combinateur ou le début de la ligne annoncent une classe autonome ; une
 * lettre annonce un **qualificatif**, dont la vie suit celle de la classe qu'il
 * qualifie. Seules les autonomes sont réclamées.
 */
const classesAutonomes = new Set()
for (const trouve of css.matchAll(/(^|[\s,>+~(])\.([a-zA-Z][\w-]*)|\.([a-zA-Z][\w-]*)/gm)) {
  const autonome = trouve[2]
  const nom = autonome ?? trouve[3]
  classesDeclarees.add(nom)
  if (autonome) classesAutonomes.add(nom)
}

/**
 * Les classes employées par le code, y compris dans un ternaire.
 *
 * **Les opérandes de comparaison sont retirés avant tout.** Dans
 * `className={outil === 'main' ? 'actif' : ''}`, seule `actif` est une classe :
 * `main` est le nom d'un outil. Les relever toutes faisait accuser à tort dix
 * classes de n'avoir aucune règle — et c'est le premier jet de ce fichier qui
 * l'a fait. Un filtre trop large produit des faux échecs qu'on remarque ; il
 * fallait quand même le corriger plutôt que de lui ajouter des exceptions, une
 * exception étant la porte par laquelle il cesserait de regarder.
 */
const classesEmployees = new Set()
const prefixesEmployes = new Set()

/**
 * Un nom de classe, et rien d'autre.
 *
 * **Le filtre est le garde-fou du relevé, et il a fallu deux passes.** Un
 * gabarit `` `carte ${choisi ? 'active' : ''}` `` donnait au premier jet les
 * jetons `===`, `?`, `:` et `${appareil.id` — signalés comme des classes sans
 * règle CSS. Ce ne sont pas des classes : ce sont des morceaux d'expression.
 * Un nom de classe commence par une lettre et ne contient que des lettres, des
 * chiffres, un tiret ou un souligné ; tout le reste est du bruit, et le bruit
 * use un contrôle aussi sûrement qu'un faux succès.
 */
const estUnNomDeClasse = (jeton) => /^[a-zA-Z][\w-]*$/.test(jeton) && !jeton.endsWith('-')

/**
 * Le contenu de chaque `className=…`, accolades imbriquées comprises.
 *
 * **Un motif `\{([^}]*)\}` s'arrête au premier `}`, donc à celui du `${…}`.**
 * Sur `` className={`scene-appareil${choisi ? ' choisi' : ''}`} ``, il rendait
 * un fragment tronqué sans son accolade fermante : le gabarit n'avait plus de
 * dos, `scene-appareil` disparaissait du relevé, et la règle CSS qui la vise
 * était accusée de ne plus servir. Ce n'était pas du bruit mais **un trou** —
 * une classe employée sans règle serait passée dessous de la même façon.
 *
 * On compte donc les accolades au lieu de faire confiance à un motif.
 */
function contenusDeClassName(source) {
  const contenus = []
  const marqueur = /className=(?:"([^"]*)"|\{)/g
  let trouve
  while ((trouve = marqueur.exec(source)) !== null) {
    if (trouve[1] !== undefined) {
      contenus.push({ litteral: true, texte: trouve[1] })
      continue
    }
    let profondeur = 1
    let i = marqueur.lastIndex
    while (i < source.length && profondeur > 0) {
      if (source[i] === '{') profondeur += 1
      else if (source[i] === '}') profondeur -= 1
      i += 1
    }
    contenus.push({ litteral: false, texte: source.slice(marqueur.lastIndex, i - 1) })
    marqueur.lastIndex = i
  }
  return contenus
}

for (const trouve of contenusDeClassName(codeEcranVif)) {
  // **Les opérandes de comparaison sont retirés d'abord.** Dans
  // `className={outil === 'main' ? 'actif' : ''}`, seule `actif` est une
  // classe : `main` est le nom d'un outil. Ce retrait et le filtre ci-dessus
  // couvrent deux bruits différents, et il faut les deux — retirer celui-ci a
  // fait réapparaître cinq fausses classes d'un coup.
  const brut = trouve.texte.replace(/[!=]==?\s*['"`][^'"`]*['"`]/g, '')
  const morceaux = []

  if (trouve.litteral) {
    morceaux.push(brut)
  } else {
    // Les chaînes entre apostrophes ou guillemets, **où qu'elles soient** — y
    // compris les deux issues d'un ternaire, qui sont de vraies classes.
    for (const m of brut.matchAll(/'([^']*)'|"([^"]*)"/g)) morceaux.push(m[1] ?? m[2])
    // Les gabarits : on ne garde que le texte littéral, entre les `${…}`. Le
    // contenu des `${…}` est déjà couvert par la ligne ci-dessus quand il
    // porte des chaînes.
    for (const m of brut.matchAll(/`([^`]*)`/g)) {
      for (const litteral of m[1].split(/\$\{[^}]*\}/)) morceaux.push(litteral)
    }
  }

  for (const morceau of morceaux) {
    for (const classe of morceau.split(/\s+/)) {
      if (estUnNomDeClasse(classe)) classesEmployees.add(classe)
      // Un fragment qui se termine par un tiret est un **préfixe** : le nom
      // complet se compose à l'exécution, comme `conformite-${statut}`.
      else if (/^[a-zA-Z][\w-]*-$/.test(classe)) prefixesEmployes.add(classe)
    }
  }
}

/**
 * Les classes construites à l'exécution comptent comme portées.
 *
 * `` className={`conformite-${statut}`} `` produit `conformite-ok`,
 * `conformite-avertissement` ou `conformite-manquant` selon le résultat du
 * contrôle. Aucune de ces trois chaînes n'apparaît dans le code, et le préfixe
 * seul n'est pas une classe : sans cette règle, le contrôle accusait le préfixe
 * de n'avoir aucune règle **et** les trois règles de ne servir à personne — un
 * faux échec des deux côtés à la fois.
 *
 * On reste volontairement strict : seul un préfixe terminé par un tiret ouvre
 * ce droit, et il ne couvre que les classes déjà déclarées dans la feuille de
 * style. Une classe composée qui n'aurait aucune règle reste donc invisible ici
 * — c'est la limite du procédé, et elle est assumée : la deviner demanderait
 * d'exécuter le code.
 */
for (const prefixe of prefixesEmployes) {
  for (const declaree of classesDeclarees) {
    if (declaree.startsWith(prefixe) && declaree !== prefixe) classesEmployees.add(declaree)
  }
}

verifier(
  'on relève bien des classes des deux côtés',
  classesDeclarees.size > 5 && classesEmployees.size > 5,
  `${classesEmployees.size} employée(s), ${classesDeclarees.size} déclarée(s)`
)

// **Le cas Scenika** : une classe posée sur un élément et qui n'a aucune règle.
// L'élément existe, occupe sa place, et ne fait rien de ce qu'on croit.
const sansRegle = [...classesEmployees].filter((c) => !classesDeclarees.has(c))
verifier(
  'aucune classe employée n’est dépourvue de règle CSS',
  sansRegle.length === 0,
  sansRegle.length > 0
    ? `sans aucune règle : ${sansRegle.join(', ')} — l’élément existe et ne se voit pas`
    : ''
)

// L'autre sens : une règle qui ne s'applique plus à rien. Moins grave, mais
// c'est la trace d'un morceau d'interface retiré à moitié — comme `.pastille`
// restée après l'arrivée du logo.
const CLASSES_HORS_ECRAN = new Set([
  // Le thème et la racine, posés ailleurs que par du JSX.
  'app'
])
const sansPorteur = [...classesAutonomes].filter(
  (c) => !classesEmployees.has(c) && !CLASSES_HORS_ECRAN.has(c)
)
verifier(
  'aucune règle CSS ne vise une classe que plus personne ne porte',
  sansPorteur.length === 0,
  sansPorteur.length > 0 ? `plus portée(s) : ${sansPorteur.join(', ')}` : ''
)

console.log(
  echecs === 0
    ? '\nATTEIGNABLE : tout ce qui existe est atteignable'
    : `\n${echecs} PROBLÈME(S) D’ATTEIGNABILITÉ`
)
process.exitCode = echecs === 0 ? 0 : 1
