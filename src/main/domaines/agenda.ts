import { dansUneTransaction, getDb } from '../db/database'
import { tracerAudit } from '../db/audit'
import {
  formaterDateCourte,
  nombreDeJours,
  STATUT_LOCATION_ANNULEE,
  STATUT_LOCATION_RENDUE,
  STATUT_LOCATION_RESERVEE,
  totalLocation
} from '../../shared/agenda'
import type {
  ContenuAgenda,
  DisponibiliteArticle,
  EvenementAgenda,
  LigneLocation,
  LocationAgenda,
  ResultatLocation,
  StatutLocation,
  ValeursLocation
} from '../../shared/types'

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

// --- Locations ---

interface LigneLocationBase {
  id: number
  client_id: number
  client_nom: string
  date_debut: string
  date_fin: string
  statut: StatutLocation
  notes: string
  facture_id: number | null
  facture_numero: string | null
}

/** Une location, relue en base : total, durée et nom du client sont calculés ici. */
export function lireLocation(id: number): LocationAgenda {
  const db = getDb()
  const ligne = db
    .prepare(
      `SELECT l.*, c.nom AS client_nom, f.numero AS facture_numero
       FROM locations l
       JOIN clients c ON c.id = l.client_id
       LEFT JOIN factures f ON f.id = l.facture_id
       WHERE l.id = ?`
    )
    .get(id) as unknown as LigneLocationBase | undefined
  if (!ligne) throw new Error("Cette location n'existe pas ou a été supprimée.")

  const lignes = (
    db
      .prepare(
        `SELECT reference_inventaire, designation, quantite, prix_par_jour
         FROM location_lignes WHERE location_id = ? ORDER BY id`
      )
      .all(id) as unknown as {
      reference_inventaire: string
      designation: string
      quantite: number
      prix_par_jour: number
    }[]
  ).map(
    (l): LigneLocation => ({
      referenceInventaire: l.reference_inventaire,
      designation: l.designation,
      quantite: l.quantite,
      prixParJour: l.prix_par_jour
    })
  )

  const jours = nombreDeJours(ligne.date_debut, ligne.date_fin)
  return {
    id: ligne.id,
    clientId: ligne.client_id,
    clientNom: ligne.client_nom,
    dateDebut: ligne.date_debut,
    dateFin: ligne.date_fin,
    statut: ligne.statut,
    notes: ligne.notes,
    factureId: ligne.facture_id,
    factureNumero: ligne.facture_numero,
    lignes,
    jours,
    total: totalLocation(lignes, jours)
  }
}

/**
 * Ce qui reste d'un article sur des dates : son stock, moins ce qui est déjà loué
 * sur des dates qui se chevauchent. Les locations annulées ne comptent pas, et
 * `exclureLocationId` écarte celle qu'on est en train de modifier — sans cela elle
 * se compterait contre elle-même.
 *
 * **Le stock n'est jamais modifié par une location** : le matériel revient.
 */
export function disponibiliteArticle(
  reference: string,
  debut: string,
  fin: string,
  exclureLocationId = 0
): DisponibiliteArticle {
  const article = getDb().prepare('SELECT quantite_stock FROM inventaire WHERE reference = ?').get(reference) as
    | { quantite_stock: number }
    | undefined
  if (!article) throw new Error(`Article introuvable dans l'inventaire : « ${reference} ».`)
  nombreDeJours(debut, fin) // refuse des dates invalides ou inversées

  const loue = (
    getDb()
      .prepare(
        `SELECT COALESCE(SUM(ll.quantite), 0) AS n
         FROM location_lignes ll JOIN locations l ON l.id = ll.location_id
         WHERE ll.reference_inventaire = ? AND l.statut <> ? AND l.id <> ?
           AND l.date_debut <= ? AND l.date_fin >= ?`
      )
      .get(reference, STATUT_LOCATION_ANNULEE, exclureLocationId, fin, debut) as { n: number }
  ).n

  return { reference, stock: article.quantite_stock, loue, disponible: article.quantite_stock - loue }
}

function validerLocation(v: ValeursLocation): void {
  nombreDeJours(v.dateDebut, v.dateFin)
  if (v.lignes.length === 0) throw new Error('Une location doit comporter au moins un article.')
  for (const ligne of v.lignes) {
    const reference = ligne.referenceInventaire.trim()
    if (!reference) throw new Error('Chaque ligne doit désigner un article.')
    if (!Number.isFinite(ligne.quantite) || ligne.quantite <= 0) {
      throw new Error(`La quantité de « ${reference} » doit être supérieure à zéro.`)
    }
    if (!Number.isFinite(ligne.prixParJour) || ligne.prixParJour < 0) {
      throw new Error(`Le prix par jour de « ${reference} » ne peut pas être négatif.`)
    }
  }
}

