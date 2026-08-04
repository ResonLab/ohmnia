-- Schema initial de l'application de gestion.
-- Les tables "parametres_*" et "entreprise" sont des singletons (id = 1 toujours).

CREATE TABLE IF NOT EXISTS entreprise (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  nom TEXT NOT NULL DEFAULT '',
  adresse TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telephone TEXT NOT NULL DEFAULT '',
  iban TEXT NOT NULL DEFAULT '',
  titulaire_compte TEXT NOT NULL DEFAULT '',
  tva_defaut_pct REAL NOT NULL DEFAULT 0,
  logo_path TEXT,
  prefixe_facture TEXT NOT NULL DEFAULT 'F',
  prefixe_devis TEXT NOT NULL DEFAULT 'D',
  -- Assujettissement TVA : tant qu'il vaut 0, aucun montant de TVA n'est
  -- facturé et les documents portent la mention légale correspondante.
  assujetti_tva INTEGER NOT NULL DEFAULT 0,
  numero_ide TEXT NOT NULL DEFAULT '',
  conditions_generales TEXT NOT NULL DEFAULT '',
  mentions_pied TEXT NOT NULL DEFAULT '',
  pays TEXT NOT NULL DEFAULT 'CH'
);

CREATE TABLE IF NOT EXISTS parametres_marge (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  heures_facturables_mois REAL NOT NULL DEFAULT 0,
  ca_estime_mensuel REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS parametres_deplacement (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  conso_l_100km REAL NOT NULL DEFAULT 0,
  prix_essence REAL NOT NULL DEFAULT 0,
  entretien_km REAL NOT NULL DEFAULT 0,
  marge_livraison_pct REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS parametres_impression (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  prix_sachet_a4 REAL NOT NULL DEFAULT 0,
  feuilles_par_sachet INTEGER NOT NULL DEFAULT 0,
  feuilles_par_facture INTEGER NOT NULL DEFAULT 1,
  prix_imprimante REAL NOT NULL DEFAULT 0,
  nb_factures_avant_remplacement INTEGER NOT NULL DEFAULT 0,
  prix_encre REAL NOT NULL DEFAULT 0,
  feuilles_par_cartouche INTEGER NOT NULL DEFAULT 0,
  prix_timbre REAL NOT NULL DEFAULT 0,
  prix_sachet_enveloppes REAL NOT NULL DEFAULT 0,
  nb_enveloppes_par_sachet INTEGER NOT NULL DEFAULT 0,
  marge_impression_pct REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS charges_fixes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  libelle TEXT NOT NULL,
  montant_mensuel REAL NOT NULL DEFAULT 0,
  categorie TEXT NOT NULL DEFAULT 'Divers',
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tarifs_produits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  designation TEXT NOT NULL,
  prix_achat REAL NOT NULL DEFAULT 0,
  marge_pct REAL,
  -- Référence libre, volontairement SANS clé étrangère : on doit pouvoir saisir
  -- un tarif pour un article qui n'est pas (encore) dans l'inventaire.
  reference_inventaire TEXT
);

CREATE TABLE IF NOT EXISTS tarifs_main_oeuvre (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  heures REAL NOT NULL DEFAULT 0,
  taux_horaire REAL
);

CREATE TABLE IF NOT EXISTS tarifs_deplacement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  distance_km REAL NOT NULL DEFAULT 0,
  prix_km REAL
);

CREATE TABLE IF NOT EXISTS categories_journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  libelle TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  adresse TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telephone TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS factures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  delai_paiement_jours INTEGER NOT NULL DEFAULT 30,
  remise_pct REAL NOT NULL DEFAULT 0,
  impression_incluse INTEGER NOT NULL DEFAULT 0,
  tva_pct REAL NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'En attente' CHECK (statut IN ('Payée', 'En attente', 'Annulée')),
  notes_internes TEXT NOT NULL DEFAULT '',
  stock_deduit INTEGER NOT NULL DEFAULT 0,
  -- Devis dont cette facture est issue (conversion Devis → Facture).
  devis_origine_id INTEGER
);

CREATE TABLE IF NOT EXISTS facture_lignes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facture_id INTEGER NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  -- Référence libre, volontairement SANS clé étrangère : facturer un article
  -- absent de l'inventaire doit rester possible (simple avertissement au moment
  -- de la déduction du stock, jamais un blocage de la vente).
  reference_inventaire TEXT,
  quantite REAL NOT NULL DEFAULT 1,
  prix_unitaire REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS devis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  validite_jours INTEGER NOT NULL DEFAULT 30,
  remise_pct REAL NOT NULL DEFAULT 0,
  tva_pct REAL NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'En attente' CHECK (statut IN ('Accepté', 'En attente', 'Refusé'))
);

