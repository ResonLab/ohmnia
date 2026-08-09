import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { join } from 'node:path'
import { dossierDonnees } from '../main/contexte'

/**
 * Comptes, mots de passe et sessions du serveur multi-postes.
 *
 * **Base séparée, volontairement.** Les comptes vivent dans `comptes.sqlite`,
 * pas dans `gestion.sqlite`. Deux raisons, toutes deux décidées dans
 * `../../../LISEZ-MOI.md` :
 *
 * 1. Les comptes sont **communs à Ohmnia et à Scenika**. Un seul serveur, une
 *    seule liste d'utilisateurs, mais une base métier par application.
 * 2. **Le mode local ne doit rien y gagner ni rien y perdre.** L'application
 *    hors ligne n'a pas de comptes et n'ouvre jamais ce fichier : son schéma
 *    reste exactement celui d'aujourd'hui.
 *
 * Ce que ce module ne fait pas : il ne décide pas *qui a le droit de quoi*.
 * Cela se lit d'un seul endroit, `./droits.ts`.
 */

/** Rôles, du moins au plus étendu. Chacun contient les droits du précédent. */
export type Role = 'lecture' | 'ecriture' | 'administration'

export const ROLES: Role[] = ['lecture', 'ecriture', 'administration']

const RANG: Record<Role, number> = { lecture: 0, ecriture: 1, administration: 2 }

/** Un rôle satisfait-il le rôle exigé par une opération ? */
export function roleSuffit(role: Role, exige: Role): boolean {
  return RANG[role] >= RANG[exige]
}

export interface Compte {
  id: number
  identifiant: string
  nomAffiche: string
  role: Role
  actif: boolean
}

export interface SessionOuverte {
  jeton: string
  expireLe: string
  compte: Compte
}

/** Durée de validité d'une session. Au-delà, il faut se reconnecter. */
const DUREE_SESSION_HEURES = 12

/** Au-delà de ce nombre d'échecs consécutifs, le compte est bloqué un moment. */
const ECHECS_AVANT_BLOCAGE = 5
const DUREE_BLOCAGE_MINUTES = 15

const SCHEMA_COMPTES = `
CREATE TABLE IF NOT EXISTS comptes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifiant TEXT NOT NULL UNIQUE,
  nom_affiche TEXT NOT NULL DEFAULT '',
  sel TEXT NOT NULL,
  empreinte TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'lecture',
  actif INTEGER NOT NULL DEFAULT 1,
  echecs_consecutifs INTEGER NOT NULL DEFAULT 0,
  bloque_jusqua TEXT,
  cree_le TEXT NOT NULL DEFAULT (datetime('now')),
  derniere_connexion_le TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  compte_id INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  empreinte_jeton TEXT NOT NULL UNIQUE,
  cree_le TEXT NOT NULL DEFAULT (datetime('now')),
  expire_le TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS acces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  horodatage TEXT NOT NULL DEFAULT (datetime('now')),
  identifiant TEXT NOT NULL,
  canal TEXT NOT NULL,
  resultat TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
`

let baseComptes: DatabaseSync | null = null

/** Fichier des comptes. Un seul endroit décide de son nom. */
export function cheminBaseComptes(): string {
  return join(dossierDonnees(), 'comptes.sqlite')
}

export function ouvrirBaseComptes(): DatabaseSync {
  if (baseComptes) return baseComptes

  baseComptes = new DatabaseSync(cheminBaseComptes())
  baseComptes.exec('PRAGMA journal_mode = WAL')
  baseComptes.exec('PRAGMA foreign_keys = ON')
  baseComptes.exec(SCHEMA_COMPTES)
  return baseComptes
}

export function fermerBaseComptes(): void {
  baseComptes?.close()
  baseComptes = null
}

function base(): DatabaseSync {
  if (!baseComptes) {
    throw new Error("La base des comptes n'est pas ouverte. Appelez ouvrirBaseComptes().")
  }
  return baseComptes
}

/* ── Mots de passe ────────────────────────────────────────────────────────── */

/**
 * scrypt, comme pour les sauvegardes chiffrées : volontairement coûteux, pour
 * qu'essayer un dictionnaire de mots de passe revienne cher.
 */
function calculerEmpreinte(motDePasse: string, sel: string): string {
  return scryptSync(motDePasse, sel, 64, { N: 16384, r: 8, p: 1 }).toString('hex')
}

