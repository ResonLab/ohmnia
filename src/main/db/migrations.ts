import type { DatabaseSync } from 'node:sqlite'

/**
 * Migrations non destructives.
 *
 * `schema.sql` crée les tables manquantes (CREATE TABLE IF NOT EXISTS), mais il
 * ne peut pas ajouter une colonne à une table qui existe déjà chez un utilisateur.
 * Ce module s'en charge : pour chaque colonne attendue, on l'ajoute seulement si
 * elle est absente. Aucune donnée n'est jamais supprimée.
 *
 * Pour ajouter une colonne plus tard : l'écrire dans schema.sql (pour les
 * nouvelles installations) ET l'ajouter ici (pour les installations existantes).
 */

interface ColonneAttendue {
  table: string
  colonne: string
  definition: string
}

const COLONNES_ATTENDUES: ColonneAttendue[] = [
  { table: 'factures', colonne: 'stock_deduit', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'tarifs_main_oeuvre', colonne: 'heures', definition: 'REAL NOT NULL DEFAULT 0' },
  { table: 'tarifs_deplacement', colonne: 'distance_km', definition: 'REAL NOT NULL DEFAULT 0' },
  { table: 'parametres_app', colonne: 'dossier_sauvegarde_externe', definition: 'TEXT' },
  // Adresse de publication des mises à jour (vide = aucune vérification réseau).
  { table: 'parametres_app', colonne: 'url_maj', definition: 'TEXT' },
  { table: 'parametres_app', colonne: 'maj_auto', definition: 'INTEGER NOT NULL DEFAULT 0' },
  // Source des mises à jour : 'github' (dépôt public) ou 'url' (dossier/serveur).
  { table: 'parametres_app', colonne: 'maj_source', definition: "TEXT NOT NULL DEFAULT 'github'" },
  { table: 'parametres_app', colonne: 'maj_depot', definition: "TEXT NOT NULL DEFAULT ''" },
  // Langue de l'interface et des documents imprimés.
  { table: 'parametres_app', colonne: 'langue', definition: "TEXT NOT NULL DEFAULT 'fr'" },
  // Conditions d'utilisation : version acceptée et date, vide tant qu'aucune acceptation.
  { table: 'parametres_app', colonne: 'cgu_version', definition: "TEXT NOT NULL DEFAULT ''" },
  { table: 'parametres_app', colonne: 'cgu_acceptee_le', definition: "TEXT NOT NULL DEFAULT ''" },
  // Trace le devis dont une facture est issue (conversion Devis → Facture).
  { table: 'factures', colonne: 'devis_origine_id', definition: 'INTEGER' },
  // Le logo rangé dans la base, et non plus seulement son chemin sur le disque :
  // un chemin ne veut rien dire depuis un autre poste.
  { table: 'entreprise', colonne: 'logo_donnees', definition: 'TEXT' },
  // Conformité suisse : assujettissement TVA, numéro IDE, mentions légales.
  { table: 'entreprise', colonne: 'assujetti_tva', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'entreprise', colonne: 'numero_ide', definition: "TEXT NOT NULL DEFAULT ''" },
  { table: 'entreprise', colonne: 'conditions_generales', definition: "TEXT NOT NULL DEFAULT ''" },
  { table: 'entreprise', colonne: 'mentions_pied', definition: "TEXT NOT NULL DEFAULT ''" },
  // Pays de l'entreprise : pilote la devise, les taux de taxe et les mentions légales.
  { table: 'entreprise', colonne: 'pays', definition: "TEXT NOT NULL DEFAULT 'CH'" }
]

function colonnesExistantes(db: DatabaseSync, table: string): Set<string> {
  try {
    const lignes = db.prepare(`PRAGMA table_info("${table}")`).all() as unknown as { name: string }[]
    return new Set(lignes.map((l) => l.name))
  } catch {
    return new Set()
  }
}

function tableExiste(db: DatabaseSync, table: string): boolean {
  const ligne = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table)
  return ligne !== undefined
}

