import { getDb } from '../db/database'
import { tracerAudit } from '../db/audit'
import type { Rappel } from '../../shared/types'
import { calculerRelances, type FacturePourRelance, type RelanceProposee } from '../../shared/calculs'
import { lireParametresApp } from './parametresApp'

/** Rappels de paiement. Aucune dépendance à Electron. */

interface LigneRappel {
  id: number
  facture_id: number
  niveau: number
  date: string
  frais: number
}

function versRappel(ligne: LigneRappel): Rappel {
  return {
    id: ligne.id,
    factureId: ligne.facture_id,
    niveau: ligne.niveau,
    date: ligne.date,
    frais: ligne.frais
  }
}

/** Frais suggérés par niveau de rappel (usage courant pour un indépendant en Suisse). */
const FRAIS_PAR_NIVEAU: Record<number, number> = { 1: 0, 2: 10, 3: 20 }

export function listerRappels(factureId: number): Rappel[] {
  const lignes = getDb()
    .prepare('SELECT * FROM rappels WHERE facture_id = ? ORDER BY niveau')
    .all(factureId) as unknown as LigneRappel[]
  return lignes.map(versRappel)
}

/** Prépare le prochain rappel sans l'enregistrer : sert à proposer niveau et frais. */
export function prochainNiveauRappel(factureId: number): {
  niveau: number
  fraisSuggeres: number
} {
  const ligne = getDb()
    .prepare('SELECT MAX(niveau) AS maxi FROM rappels WHERE facture_id = ?')
    .get(factureId) as { maxi: number | null }
  const niveau = (ligne.maxi ?? 0) + 1
  return { niveau, fraisSuggeres: FRAIS_PAR_NIVEAU[niveau] ?? 20 }
}

export function creerRappel(factureId: number, niveau: number, frais: number): Rappel {
  const facture = getDb()
    .prepare('SELECT numero, statut FROM factures WHERE id = ?')
    .get(factureId) as { numero: string; statut: string } | undefined
  if (!facture) throw new Error("Cette facture n'existe pas.")
  if (facture.statut === 'Payée') {
    throw new Error('Cette facture est déjà marquée comme payée : aucun rappel nécessaire.')
  }
  if (facture.statut === 'Annulée') {
    throw new Error('Cette facture est annulée : aucun rappel ne peut être émis.')
  }
  if (frais < 0) throw new Error('Les frais de rappel ne peuvent pas être négatifs.')

  const resultat = getDb()
    .prepare("INSERT INTO rappels (facture_id, niveau, date, frais) VALUES (?, ?, date('now'), ?)")
    .run(factureId, niveau, frais)

  tracerAudit('rappel', 'facture', facture.numero, `Rappel niveau ${niveau}, frais ${frais} CHF`)

  const ligne = getDb()
    .prepare('SELECT * FROM rappels WHERE id = ?')
    .get(resultat.lastInsertRowid) as unknown as LigneRappel
  return versRappel(ligne)
}

export function supprimerRappel(id: number): void {
  getDb().prepare('DELETE FROM rappels WHERE id = ?').run(id)
}

/**
 * Les factures qu'il faudrait relancer aujourd'hui.
 *
 * **Le SQL ne décide rien** : il rassemble ce qu'il faut savoir — statut,
 * échéance, nombre de rappels, date du dernier — et `calculerRelances` tranche.
 * La règle vit dans `shared/calculs.ts`, avec les autres formules, parce
 * qu'elle doit pouvoir être éprouvée sans base ni fenêtre. Recopiée en SQL,
 * elle finirait par contredire les tests qui la vérifient.
 *
 * Le seuil de première relance est celui que l'utilisateur a déjà choisi dans
 * les paramètres : lui en demander un second serait lui demander de tenir deux
 * réglages cohérents entre eux, ce que personne ne fait.
 */
export function relancesAFaire(): RelanceProposee[] {
  const lignes = getDb()
    .prepare(
      `SELECT f.id, f.numero, f.date_echeance, f.statut,
              COALESCE(c.nom, 'Client supprimé') AS client_nom,
              (SELECT COUNT(*) FROM rappels r WHERE r.facture_id = f.id) AS nb_rappels,
              (SELECT MAX(r.date) FROM rappels r WHERE r.facture_id = f.id) AS dernier_rappel
       FROM factures f
       LEFT JOIN clients c ON c.id = f.client_id`
    )
    .all() as unknown as {
    id: number
    numero: string
    date_echeance: string
    statut: string
    client_nom: string
    nb_rappels: number
    dernier_rappel: string | null
  }[]

  const factures: FacturePourRelance[] = lignes.map((ligne) => ({
    id: ligne.id,
    numero: ligne.numero,
    clientNom: ligne.client_nom,
    statut: ligne.statut,
    dateEcheance: ligne.date_echeance,
    nombreRappels: ligne.nb_rappels,
    dernierRappelLe: ligne.dernier_rappel
  }))

  const aujourdhui = new Date().toISOString().slice(0, 10)
  return calculerRelances(factures, aujourdhui, lireParametresApp().seuilAlerteFactureJours)
}
