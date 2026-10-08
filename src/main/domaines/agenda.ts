import { getDb } from '../db/database'
import { tracerAudit } from '../db/audit'
import type { ContenuAgenda, EvenementAgenda } from '../../shared/types'

/**
 * Agenda, sans Electron.
 * Voir `./clients.ts` pour la règle : rien de la fenêtre ici.
 */

interface LigneEvenement {
  id: number
  titre: string
  debut: string
  fin: string
  lieu: string
  notes: string
}

function versEvenement(ligne: LigneEvenement): EvenementAgenda {
  return { id: ligne.id, titre: ligne.titre, debut: ligne.debut, fin: ligne.fin, lieu: ligne.lieu, notes: ligne.notes }
}

const FORMAT_DATE_HEURE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/

/** Vrai pour `YYYY-MM-DD HH:MM` d'une date et d'une heure qui existent. */
function dateHeureValide(texte: string): boolean {
  const m = FORMAT_DATE_HEURE.exec(texte)
  if (!m) return false
  const [annee, mois, jour, heure, minute] = m.slice(1).map(Number)
  if (heure > 23 || minute > 59) return false
  const date = new Date(Date.UTC(annee, mois - 1, jour))
  return date.getUTCFullYear() === annee && date.getUTCMonth() === mois - 1 && date.getUTCDate() === jour
}

function validerEvenement(e: EvenementAgenda): string | null {
  if (!e.titre.trim()) return "Le titre de l'événement est obligatoire."
  if (!dateHeureValide(e.debut)) return 'Le début doit être une date et une heure valides (AAAA-MM-JJ HH:MM).'
  if (!dateHeureValide(e.fin)) return 'La fin doit être une date et une heure valides (AAAA-MM-JJ HH:MM).'
  if (e.fin < e.debut) return 'La fin ne peut pas précéder le début.'
  return null
}

function lireEvenement(id: number): EvenementAgenda | undefined {
  const ligne = getDb().prepare('SELECT * FROM evenements_agenda WHERE id = ?').get(id) as unknown as
    | LigneEvenement
    | undefined
  return ligne ? versEvenement(ligne) : undefined
}

/** `id: 0` crée l'événement ; un autre `id` le modifie. */
export function enregistrerEvenement(valeurs: EvenementAgenda): EvenementAgenda {
  const erreur = validerEvenement(valeurs)
  if (erreur) throw new Error(erreur)

  const db = getDb()
  const titre = valeurs.titre.trim()

  if (valeurs.id === 0) {
    const id = Number(
      db
        .prepare('INSERT INTO evenements_agenda (titre, debut, fin, lieu, notes) VALUES (?, ?, ?, ?, ?)')
        .run(titre, valeurs.debut, valeurs.fin, valeurs.lieu, valeurs.notes).lastInsertRowid
    )
    tracerAudit('creation', 'evenement_agenda', String(id), `${titre} — ${valeurs.debut}`)
    return lireEvenement(id) as EvenementAgenda
  }

  if (!lireEvenement(valeurs.id)) throw new Error("Cet événement n'existe pas ou a été supprimé.")
  db.prepare('UPDATE evenements_agenda SET titre = ?, debut = ?, fin = ?, lieu = ?, notes = ? WHERE id = ?').run(
    titre,
    valeurs.debut,
    valeurs.fin,
    valeurs.lieu,
    valeurs.notes,
    valeurs.id
  )
  tracerAudit('modification', 'evenement_agenda', String(valeurs.id), `${titre} — ${valeurs.debut}`)
  return lireEvenement(valeurs.id) as EvenementAgenda
}

export function supprimerEvenement(id: number): void {
  const existant = lireEvenement(id)
  if (!existant) return
  getDb().prepare('DELETE FROM evenements_agenda WHERE id = ?').run(id)
  tracerAudit('suppression', 'evenement_agenda', String(id), `${existant.titre} — ${existant.debut}`)
}

/**
 * Ce que l'agenda contient entre deux jours (`YYYY-MM-DD`, bornes comprises) :
 * tout élément dont la période touche cet intervalle, même s'il commence avant
 * ou finit après.
 */
export function listerAgenda(debut: string, fin: string): ContenuAgenda {
  const evenements = getDb()
    .prepare(
      `SELECT * FROM evenements_agenda
       WHERE substr(debut, 1, 10) <= ? AND substr(fin, 1, 10) >= ?
       ORDER BY debut, id`
    )
    .all(fin, debut) as unknown as LigneEvenement[]
  return { evenements: evenements.map(versEvenement), locations: [] }
}
