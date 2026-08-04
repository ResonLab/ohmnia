import { app } from 'electron'
import { join } from 'node:path'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { fermerBaseDeDonnees, getDb, ouvrirBaseDeDonnees, viderJournalWal } from './database'
import type { SauvegardeFichier } from '../../shared/types'

const NB_SAUVEGARDES_PAR_DEFAUT = 20

export function dossierSauvegardes(): string {
  const dossier = join(app.getPath('userData'), 'Backups')
  if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true })
  return dossier
}

export function cheminBase(): string {
  return join(app.getPath('userData'), 'gestion.sqlite')
}

/** Nombre de sauvegardes à conserver, lu dans les paramètres si la base est ouverte. */
function nbSauvegardesAConserver(): number {
  try {
    const ligne = getDb().prepare('SELECT nb_sauvegardes FROM parametres_app WHERE id = 1').get() as
      | { nb_sauvegardes: number }
      | undefined
    const valeur = ligne?.nb_sauvegardes ?? NB_SAUVEGARDES_PAR_DEFAUT
    // Garde-fou : au moins 1 sauvegarde, sinon la rotation effacerait tout.
    return Math.max(1, valeur)
  } catch {
    return NB_SAUVEGARDES_PAR_DEFAUT
  }
}

/**
 * Copie horodatée de la base SQLite, avec rotation.
 * Appelée au démarrage de l'app et avant tout export PDF.
 */
export function sauvegarderBaseDeDonnees(): string | null {
  const source = cheminBase()
  if (!existsSync(source)) return null

  // Sans ce checkpoint, les écritures encore dans le WAL seraient absentes de la copie.
  viderJournalWal()

  const dossier = dossierSauvegardes()
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const cheminSauvegarde = join(dossier, `gestion-${horodatage}.sqlite`)
  copyFileSync(source, cheminSauvegarde)

  const aConserver = nbSauvegardesAConserver()
  for (const ancienne of listerSauvegardes().slice(aConserver)) {
    unlinkSync(join(dossier, ancienne.nom))
  }

  return cheminSauvegarde
}

/** Sauvegardes présentes, de la plus récente à la plus ancienne. */
export function listerSauvegardes(): SauvegardeFichier[] {
  const dossier = dossierSauvegardes()
  return readdirSync(dossier)
    .filter((f) => f.endsWith('.sqlite'))
    .map((nom) => {
      const infos = statSync(join(dossier, nom))
      return { nom, dateIso: infos.mtime.toISOString(), tailleOctets: infos.size }
    })
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso))
}

/**
 * Restaure une sauvegarde. La base actuelle est d'abord sauvegardée pour que
 * l'opération reste réversible, puis la connexion est réouverte sur les données restaurées.
 */
export function restaurerSauvegarde(nomFichier: string): void {
  // Empêche toute sortie du dossier de sauvegardes via un nom de fichier forgé.
  if (nomFichier.includes('/') || nomFichier.includes('\\') || !nomFichier.endsWith('.sqlite')) {
    throw new Error('Nom de sauvegarde invalide.')
  }
  const source = join(dossierSauvegardes(), nomFichier)
  if (!existsSync(source)) throw new Error(`La sauvegarde "${nomFichier}" est introuvable.`)

  sauvegarderBaseDeDonnees()
  fermerBaseDeDonnees()

  const destination = cheminBase()
  copyFileSync(source, destination)
  // Les fichiers WAL de l'ancienne base ne correspondent plus aux données restaurées.
  for (const suffixe of ['-wal', '-shm']) {
    const annexe = destination + suffixe
    if (existsSync(annexe)) unlinkSync(annexe)
  }

  ouvrirBaseDeDonnees()
}

/** Export lisible de toutes les tables au format JSON, pour archivage hors de l'app. */
export function exporterToutesLesDonnees(cheminSortie: string): number {
  const db = getDb()
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as unknown as { name: string }[]

  const donnees: Record<string, unknown[]> = {}
  for (const { name } of tables) {
    donnees[name] = db.prepare(`SELECT * FROM "${name}"`).all() as unknown[]
  }

  const contenu = JSON.stringify(
    { application: 'Ohmnia', version: app.getVersion(), exporteLe: new Date().toISOString(), donnees },
    null,
    2
  )
  writeFileSync(cheminSortie, contenu, 'utf-8')
  return contenu.length
}