/**
 * Comparaison à durée constante : comparer deux empreintes avec `===` laisse
 * fuir, par le temps de réponse, le nombre de caractères déjà justes.
 */
function empreintesIdentiques(a: string, b: string): boolean {
  const tampon = Buffer.from(a, 'hex')
  const autre = Buffer.from(b, 'hex')
  if (tampon.length !== autre.length) return false
  return timingSafeEqual(tampon, autre)
}

export function validerMotDePasse(motDePasse: string): string | null {
  if (motDePasse.length < 10) {
    return 'Le mot de passe doit faire au moins 10 caractères.'
  }
  if (!/[a-zA-Z]/.test(motDePasse) || !/[0-9]/.test(motDePasse)) {
    return 'Le mot de passe doit contenir au moins une lettre et un chiffre.'
  }
  return null
}

function validerIdentifiant(identifiant: string): string | null {
  const propre = identifiant.trim()
  if (propre.length < 3) return "L'identifiant doit faire au moins 3 caractères."
  if (!/^[a-zA-Z0-9._-]+$/.test(propre)) {
    return "L'identifiant ne peut contenir que des lettres, des chiffres, un point, un tiret ou un souligné."
  }
  return null
}

/* ── Comptes ──────────────────────────────────────────────────────────────── */

interface LigneCompte {
  id: number
  identifiant: string
  nom_affiche: string
  sel: string
  empreinte: string
  role: Role
  actif: number
  echecs_consecutifs: number
  bloque_jusqua: string | null
}

function versCompte(ligne: LigneCompte): Compte {
  return {
    id: ligne.id,
    identifiant: ligne.identifiant,
    nomAffiche: ligne.nom_affiche,
    role: ligne.role,
    actif: ligne.actif === 1
  }
}

export function nombreDeComptes(): number {
  const ligne = base().prepare('SELECT COUNT(*) AS n FROM comptes').get() as { n: number }
  return ligne.n
}

/** Y a-t-il au moins un administrateur actif ? Condition pour ouvrir le serveur au réseau. */
export function existeAdministrateurActif(): boolean {
  const ligne = base()
    .prepare("SELECT COUNT(*) AS n FROM comptes WHERE role = 'administration' AND actif = 1")
    .get() as { n: number }
  return ligne.n > 0
}

export function listerComptes(): Compte[] {
  const lignes = base()
    .prepare('SELECT * FROM comptes ORDER BY identifiant')
    .all() as unknown as LigneCompte[]
  return lignes.map(versCompte)
}

export function creerCompte(
  identifiant: string,
  motDePasse: string,
  role: Role,
  nomAffiche = ''
): Compte {
  const erreurIdentifiant = validerIdentifiant(identifiant)
  if (erreurIdentifiant) throw new Error(erreurIdentifiant)

  const erreurMotDePasse = validerMotDePasse(motDePasse)
  if (erreurMotDePasse) throw new Error(erreurMotDePasse)

  if (!ROLES.includes(role)) throw new Error(`Rôle inconnu : « ${role} ».`)

  const propre = identifiant.trim()
  const existe = base().prepare('SELECT 1 FROM comptes WHERE identifiant = ?').get(propre)
  if (existe) throw new Error(`Un compte « ${propre} » existe déjà.`)

  const sel = randomBytes(16).toString('hex')
  const resultat = base()
    .prepare(
      'INSERT INTO comptes (identifiant, nom_affiche, sel, empreinte, role) VALUES (?, ?, ?, ?, ?)'
    )
    .run(propre, nomAffiche, sel, calculerEmpreinte(motDePasse, sel), role)

  tracerAcces(propre, 'comptes:creer', 'succes', `Rôle ${role}`)
  return {
    id: Number(resultat.lastInsertRowid),
    identifiant: propre,
    nomAffiche,
    role,
    actif: true
  }
}

/**
 * Crée le tout premier administrateur. Refusé dès qu'un compte existe : sans
 * cela, n'importe qui pourrait s'octroyer les pleins droits à tout moment.
 */
export function creerPremierAdministrateur(
  identifiant: string,
  motDePasse: string,
  nomAffiche = ''
): Compte {
  if (nombreDeComptes() > 0) {
    throw new Error(
      'Des comptes existent déjà. Demandez à un administrateur de vous en créer un.'
    )
  }
  return creerCompte(identifiant, motDePasse, 'administration', nomAffiche)
}

