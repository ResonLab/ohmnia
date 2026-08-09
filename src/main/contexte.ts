import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Où vivent les données, et quelle version de l'application tourne.
 *
 * Ces deux informations venaient d'Electron (`app.getPath`, `app.getVersion`),
 * ce qui obligeait toute la couche base de données à importer Electron. Un
 * serveur — qui n'a pas de fenêtre ni d'Electron — ne pouvait donc rien
 * réutiliser.
 *
 * Désormais la couche Electron renseigne ce contexte au démarrage, une fois,
 * et le reste du code n'en dépend plus. Le serveur multi-postes fera la même
 * chose avec ses propres valeurs.
 *
 * Le comportement de l'application ne change pas : ce sont exactement les
 * mêmes chemins qu'avant.
 */
interface Contexte {
  /** Dossier des données de l'utilisateur (`%APPDATA%\Ohmnia` sous Windows). */
  dossierDonnees: string
  /** Version affichée dans les exports et les journaux. */
  version: string
}

let contexte: Contexte | null = null

export function definirContexte(valeurs: Contexte): void {
  contexte = valeurs
}

function lireContexte(): Contexte {
  if (!contexte) {
    throw new Error(
      "Le contexte d'exécution n'a pas été défini. " +
        'Appelez definirContexte() avant toute lecture de la base.'
    )
  }
  return contexte
}

export function dossierDonnees(): string {
  return lireContexte().dossierDonnees
}

export function versionApplication(): string {
  return lireContexte().version
}

/** Fichier de la base de données. Un seul endroit décide de son nom. */
export function cheminBase(): string {
  return join(dossierDonnees(), 'gestion.sqlite')
}

/** Dossier des sauvegardes locales, créé au besoin. */
export function dossierSauvegardes(): string {
  const dossier = join(dossierDonnees(), 'Backups')
  if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true })
  return dossier
}
