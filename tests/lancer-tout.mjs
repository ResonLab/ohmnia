import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Lance toutes les vérifications automatiques du projet.
 * Sortie 0 si tout passe, 1 sinon — utilisable avant chaque publication.
 */
const DOSSIER = dirname(fileURLToPath(import.meta.url))

const SUITES = [
  ['Cohérence des canaux IPC', 'coherence-ipc.cjs'],
  ['Audit statique (sécurité, SQL, sauvegardes)', 'audit-securite.mjs'],
  ['Analyseurs de relevés bancaires', 'parseurs-bancaires.mjs'],
  ['Chiffrement des sauvegardes externes', 'chiffrement.mjs'],
  ['Checkpoint WAL avant sauvegarde', 'sauvegarde-wal.cjs'],
  ['Contraintes inventaire non bloquantes', 'contraintes-inventaire.cjs'],
  ['Cohérence de la documentation', 'coherence-documentation.mjs'],
  ['Cohérence du site vitrine', 'coherence-site.mjs'],
  ['Cohérence du guide', 'coherence-guide.mjs'],
  ['Relances à envoyer', 'relances.mjs'],
  // Celle-ci exécute la requête sur une vraie base, là où la précédente éprouve
  // la règle sans base. Les deux sont nécessaires : la seconde a laissé passer
  // pendant des jours une colonne qui n'existait pas.
  ['Annulation de rappel, sur une vraie base', 'rappels-annulation.mjs'],
  ['Traductions', 'traductions.mjs'],
  ['Pays, écran et documents', 'pays-et-documents.mjs'],
  ['Ce qui existe est-il atteignable', 'atteignable.mjs'],
  ['Effets React et leurs dépendances', 'effets-react.mjs'],
  ['Serveur multi-postes (étape 1)', 'serveur-multipostes.mjs'],
  ['Comptes, droits et authentification (étape 2)', 'serveur-authentification.mjs'],
  ['Le poste en mode serveur (étape 3)', 'poste-mode-serveur.mjs'],
  ['Lancement du serveur en ligne de commande', 'serveur-lancement.mjs']
]

let echecs = 0

for (const [intitule, fichier] of SUITES) {
  process.stdout.write(`\n──────── ${intitule}\n`)
  try {
    const sortie = execFileSync(process.execPath, [join(DOSSIER, fichier)], { encoding: 'utf-8' })
    // On n'affiche que le verdict, pas tout le détail.
    const lignes = sortie.trim().split('\n')
    console.log(`  ${lignes[lignes.length - 1]}`)
  } catch (erreur) {
    echecs += 1
    console.log(erreur.stdout ?? String(erreur))
    console.log('  ÉCHEC')
  }
}

console.log(
  `\n════════ ${echecs === 0 ? 'TOUTES LES VÉRIFICATIONS PASSENT' : `${echecs} SUITE(S) EN ÉCHEC`}`
)
process.exit(echecs === 0 ? 0 : 1)
