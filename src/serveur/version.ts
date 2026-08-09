/**
 * Version du serveur multi-postes.
 *
 * Écrite ici plutôt que lue dans `package.json` : le serveur est compilé en un
 * seul fichier, qu'on copie sur la machine qui héberge les données, sans le
 * reste du projet. Il n'y a donc pas de `package.json` à côté.
 *
 * **Elle doit rester égale à la version du projet** : `npm test` le vérifie.
 */
export const VERSION_SERVEUR = '0.1.2'