/**
 * `id: 0` crée la location (statut « Réservée ») ; un autre `id` la modifie **sans
 * changer son statut** (voir `changerStatutLocation`). Tout ou rien : l'en-tête et
 * les lignes s'écrivent ensemble.
 *
 * Une quantité qui dépasse la disponibilité n'empêche pas d'enregistrer : on
 * prévient, comme la caisse pour le stock.
 */
export function enregistrerLocation(valeurs: ValeursLocation): ResultatLocation {
  validerLocation(valeurs)
  const db = getDb()

  const client = db.prepare('SELECT nom FROM clients WHERE id = ?').get(valeurs.clientId) as
    | { nom: string }
    | undefined
  if (!client) throw new Error("Ce client n'existe pas ou a été supprimé.")
  if (valeurs.id !== 0) lireLocation(valeurs.id) // refuse une location inconnue

  return dansUneTransaction(() => {
    // Les désignations viennent de l'inventaire, jamais de l'écran.
    const lignes = valeurs.lignes.map((l) => {
      const reference = l.referenceInventaire.trim()
      const article = db.prepare('SELECT designation FROM inventaire WHERE reference = ?').get(reference) as
        | { designation: string }
        | undefined
      if (!article) throw new Error(`Article introuvable dans l'inventaire : « ${reference} ».`)
      return { reference, designation: article.designation, quantite: l.quantite, prixParJour: l.prixParJour }
    })

    // Un même article sur deux lignes se compte une seule fois, en somme.
    const demandees = new Map<string, number>()
    for (const l of lignes) demandees.set(l.reference, (demandees.get(l.reference) ?? 0) + l.quantite)
    const avertissements: string[] = []
    for (const [reference, quantite] of demandees) {
      const dispo = disponibiliteArticle(reference, valeurs.dateDebut, valeurs.dateFin, valeurs.id)
      if (quantite > dispo.disponible) {
        avertissements.push(
          `Disponibilité insuffisante pour "${reference}" (${quantite} demandé, ${Math.max(0, dispo.disponible)} disponible ` +
            `du ${formaterDateCourte(valeurs.dateDebut)} au ${formaterDateCourte(valeurs.dateFin)}).`
        )
      }
    }

    let id = valeurs.id
    if (id === 0) {
      id = Number(
        db
          .prepare('INSERT INTO locations (client_id, date_debut, date_fin, statut, notes) VALUES (?, ?, ?, ?, ?)')
          .run(valeurs.clientId, valeurs.dateDebut, valeurs.dateFin, STATUT_LOCATION_RESERVEE, valeurs.notes)
          .lastInsertRowid
      )
    } else {
      db.prepare('UPDATE locations SET client_id = ?, date_debut = ?, date_fin = ?, notes = ? WHERE id = ?').run(
        valeurs.clientId,
        valeurs.dateDebut,
        valeurs.dateFin,
        valeurs.notes,
        id
      )
      db.prepare('DELETE FROM location_lignes WHERE location_id = ?').run(id)
    }

    const insererLigne = db.prepare(
      `INSERT INTO location_lignes (location_id, reference_inventaire, designation, quantite, prix_par_jour)
       VALUES (?, ?, ?, ?, ?)`
    )
    for (const l of lignes) insererLigne.run(id, l.reference, l.designation, l.quantite, l.prixParJour)

    tracerAudit(
      valeurs.id === 0 ? 'creation' : 'modification',
      'location',
      String(id),
      `${client.nom} — ${valeurs.dateDebut} → ${valeurs.dateFin}`
    )
    return { location: lireLocation(id), avertissements }
  })
}

const STATUTS_LOCATION: StatutLocation[] = [STATUT_LOCATION_RESERVEE, STATUT_LOCATION_RENDUE, STATUT_LOCATION_ANNULEE]

export function changerStatutLocation(id: number, statut: StatutLocation): LocationAgenda {
  if (!STATUTS_LOCATION.includes(statut)) throw new Error(`Statut de location inconnu : « ${statut} ».`)
  const avant = lireLocation(id)
  getDb().prepare('UPDATE locations SET statut = ? WHERE id = ?').run(statut, id)
  tracerAudit(
    statut === STATUT_LOCATION_ANNULEE ? 'annulation' : 'modification',
    'location',
    String(id),
    `${avant.clientNom} — ${avant.statut} → ${statut}`
  )
  return lireLocation(id)
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
  const locations = getDb()
    .prepare('SELECT id FROM locations WHERE date_debut <= ? AND date_fin >= ? ORDER BY date_debut, id')
    .all(fin, debut) as unknown as { id: number }[]
  return { evenements: evenements.map(versEvenement), locations: locations.map((l) => lireLocation(l.id)) }
}