CREATE TABLE IF NOT EXISTS devis_lignes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  devis_id INTEGER NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  quantite REAL NOT NULL DEFAULT 1,
  prix_unitaire REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventaire (
  reference TEXT PRIMARY KEY,
  designation TEXT NOT NULL,
  categorie TEXT NOT NULL DEFAULT '',
  quantite_stock REAL NOT NULL DEFAULT 0,
  seuil_alerte REAL NOT NULL DEFAULT 0,
  prix_achat_unitaire REAL NOT NULL DEFAULT 0,
  prix_vente_unitaire REAL NOT NULL DEFAULT 0,
  fournisseur TEXT NOT NULL DEFAULT '',
  emplacement TEXT NOT NULL DEFAULT '',
  derniere_maj TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Entrée', 'Dépense')),
  categorie_id INTEGER REFERENCES categories_journal(id),
  description TEXT NOT NULL DEFAULT '',
  montant REAL NOT NULL DEFAULT 0,
  numero_facture TEXT REFERENCES factures(numero),
  notes TEXT NOT NULL DEFAULT '',
  tva_pct REAL
);

-- Réglages de l'application elle-même (distincts des infos de l'entreprise).
CREATE TABLE IF NOT EXISTS parametres_app (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  dossier_documents TEXT,
  dossier_sauvegarde_externe TEXT,
  url_maj TEXT,
  maj_auto INTEGER NOT NULL DEFAULT 0,
  maj_source TEXT NOT NULL DEFAULT 'github',
  maj_depot TEXT NOT NULL DEFAULT '',
  langue TEXT NOT NULL DEFAULT 'fr',
  cgu_version TEXT NOT NULL DEFAULT '',
  cgu_acceptee_le TEXT NOT NULL DEFAULT '',
  nb_sauvegardes INTEGER NOT NULL DEFAULT 20,
  theme TEXT NOT NULL DEFAULT 'sombre' CHECK (theme IN ('sombre', 'clair', 'auto')),
  couleur_accent TEXT NOT NULL DEFAULT '#1be7b6',
  delai_paiement_defaut INTEGER NOT NULL DEFAULT 30,
  validite_devis_defaut INTEGER NOT NULL DEFAULT 30,
  seuil_alerte_facture_jours INTEGER NOT NULL DEFAULT 30
);

-- Objectif de chiffre d'affaires saisi par l'utilisateur, une ligne par année.
CREATE TABLE IF NOT EXISTS objectifs_annuels (
  annee INTEGER PRIMARY KEY,
  objectif_ca REAL NOT NULL DEFAULT 0
);

-- Modèles de prestations : paniers de lignes réutilisables.
CREATE TABLE IF NOT EXISTS modeles_prestations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS modele_lignes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  modele_id INTEGER NOT NULL REFERENCES modeles_prestations(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  reference_inventaire TEXT,
  quantite REAL NOT NULL DEFAULT 1,
  prix_unitaire REAL NOT NULL DEFAULT 0
);

-- Suivi du temps : une ligne par intervention chronométrée.
CREATE TABLE IF NOT EXISTS suivi_temps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL DEFAULT '',
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  debut TEXT NOT NULL,
  fin TEXT,
  secondes_ecoulees INTEGER NOT NULL DEFAULT 0,
  facture_id INTEGER REFERENCES factures(id) ON DELETE SET NULL,
  taux_horaire REAL
);

-- Justificatifs (photos/scans) rattachés aux écritures du Journal.
CREATE TABLE IF NOT EXISTS justificatifs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_id INTEGER NOT NULL REFERENCES journal(id) ON DELETE CASCADE,
  nom_fichier TEXT NOT NULL,
  ajoute_le TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Rappels de paiement émis pour une facture.
CREATE TABLE IF NOT EXISTS rappels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facture_id INTEGER NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  niveau INTEGER NOT NULL,
  date TEXT NOT NULL,
  frais REAL NOT NULL DEFAULT 0
);

-- Journal d'audit : trace des créations/modifications/suppressions.
CREATE TABLE IF NOT EXISTS journal_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  horodatage TEXT NOT NULL DEFAULT (datetime('now')),
  action TEXT NOT NULL,
  entite TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT ''
);

-- Exercices comptables clôturés : plus aucune écriture modifiable sur ces années.
CREATE TABLE IF NOT EXISTS exercices_clotures (
  annee INTEGER PRIMARY KEY,
  cloture_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_journal_date ON journal(date);
CREATE INDEX IF NOT EXISTS idx_audit_horodatage ON journal_audit(horodatage);
CREATE INDEX IF NOT EXISTS idx_justificatifs_journal ON justificatifs(journal_id);
CREATE INDEX IF NOT EXISTS idx_rappels_facture ON rappels(facture_id);
CREATE INDEX IF NOT EXISTS idx_modele_lignes_modele ON modele_lignes(modele_id);
CREATE INDEX IF NOT EXISTS idx_journal_numero_facture ON journal(numero_facture);
CREATE INDEX IF NOT EXISTS idx_facture_lignes_facture_id ON facture_lignes(facture_id);
CREATE INDEX IF NOT EXISTS idx_devis_lignes_devis_id ON devis_lignes(devis_id);

INSERT OR IGNORE INTO entreprise (id) VALUES (1);
INSERT OR IGNORE INTO parametres_marge (id) VALUES (1);
INSERT OR IGNORE INTO parametres_deplacement (id) VALUES (1);
INSERT OR IGNORE INTO parametres_impression (id) VALUES (1);
INSERT OR IGNORE INTO parametres_app (id) VALUES (1);

INSERT OR IGNORE INTO categories_journal (libelle) VALUES
  ('Matériel'), ('Main d''œuvre'), ('Déplacement/Essence'), ('Loyer'),
  ('Assurance'), ('Facture client'), ('Autre');
