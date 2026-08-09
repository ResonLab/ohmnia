import { demarrerDepuisLaLigneDeCommande } from './demarrer'
import { VERSION_SERVEUR } from './version'

/**
 * Point d'entrée du serveur, compilé en `out/serveur/ohmnia-serveur.mjs`.
 * Il ne fait rien d'autre que passer la main : tout ce qui est vérifiable vit
 * dans `./demarrer.ts`, que les tests peuvent appeler sans lancer de serveur.
 */
demarrerDepuisLaLigneDeCommande(process.argv.slice(2), VERSION_SERVEUR)