export function changerMotDePasse(identifiant: string, nouveau: string): void {
  const erreur = validerMotDePasse(nouveau)
  if (erreur) throw new Error(erreur)

  const compte = base().prepare('SELECT id FROM comptes WHERE identifiant = ?').get(identifiant) as
    | { id: number }
    | undefined
  if (!compte) throw new Error(`Le compte « ${identifiant} » n'existe pas.`)

  const sel = randomBytes(16).toString('hex')
  base()
    .prepare(
      'UPDATE comptes SET sel = ?, empreinte = ?, echecs_consecutifs = 0, bloque_jusqua = NULL WHERE id = ?'
    )
    .run(sel, calculerEmpreinte(nouveau, sel), compte.id)

  // Changer de mot de passe ferme les sessions ouvertes : c'est le seul moyen
  // de reprendre la main si un jeton a fuité.
  base().prepare('DELETE FROM sessions WHERE compte_id = ?').run(compte.id)
  tracerAcces(identifiant, 'comptes:changerMotDePasse', 'succes')
}

export function changerRole(identifiant: string, role: Role): void {
  if (!ROLES.includes(role)) throw new Error(`Rôle inconnu : « ${role} ».`)

  const ligne = base()
    .prepare('SELECT id, role FROM comptes WHERE identifiant = ?')
    .get(identifiant) as { id: number; role: Role } | undefined
  if (!ligne) throw new Error(`Le compte « ${identifiant} » n'existe pas.`)

  // Un serveur sans administrateur ne peut plus être repris en main.
  if (ligne.role === 'administration' && role !== 'administration' && compteAdministrateurs() <= 1) {
    throw new Error(
      "C'est le dernier administrateur : changez son rôle et plus personne ne pourrait " +
        "créer de comptes. Nommez d'abord un autre administrateur."
    )
  }

  base().prepare('UPDATE comptes SET role = ? WHERE id = ?').run(role, ligne.id)
  tracerAcces(identifiant, 'comptes:changerRole', 'succes', `Nouveau rôle ${role}`)
}

export function desactiverCompte(identifiant: string): void {
  const ligne = base()
    .prepare('SELECT id, role, actif FROM comptes WHERE identifiant = ?')
    .get(identifiant) as { id: number; role: Role; actif: number } | undefined
  if (!ligne) throw new Error(`Le compte « ${identifiant} » n'existe pas.`)

  if (ligne.role === 'administration' && ligne.actif === 1 && compteAdministrateurs() <= 1) {
    throw new Error(
      "C'est le dernier administrateur actif : le désactiver rendrait le serveur " +
        "impossible à administrer. Nommez d'abord un autre administrateur."
    )
  }

  base().prepare('UPDATE comptes SET actif = 0 WHERE id = ?').run(ligne.id)
  base().prepare('DELETE FROM sessions WHERE compte_id = ?').run(ligne.id)
  tracerAcces(identifiant, 'comptes:desactiver', 'succes')
}

export function reactiverCompte(identifiant: string): void {
  const modifiees = base()
    .prepare('UPDATE comptes SET actif = 1, echecs_consecutifs = 0, bloque_jusqua = NULL WHERE identifiant = ?')
    .run(identifiant)
  if (Number(modifiees.changes) === 0) {
    throw new Error(`Le compte « ${identifiant} » n'existe pas.`)
  }
  tracerAcces(identifiant, 'comptes:reactiver', 'succes')
}

function compteAdministrateurs(): number {
  const ligne = base()
    .prepare("SELECT COUNT(*) AS n FROM comptes WHERE role = 'administration' AND actif = 1")
    .get() as { n: number }
  return ligne.n
}

/* ── Sessions ─────────────────────────────────────────────────────────────── */

/**
 * Le jeton est tiré au sort avec assez d'entropie pour être indevinable ; on
 * n'en garde que l'empreinte. Une copie de la base ne permet donc pas de
 * rejouer une session en cours. SHA-256 suffit ici, contrairement aux mots de
 * passe : il n'y a rien à deviner dans 32 octets aléatoires.
 */
function empreinteJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex')
}