/** Vrai si la table possède une clé étrangère partant de la colonne indiquée. */
function aUneCleEtrangere(db: DatabaseSync, table: string, colonne: string): boolean {
  try {
    const cles = db.prepare(`PRAGMA foreign_key_list("${table}")`).all() as unknown as {
      from: string
    }[]
    return cles.some((cle) => cle.from === colonne)
  } catch {
    return false
  }
}

/**
 * Reconstruit une table pour lui retirer une contrainte.
 * SQLite ne sait pas supprimer une clé étrangère par ALTER TABLE : il faut
 * recréer la table, recopier les données, puis remplacer l'ancienne.
 */
function reconstruireTable(
  db: DatabaseSync,
  table: string,
  definitionNouvelle: string,
  colonnes: string[]
): void {
  const listeColonnes = colonnes.map((c) => `"${c}"`).join(', ')
  const tableTemporaire = `${table}_migration`

  // Les clés étrangères doivent être désactivées le temps de l'échange de tables.
  db.exec('PRAGMA foreign_keys = OFF')
  db.exec('BEGIN')
  try {
    db.exec(`DROP TABLE IF EXISTS "${tableTemporaire}"`)
    db.exec(definitionNouvelle.replace(table, tableTemporaire))
    db.exec(
      `INSERT INTO "${tableTemporaire}" (${listeColonnes}) SELECT ${listeColonnes} FROM "${table}"`
    )
    db.exec(`DROP TABLE "${table}"`)
    db.exec(`ALTER TABLE "${tableTemporaire}" RENAME TO "${table}"`)
    db.exec('COMMIT')
    console.log(`Migration : contrainte retirée de ${table} (données conservées).`)
  } catch (erreur) {
    db.exec('ROLLBACK')
    throw erreur
  } finally {
    db.exec('PRAGMA foreign_keys = ON')
  }
}

/**
 * Retire les clés étrangères vers l'inventaire.
 *
 * Facturer ou tarifer un article absent de l'inventaire doit rester possible :
 * le stock manquant donne un avertissement, jamais un refus d'enregistrement.
 */
function retirerContraintesInventaire(db: DatabaseSync): void {
  if (tableExiste(db, 'facture_lignes') && aUneCleEtrangere(db, 'facture_lignes', 'reference_inventaire')) {
    reconstruireTable(
      db,
      'facture_lignes',
      `CREATE TABLE facture_lignes (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         facture_id INTEGER NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
         designation TEXT NOT NULL,
         reference_inventaire TEXT,
         quantite REAL NOT NULL DEFAULT 1,
         prix_unitaire REAL NOT NULL DEFAULT 0
       )`,
      ['id', 'facture_id', 'designation', 'reference_inventaire', 'quantite', 'prix_unitaire']
    )
    db.exec('CREATE INDEX IF NOT EXISTS idx_facture_lignes_facture_id ON facture_lignes(facture_id)')
  }

  if (tableExiste(db, 'tarifs_produits') && aUneCleEtrangere(db, 'tarifs_produits', 'reference_inventaire')) {
    reconstruireTable(
      db,
      'tarifs_produits',
      `CREATE TABLE tarifs_produits (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         designation TEXT NOT NULL,
         prix_achat REAL NOT NULL DEFAULT 0,
         marge_pct REAL,
         reference_inventaire TEXT
       )`,
      ['id', 'designation', 'prix_achat', 'marge_pct', 'reference_inventaire']
    )
  }
}

export function appliquerMigrations(db: DatabaseSync): void {
  for (const { table, colonne, definition } of COLONNES_ATTENDUES) {
    if (!tableExiste(db, table)) continue
    if (colonnesExistantes(db, table).has(colonne)) continue

    db.exec(`ALTER TABLE "${table}" ADD COLUMN "${colonne}" ${definition}`)
    console.log(`Migration : colonne ${table}.${colonne} ajoutée.`)
  }

  retirerContraintesInventaire(db)
}
