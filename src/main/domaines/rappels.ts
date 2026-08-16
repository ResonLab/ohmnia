import { getDb } from '../db/database'
import { tracerAudit } from '../db/audit'
import type { Rappel } from '../../shared/types'
import {
  calculerEcheance,
  calculerRelances,
  type FacturePourRelance,
  type RelanceProposee
} from '../../shared/calculs'
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

/**
 * Annule un rappel émis.
 *
 * **Les frais partent avec lui, et c'est le schéma qui le garantit, pas ce
 * code.** Les frais de rappel ne sont jamais écrits dans `facture_lignes` :
 * ils vivent sur la ligne `rappels` et ne deviennent une ligne de document que
 * dans `construireDonneesRappel`, qui les relit par l'id du rappel. Effacer la
 * ligne les efface donc partout où ils pouvaient paraître. *Le commentaire de
 * `tests/atteignable.mjs` affirmait le contraire ; il avait tort, et c'est en
 * allant regarder qu'on l'a su.*
 *
 * **Ce que l'annulation ne défait pas, en revanche** : le PDF déjà exporté et
 * envoyé au client. L'écran le dit avant de supprimer — sans quoi « annuler »
 * laisserait croire que le client n'a rien reçu.
 *
 * La création était tracée au journal d'audit et la suppression ne l'était
 * pas : le journal montrait des rappels émis et jamais aucun annulé, ce qui est
 * exactement le genre de trou qui rend un journal d'audit trompeur plutôt
 * qu'incomplet.
 */
export function supprimerRappel(id: number): void {
  const rappel = getDb()
    .prepare(
      `SELECT r.niveau, r.frais, f.numero
       FROM rappels r JOIN factures f ON f.id = r.facture_id
       WHERE r.id = ?`
    )
    .get(id) as { niveau: number; frais: number; numero: string } | undefined
  if (!rappel) throw new Error("Ce rappel n'existe pas.")

  getDb().prepare('DELETE FROM rappels WHERE id = ?').run(id)

  tracerAudit(
    'suppression',
    'facture',
    rappel.numero,
    `Rappel niveau ${rappel.niveau} annulé, frais ${rappel.frais} CHF retirés`
  )
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
 * **L'échéance se calcule, elle ne se lit pas.** Cette requête a visé pendant
 * des jours une colonne `factures.date_echeance` qui **n'a jamais existé** — ni
 * dans `schema.sql`, ni dans les migrations, nulle part ailleurs que dans ces
 * trois lignes. Toute base la refusait — vérifié sur une base neuve **et sur la
 * base réelle de l'utilisateur** —, donc `relancesAFaire()` levait une erreur
 * SQLite à chaque ouverture de la Facturation.
 *
 * **Et la panne était silencieuse, ce qui est le pire cas.**
 * `rechargerHistorique()` appelle `factures.historique()` *avant*
 * `rappels.aFaire()` : l'historique se chargeait donc normalement, seule la
 * seconde promesse était rejetée, et `relances` restait à vide. L'écran ne
 * montrait aucune erreur — il affichait **« Rien à relancer aujourd'hui »**,
 * en permanence, quel que soit le nombre de factures en retard. Un écran cassé
 * se remarque ; un écran qui rassure à tort ne se remarque jamais.
 *
 * *Aucune suite ne pouvait le voir* : `tests/relances.mjs` éprouve
 * `calculerRelances` sans base — c'est même sa qualité — et le contrôle
 * d'atteignabilité constate qu'un écran appelle `rappels.aFaire`, pas que
 * l'appel aboutisse. C'est la panne signature de la maison, cette fois dans
 * l'autre sens : atteignable, branchée, verte, et morte à l'exécution.
 * `tests/rappels-annulation.mjs` exécute désormais la requête pour de vrai.
 *
 * L'échéance passe donc par `calculerEcheance`, comme dans `documents.ts` et
 * `tableauDeBord.ts` — une formule, un seul endroit.
 *
 * Le seuil de première relance est celui que l'utilisateur a déjà choisi dans
 * les paramètres : lui en demander un second serait lui demander de tenir deux
 * réglages cohérents entre eux, ce que personne ne fait.
 */
export function relancesAFaire(): RelanceProposee[] {
  const lignes = getDb()
    .prepare(
      `SELECT f.id, f.numero, f.date, f.delai_paiement_jours, f.statut,
              COALESCE(c.nom, 'Client supprimé') AS client_nom,
              (SELECT COUNT(*) FROM rappels r WHERE r.facture_id = f.id) AS nb_rappels,
              (SELECT MAX(r.date) FROM rappels r WHERE r.facture_id = f.id) AS dernier_rappel
       FROM factures f
       LEFT JOIN clients c ON c.id = f.client_id`
    )
    .all() as unknown as {
    id: number
    numero: string
    date: string
    delai_paiement_jours: number
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
    dateEcheance: calculerEcheance(ligne.date, ligne.delai_paiement_jours),
    nombreRappels: ligne.nb_rappels,
    dernierRappelLe: ligne.dernier_rappel
  }))

  const aujourdhui = new Date().toISOString().slice(0, 10)
  return calculerRelances(factures, aujourdhui, lireParametresApp().seuilAlerteFactureJours)
}
