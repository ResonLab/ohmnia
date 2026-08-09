/**
 * Conditions d'utilisation de l'application elle-même.
 *
 * À ne pas confondre avec les conditions générales de vente, qui sont saisies
 * par l'utilisateur dans « Mon entreprise » et s'impriment sur ses factures.
 * Ici il s'agit de l'accord entre l'éditeur d'Ohmnia et la personne qui l'utilise.
 *
 * IMPORTANT : incrémenter VERSION_CONDITIONS à chaque modification du texte.
 * L'écran d'acceptation réapparaîtra alors pour que l'utilisateur relise.
 */

export const VERSION_CONDITIONS = '1.0'

/**
 * Page publique reprenant ces conditions, ouverte par le bouton « Lire sur le site »
 * de l'écran d'acceptation.
 *
 * Le texte de cette page est vérifié automatiquement contre ce fichier par
 * `tests/coherence-site.mjs` : si l'un des deux change sans l'autre,
 * `npm run verifier` échoue.
 */
export const URL_CONDITIONS = 'https://resonlab.github.io/ohmnia/conditions.html'

export interface SectionConditions {
  titre: string
  paragraphes: string[]
}

export const CONDITIONS_UTILISATION: SectionConditions[] = [
  {
    titre: "1. Ce qu'est Ohmnia",
    paragraphes: [
      "Ohmnia est un outil de gestion qui fonctionne entièrement sur votre ordinateur. Il vous aide à établir des factures et des devis, à tenir un journal de vos mouvements, à suivre un inventaire et votre temps de travail.",
      "Vos données restent sur votre machine. Elles ne sont transmises à personne, ni à l'éditeur, ni à un service tiers. Le seul accès réseau possible est la vérification de mise à jour, désactivée par défaut."
    ]
  },
  {
    titre: '2. Ohmnia ne vous rend pas conforme',
    paragraphes: [
      "C'est le point le plus important de ce document. Utiliser Ohmnia ne signifie pas que votre comptabilité, vos factures ou vos déclarations sont conformes aux règles qui s'appliquent à vous.",
      "Les taux de taxe, seuils, formats d'identifiant et mentions légales proposés par l'application sont des points de départ. Ils évoluent, varient selon l'activité et le pays, et peuvent être obsolètes au moment où vous les utilisez.",
      "Le panneau « Conformité » est une liste de contrôle automatique, pas une certification. Il vérifie ce qu'un logiciel peut vérifier — la présence de certaines mentions, la continuité de la numérotation — et rien de plus.",
      "La responsabilité de vos obligations légales, fiscales et comptables reste entièrement la vôtre. En cas de doute, adressez-vous à un fiduciaire, un comptable ou à votre administration fiscale."
    ]
  },
  {
    titre: '3. Vos données et vos sauvegardes',
    paragraphes: [
      "L'application crée des sauvegardes automatiques locales, et vous propose une sauvegarde chiffrée vers un support externe. Ces mécanismes ne remplacent pas votre propre organisation.",
      "Une panne de disque, un vol, un incendie ou une erreur de manipulation peuvent détruire vos données. Conservez au moins une copie hors de votre ordinateur, et vérifiez de temps en temps qu'elle est lisible.",
      "Le mot de passe des sauvegardes chiffrées n'est stocké nulle part. S'il est perdu, la sauvegarde est définitivement illisible : personne, y compris l'éditeur, ne peut la récupérer."
    ]
  },
  {
    titre: '4. Absence de garantie',
    paragraphes: [
      "Ohmnia est fourni tel quel, sans garantie de fonctionnement ininterrompu ni d'absence d'erreur. Un logiciel peut contenir des défauts, y compris dans des calculs.",
      "Vérifiez vos documents avant de les envoyer à un client et vos chiffres avant toute déclaration. Ne vous reposez pas aveuglément sur un total affiché."
    ]
  },
  {
    titre: '5. Limitation de responsabilité',
    paragraphes: [
      "Dans les limites permises par la loi, l'éditeur ne répond pas des dommages découlant de l'utilisation de l'application : perte de données, perte d'exploitation, manque à gagner, redressement fiscal ou litige avec un client.",
      "Cette limitation ne s'applique pas en cas de faute grave ou intentionnelle, ni dans les situations où la loi impose une responsabilité qui ne peut être écartée. Selon votre pays, certaines de ces exclusions peuvent être sans effet à votre égard."
    ]
  },
  {
    titre: '6. Mises à jour',
    paragraphes: [
      "Les mises à jour automatiques sont désactivées tant que vous n'avez pas indiqué de source. Si vous les activez, l'application contacte l'adresse que vous avez configurée pour comparer les numéros de version.",
      "Une mise à jour peut modifier le fonctionnement de l'application. Une sauvegarde de votre base est effectuée automatiquement avant chaque installation."
    ]
  },
  {
    titre: '7. Acceptation',
    paragraphes: [
      "En utilisant Ohmnia, vous reconnaissez avoir lu ces conditions et accepté que la conformité de votre activité relève de votre seule responsabilité.",
      "Si vous n'acceptez pas ces conditions, n'utilisez pas l'application."
    ]
  }
]

/** Version courte affichée en pied d'écran d'acceptation. */
export const RESUME_CONDITIONS =
  "En résumé : vos données restent chez vous, mais l'application ne garantit pas votre conformité légale et fiscale — cette responsabilité reste la vôtre."