export function ouvrirSession(identifiant: string, motDePasse: string): SessionOuverte {
  const ligne = base()
    .prepare('SELECT * FROM comptes WHERE identifiant = ?')
    .get(identifiant.trim()) as unknown as LigneCompte | undefined

  // Message volontairement identique que le compte existe ou non : sinon, la
  // page de connexion devient un moyen de savoir qui a un compte ici.
  const refus = new Error("Identifiant ou mot de passe incorrect.")

  if (!ligne) {
    tracerAcces(identifiant, 'session:ouvrir', 'echec', 'Compte inexistant')
    throw refus
  }
  if (ligne.actif !== 1) {
    tracerAcces(identifiant, 'session:ouvrir', 'echec', 'Compte désactivé')
    throw new Error('Ce compte est désactivé. Contactez un administrateur.')
  }
  if (ligne.bloque_jusqua && ligne.bloque_jusqua > maintenant()) {
    tracerAcces(identifiant, 'session:ouvrir', 'echec', 'Compte temporairement bloqué')
    throw new Error(
      `Trop de tentatives : ce compte est bloqué jusqu'à ${ligne.bloque_jusqua} (UTC).`
    )
  }

  if (!empreintesIdentiques(ligne.empreinte, calculerEmpreinte(motDePasse, ligne.sel))) {
    enregistrerEchec(ligne)
    tracerAcces(identifiant, 'session:ouvrir', 'echec', 'Mot de passe incorrect')
    throw refus
  }

  const jeton = randomBytes(32).toString('hex')
  const expireLe = dansHeures(DUREE_SESSION_HEURES)

  base()
    .prepare('INSERT INTO sessions (compte_id, empreinte_jeton, expire_le) VALUES (?, ?, ?)')
    .run(ligne.id, empreinteJeton(jeton), expireLe)

  base()
    .prepare(
      "UPDATE comptes SET echecs_consecutifs = 0, bloque_jusqua = NULL, derniere_connexion_le = datetime('now') WHERE id = ?"
    )
    .run(ligne.id)

  purgerSessionsExpirees()
  tracerAcces(ligne.identifiant, 'session:ouvrir', 'succes')
  return { jeton, expireLe, compte: versCompte(ligne) }
}

function enregistrerEchec(ligne: LigneCompte): void {
  const echecs = ligne.echecs_consecutifs + 1
  const bloqueJusqua = echecs >= ECHECS_AVANT_BLOCAGE ? dansMinutes(DUREE_BLOCAGE_MINUTES) : null
  base()
    .prepare('UPDATE comptes SET echecs_consecutifs = ?, bloque_jusqua = ? WHERE id = ?')
    .run(echecs, bloqueJusqua, ligne.id)
}

/** Le compte derrière un jeton, ou `null` si le jeton est inconnu ou périmé. */
export function compteDeLaSession(jeton: string): Compte | null {
  if (!jeton) return null

  const ligne = base()
    .prepare(
      `SELECT c.* FROM sessions s
       JOIN comptes c ON c.id = s.compte_id
       WHERE s.empreinte_jeton = ? AND s.expire_le > ? AND c.actif = 1`
    )
    .get(empreinteJeton(jeton), maintenant()) as unknown as LigneCompte | undefined

  return ligne ? versCompte(ligne) : null
}

export function fermerSession(jeton: string): void {
  base().prepare('DELETE FROM sessions WHERE empreinte_jeton = ?').run(empreinteJeton(jeton))
}

export function purgerSessionsExpirees(): void {
  base().prepare('DELETE FROM sessions WHERE expire_le <= ?').run(maintenant())
}

/* ── Journal des accès ────────────────────────────────────────────────────── */

export function tracerAcces(
  identifiant: string,
  canal: string,
  resultat: 'succes' | 'echec' | 'refus',
  detail = ''
): void {
  base()
    .prepare('INSERT INTO acces (identifiant, canal, resultat, detail) VALUES (?, ?, ?, ?)')
    .run(identifiant, canal, resultat, detail)
}

export interface LigneAcces {
  horodatage: string
  identifiant: string
  canal: string
  resultat: string
  detail: string
}

export function listerAcces(limite = 300): LigneAcces[] {
  return base()
    .prepare('SELECT horodatage, identifiant, canal, resultat, detail FROM acces ORDER BY id DESC LIMIT ?')
    .all(limite) as unknown as LigneAcces[]
}

/* ── Dates ────────────────────────────────────────────────────────────────── */
// Tout est stocké en UTC, au même format que `datetime('now')` de SQLite,
// pour que les comparaisons se fassent en texte sans surprise de fuseau.

function maintenant(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function dansHeures(heures: number): string {
  return new Date(Date.now() + heures * 3600_000).toISOString().replace('T', ' ').slice(0, 19)
}

function dansMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString().replace('T', ' ').slice(0, 19)
}
