import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { app } from 'electron'
import schema from './schema.sql?raw'
import { appliquerMigrations } from './migrations'

let db: DatabaseSync | null = null

/**
 * Ouvre (ou crée) la base SQLite dans le dossier de données utilisateur,
 * applique les réglages de fiabilité et le schéma, puis vérifie son intégrité.
 */
export function ouvrirBaseDeDonnees(): DatabaseSync {
  if (db) return db

  const cheminBase = join(app.getPath('userData'), 'gestion.sqlite')
  db = new DatabaseSync(cheminBase)

  // WAL : écritures plus robustes face à un arrêt brutal de l'app.
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  db.exec(schema)
  // Complète les bases créées par une version antérieure de l'application.
  appliquerMigrations(db)

  const resultat = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }
  if (resultat.integrity_check !== 'ok') {
    throw new Error(`Intégrité de la base compromise : ${resultat.integrity_check}`)
  }

  return db
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('La base de données n\'a pas encore été initialisée.')
  return db
}

export function fermerBaseDeDonnees(): void {
  db?.close()
  db = null
}

/**
 * Replie le journal WAL dans le fichier principal de la base.
 *
 * En mode WAL, les écritures récentes vivent dans `gestion.sqlite-wal` et pas
 * encore dans `gestion.sqlite`. Toute copie du fichier principal (sauvegarde
 * locale, sauvegarde externe chiffrée) doit donc être précédée d'un checkpoint,
 * sinon la copie serait incomplète et une restauration perdrait les dernières
 * écritures.
 */
export function viderJournalWal(): void {
  try {
    getDb().exec('PRAGMA wal_checkpoint(TRUNCATE)')
  } catch (erreur) {
    console.error('Checkpoint WAL impossible :', erreur)
  }
}

/**
 * Exécute une suite d'écritures dans une transaction : si quoi que ce soit
 * échoue, tout est annulé (jamais de facture à moitié enregistrée).
 */
export function dansUneTransaction<T>(operations: () => T): T {
  const base = getDb()
  base.exec('BEGIN')
  try {
    const resultat = operations()
    base.exec('COMMIT')
    return resultat
  } catch (erreur) {
    base.exec('ROLLBACK')
    throw erreur
  }
}
