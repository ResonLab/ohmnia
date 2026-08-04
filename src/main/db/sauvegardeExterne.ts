import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cheminBase } from './backup'
import { viderJournalWal } from './database'

/**
 * Sauvegarde chiffrée vers un dossier externe (clé USB, disque, dossier réseau).
 *
 * Chiffrement AES-256-GCM avec une clé dérivée du mot de passe par scrypt.
 * GCM fournit aussi un contrôle d'intégrité : un fichier altéré ou un mauvais
 * mot de passe est détecté au déchiffrement au lieu de produire des données fausses.
 *
 * Format du fichier : MAGIC(8) | sel(16) | iv(12) | tag(16) | données chiffrées
 */

const MAGIC = Buffer.from('OHMNIA01', 'utf-8')
const TAILLE_SEL = 16
const TAILLE_IV = 12
const TAILLE_TAG = 16
const LONGUEUR_CLE = 32

function deriverCle(motDePasse: string, sel: Buffer): Buffer {
  // scrypt : volontairement coûteux, pour résister à une attaque par dictionnaire.
  return scryptSync(motDePasse, sel, LONGUEUR_CLE, { N: 16384, r: 8, p: 1 })
}

function validerMotDePasse(motDePasse: string): void {
  if (motDePasse.length < 8) {
    throw new Error('Le mot de passe doit contenir au moins 8 caractères.')
  }
}

/** Chiffre la base actuelle vers le dossier indiqué. Retourne le chemin écrit. */
export function sauvegarderVersDossierExterne(dossierCible: string, motDePasse: string): string {
  validerMotDePasse(motDePasse)

  const source = cheminBase()
  if (!existsSync(source)) throw new Error("Aucune base de données à sauvegarder pour l'instant.")
  if (!existsSync(dossierCible)) {
    throw new Error(
      `Le dossier « ${dossierCible} » est introuvable. Si c'est une clé USB, vérifie qu'elle est bien branchée.`
    )
  }

  const dossierOhmnia = join(dossierCible, 'Ohmnia-Sauvegardes')
  if (!existsSync(dossierOhmnia)) mkdirSync(dossierOhmnia, { recursive: true })

  // Les écritures encore dans le journal WAL doivent rejoindre le fichier
  // principal avant la copie, sinon la sauvegarde serait incomplète.
  viderJournalWal()

  const donnees = readFileSync(source)
  const sel = randomBytes(TAILLE_SEL)
  const iv = randomBytes(TAILLE_IV)
  const chiffreur = createCipheriv('aes-256-gcm', deriverCle(motDePasse, sel), iv)
  const chiffre = Buffer.concat([chiffreur.update(donnees), chiffreur.final()])

  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const cheminSortie = join(dossierOhmnia, `ohmnia-${horodatage}.ohmnia`)
  writeFileSync(cheminSortie, Buffer.concat([MAGIC, sel, iv, chiffreur.getAuthTag(), chiffre]))

  return cheminSortie
}

/**
 * Déchiffre une sauvegarde externe et écrase la base actuelle.
 * L'appelant doit avoir fait une sauvegarde locale au préalable.
 */
export function restaurerDepuisFichierChiffre(cheminFichier: string, motDePasse: string): void {
  if (!existsSync(cheminFichier)) throw new Error('Fichier de sauvegarde introuvable.')

  const contenu = readFileSync(cheminFichier)
  const enteteMinimum = MAGIC.length + TAILLE_SEL + TAILLE_IV + TAILLE_TAG
  if (contenu.length <= enteteMinimum || !contenu.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Ce fichier n'est pas une sauvegarde Ohmnia valide.")
  }

  let position = MAGIC.length
  const sel = contenu.subarray(position, (position += TAILLE_SEL))
  const iv = contenu.subarray(position, (position += TAILLE_IV))
  const tag = contenu.subarray(position, (position += TAILLE_TAG))
  const chiffre = contenu.subarray(position)

  const dechiffreur = createDecipheriv('aes-256-gcm', deriverCle(motDePasse, sel), iv)
  dechiffreur.setAuthTag(tag)

  let clair: Buffer
  try {
    clair = Buffer.concat([dechiffreur.update(chiffre), dechiffreur.final()])
  } catch {
    // GCM échoue si le mot de passe est faux OU si le fichier a été altéré.
    throw new Error(
      'Déchiffrement impossible : mot de passe incorrect, ou fichier de sauvegarde endommagé.'
    )
  }

  // Contrôle final : une base SQLite commence toujours par cet en-tête.
  if (!clair.subarray(0, 15).toString('utf-8').startsWith('SQLite format 3')) {
    throw new Error('Le contenu déchiffré ne correspond pas à une base de données Ohmnia.')
  }

  const destination = cheminBase()
  writeFileSync(destination, clair)

  // Les journaux WAL de l'ancienne base ne correspondent plus aux données
  // restaurées : les laisser provoquerait une base incohérente à la réouverture.
  for (const suffixe of ['-wal', '-shm']) {
    const annexe = destination + suffixe
    if (existsSync(annexe)) unlinkSync(annexe)
  }
}
