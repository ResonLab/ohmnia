import { demarrerDepuisLaLigneDeCommande } from 'nexika'
import { APPLICATION_OHMNIA } from './ohmnia'
import { VERSION_SERVEUR } from './version'

/**
 * Point d'entrée du serveur d'Ohmnia, compilé en
 * `out/serveur/ohmnia-serveur.mjs`. Il ne fait que brancher Ohmnia sur le
 * serveur commun de la maison : tout ce qui est vérifiable vit ailleurs.
 */
demarrerDepuisLaLigneDeCommande(
  APPLICATION_OHMNIA,
  process.argv.slice(2),
  VERSION_SERVEUR,
  'ohmnia-serveur.mjs'
)
