import {
  demarrerServeur,
  type ApplicationServie,
  type OptionsServeur
} from '../../../Nexika/serveur/index'
import { definirContexte } from '../main/contexte'
import { fermerBaseDeDonnees, ouvrirBaseDeDonnees } from '../main/db/database'
import { REGISTRE } from './registre'
import { roleExige } from './droits'

/**
 * Ohmnia, telle que le serveur commun la voit.
 *
 * Tout ce qui n'est pas propre à Ohmnia — transport, comptes, sessions,
 * droits, certificat, arguments de la ligne de commande — vit dans
 * `Nexika/serveur/`, parce que Scenika s'en servira aussi. Ne sont déclarés ici
 * que les canaux d'Ohmnia, leurs droits, et sa base.
 */
export const APPLICATION_OHMNIA: ApplicationServie = {
  nom: 'Ohmnia',
  registre: REGISTRE,
  roleExige,
  ouvrirBase: (dossierDonnees, version) => {
    definirContexte({ dossierDonnees, version })
    ouvrirBaseDeDonnees()
  },
  fermerBase: fermerBaseDeDonnees
}

/** Démarre le serveur d'Ohmnia. Même signature qu'avant, sans l'application. */
export function demarrerServeurOhmnia(
  options: Omit<OptionsServeur, 'application'>
): ReturnType<typeof demarrerServeur> {
  return demarrerServeur({ ...options, application: APPLICATION_OHMNIA })
}
