import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dossierDonnees } from '../contexte'

/**
 * Le mode de fonctionnement de ce poste : sa base locale, ou un serveur.
 *
 * **Le mode local est le défaut, et le reste.** C'est un principe de la maison :
 * sans choix explicite de l'utilisateur, l'application fonctionne hors ligne
 * exactement comme avant. Ce fichier n'existe même pas tant qu'il n'a rien
 * choisi.
 *
 * **Le mot de passe n'est jamais écrit ici.** Il est saisi à chaque ouverture
 * de session et ne vit qu'en mémoire. Un fichier de configuration lisible qui
 * contiendrait le mot de passe de la comptabilité serait un cadeau pour qui
 * copie le profil utilisateur.
 */

export type ModeFonctionnement = 'local' | 'serveur'

export interface ConfigurationMultipostes {
  mode: ModeFonctionnement
  /** Adresse du serveur, par exemple `http://192.168.1.20:8787`. */
  adresse: string
  /** Dernier identifiant utilisé, pour ne pas le retaper. Jamais le mot de passe. */
  dernierIdentifiant: string
  /**
   * Thème, langue et couleur d'accent **de ce poste**, utilisés seulement en
   * multi-postes.
   *
   * Ces trois réglages sont personnels : deux collègues qui partagent la même
   * base n'ont pas à partager leur thème sombre ni leur langue. Or ils vivent
   * dans `parametres_app`, avec des réglages d'entreprise réservés à
   * l'administration. Les garder côté serveur revenait à interdire à un
   * employé de passer son interface en clair.
   */
  apparence: { theme: string; langue: string; couleurAccent: string } | null
}

const PAR_DEFAUT: ConfigurationMultipostes = {
  mode: 'local',
  adresse: '',
  dernierIdentifiant: '',
  apparence: null
}

function cheminConfiguration(): string {
  return join(dossierDonnees(), 'multipostes.json')
}

export function lireConfigurationMultipostes(): ConfigurationMultipostes {
  const chemin = cheminConfiguration()
  if (!existsSync(chemin)) return { ...PAR_DEFAUT }

  try {
    const brut = JSON.parse(readFileSync(chemin, 'utf-8')) as Partial<ConfigurationMultipostes>
    return {
      mode: brut.mode === 'serveur' ? 'serveur' : 'local',
      adresse: typeof brut.adresse === 'string' ? brut.adresse : '',
      dernierIdentifiant:
        typeof brut.dernierIdentifiant === 'string' ? brut.dernierIdentifiant : '',
      apparence:
        brut.apparence && typeof brut.apparence === 'object' ? brut.apparence : null
    }
  } catch {
    // Un fichier illisible ne doit pas empêcher l'application de démarrer :
    // on repart du mode local, qui marche toujours.
    return { ...PAR_DEFAUT }
  }
}

export function ecrireConfigurationMultipostes(config: ConfigurationMultipostes): void {
  writeFileSync(cheminConfiguration(), JSON.stringify(config, null, 2), 'utf-8')
}

/** Contrôle l'adresse avant de l'enregistrer : une faute de frappe se voit ici. */
export function validerAdresse(adresse: string): string | null {
  const propre = adresse.trim()
  if (!propre) return "L'adresse du serveur est obligatoire."

  let analysee: URL
  try {
    analysee = new URL(propre)
  } catch {
    return "L'adresse doit ressembler à http://192.168.1.20:8787 (protocole compris)."
  }
  if (analysee.protocol !== 'http:' && analysee.protocol !== 'https:') {
    return "L'adresse doit commencer par http:// ou https://."
  }
  return null
}
