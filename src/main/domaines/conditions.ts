import { getDb } from '../db/database'
import { tracerAudit } from '../db/audit'
import { URL_CONDITIONS, VERSION_CONDITIONS } from '../../shared/conditions'

/**
 * Acceptation des conditions d'utilisation — la partie qui ne dépend pas d'Electron.
 *
 * L'écran d'acceptation réapparaît si la version des conditions change :
 * accepter une ancienne version ne vaut pas acceptation de la nouvelle.
 *
 * Ce qui reste dans `../ipc/conditions.ts` : l'ouverture de la page dans le
 * navigateur du poste, qui n'a aucun sens sur un serveur.
 */

export interface EtatConditions {
  versionCourante: string
  versionAcceptee: string
  accepteeLe: string
  doitAccepter: boolean
}

export function etatConditions(): EtatConditions {
  const ligne = getDb()
    .prepare('SELECT cgu_version, cgu_acceptee_le FROM parametres_app WHERE id = 1')
    .get() as { cgu_version: string; cgu_acceptee_le: string } | undefined

  const versionAcceptee = ligne?.cgu_version ?? ''
  return {
    versionCourante: VERSION_CONDITIONS,
    versionAcceptee,
    accepteeLe: ligne?.cgu_acceptee_le ?? '',
    doitAccepter: versionAcceptee !== VERSION_CONDITIONS
  }
}

export function accepterConditions(): string {
  getDb()
    .prepare("UPDATE parametres_app SET cgu_version = ?, cgu_acceptee_le = datetime('now') WHERE id = 1")
    .run(VERSION_CONDITIONS)

  tracerAudit('acceptation', 'conditions', VERSION_CONDITIONS, "Conditions d'utilisation acceptées")
  return VERSION_CONDITIONS
}

export function urlConditions(): string {
  return URL_CONDITIONS
}
