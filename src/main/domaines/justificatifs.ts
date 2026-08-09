import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { getDb } from '../db/database'
import { tracerAudit } from '../db/audit'
import { dossierDonnees } from '../contexte'
import type { Justificatif } from '../../shared/types'

/**
 * Justificatifs : la base **et les fichiers**.
 *
 * Les fichiers vivaient dans le dossier du poste, ce qui condamnait les
 * justificatifs en multi-postes : un collègue n'aurait jamais vu le ticket
 * rangé depuis un autre ordinateur. Ils vivent maintenant **à côté de la
 * base** — donc sur le serveur en multi-postes — et voyagent par le protocole,
 * encodés en base64.
 *
 * Conséquence voulue : les justificatifs restent inclus dans les sauvegardes
 * du dossier de données, exactement comme avant.
 */

const EXTENSIONS_ACCEPTEES = ['.png', '.jpg', '.jpeg', '.webp', '.pdf']

const MIME_PAR_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf'
}

/**
 * Un justificatif qui dépasse cette taille est refusé avec un message clair.
 * Le protocole transporte le fichier en base64 dans le corps JSON : sans
 * limite, une photo de 80 Mo ferait tomber la requête sans rien expliquer.
 */
const TAILLE_MAX_OCTETS = 15 * 1024 * 1024

function dossierJustificatifs(): string {
  const dossier = join(dossierDonnees(), 'Justificatifs')
  if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true })
  return dossier
}

/** Refuse tout nom de fichier qui pourrait sortir du dossier des justificatifs. */
function cheminSecurise(nomFichier: string): string {
  if (nomFichier.includes('/') || nomFichier.includes('\\') || nomFichier.includes('..')) {
    throw new Error('Nom de fichier invalide.')
  }
  return join(dossierJustificatifs(), nomFichier)
}

interface LigneJustificatif {
  id: number
  journal_id: number
  nom_fichier: string
  ajoute_le: string
}

function versJustificatif(ligne: LigneJustificatif): Justificatif {
  return {
    id: ligne.id,
    journalId: ligne.journal_id,
    nomFichier: ligne.nom_fichier,
    ajouteLe: ligne.ajoute_le
  }
}

export function listerJustificatifs(journalId: number): Justificatif[] {
  const lignes = getDb()
    .prepare('SELECT * FROM justificatifs WHERE journal_id = ? ORDER BY id')
    .all(journalId) as unknown as LigneJustificatif[]
  return lignes.map(versJustificatif)
}

/** Combien de justificatifs par écriture, pour afficher une pastille dans la liste. */
export function compterJustificatifsParEcriture(): Record<number, number> {
  const lignes = getDb()
    .prepare('SELECT journal_id, COUNT(*) AS n FROM justificatifs GROUP BY journal_id')
    .all() as unknown as { journal_id: number; n: number }[]
  return Object.fromEntries(lignes.map((l) => [l.journal_id, l.n])) as Record<number, number>
}

/**
 * Range un fichier reçu du poste. Le contenu arrive en base64 : c'est le seul
 * moyen de faire voyager un binaire dans le corps JSON du protocole.
 */
export function ajouterJustificatif(
  journalId: number,
  nomOrigine: string,
  contenuBase64: string
): Justificatif {
  const ecriture = getDb().prepare('SELECT id FROM journal WHERE id = ?').get(journalId)
  if (!ecriture) throw new Error("Cette écriture du Journal n'existe pas.")

  const extension = extname(nomOrigine).toLowerCase()
  if (!EXTENSIONS_ACCEPTEES.includes(extension)) {
    throw new Error(`Format non pris en charge (${extension}). Utilise PNG, JPG, WEBP ou PDF.`)
  }

  const contenu = Buffer.from(contenuBase64, 'base64')
  if (contenu.length === 0) throw new Error('Ce fichier est vide.')
  if (contenu.length > TAILLE_MAX_OCTETS) {
    const mega = Math.round(contenu.length / (1024 * 1024))
    throw new Error(
      `Ce justificatif fait ${mega} Mo, la limite est de 15 Mo. ` +
        'Photographiez le document en qualité moindre, ou enregistrez-le en PDF.'
    )
  }

  // Nom unique : pas de collision si deux tickets ont le même nom d'origine.
  const nomFichier = `j${journalId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`
  writeFileSync(join(dossierJustificatifs(), nomFichier), contenu)

  const insertion = getDb()
    .prepare('INSERT INTO justificatifs (journal_id, nom_fichier) VALUES (?, ?)')
    .run(journalId, nomFichier)
  const ligne = getDb()
    .prepare('SELECT * FROM justificatifs WHERE id = ?')
    .get(insertion.lastInsertRowid) as unknown as LigneJustificatif

  tracerAudit('ajout', 'justificatif', String(journalId), nomOrigine)
  return versJustificatif(ligne)
}

/** Le fichier en data URL, pour l'afficher tel quel dans l'interface. */
export function contenuJustificatif(nomFichier: string): string | null {
  const chemin = cheminSecurise(nomFichier)
  if (!existsSync(chemin)) return null

  const mime = MIME_PAR_EXTENSION[extname(nomFichier).toLowerCase()]
  if (!mime) return null
  return `data:${mime};base64,${readFileSync(chemin).toString('base64')}`
}

export function supprimerJustificatif(id: number): void {
  const ligne = getDb().prepare('SELECT nom_fichier FROM justificatifs WHERE id = ?').get(id) as
    | { nom_fichier: string }
    | undefined
  if (!ligne) return

  getDb().prepare('DELETE FROM justificatifs WHERE id = ?').run(id)

  // Le fichier n'est retiré du disque qu'après la suppression en base réussie.
  const chemin = cheminSecurise(ligne.nom_fichier)
  if (existsSync(chemin)) unlinkSync(chemin)
}
