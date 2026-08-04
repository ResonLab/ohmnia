import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { calculerEcheance } from '../../shared/calculs'
import { lireParametresApp } from './parametresApp'
import type { FactureEcheance, TableauDeBord } from '../../shared/types'

export function enregistrerHandlersTableauDeBord(): void {
  ipcMain.handle('tableauDeBord:charger', () => {
    const db = getDb()
    const maintenant = new Date()
    const moisCourant = maintenant.toISOString().slice(0, 7) // "2026-07"
    const anneeCourante = maintenant.getFullYear()
    const { seuilAlerteFactureJours } = lireParametresApp()

    const mois = db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN type = 'Entrée' THEN montant ELSE 0 END), 0) AS entrees,
          COALESCE(SUM(CASE WHEN type = 'Dépense' THEN montant ELSE 0 END), 0) AS depenses
         FROM journal WHERE strftime('%Y-%m', date) = ?`
      )
      .get(moisCourant) as { entrees: number; depenses: number }

    const annee = db
      .prepare(
        `SELECT COALESCE(SUM(montant), 0) AS entrees FROM journal
         WHERE type = 'Entrée' AND CAST(strftime('%Y', date) AS INTEGER) = ?`
      )
      .get(anneeCourante) as { entrees: number }

    const objectif = db
      .prepare('SELECT objectif_ca FROM objectifs_annuels WHERE annee = ?')
      .get(anneeCourante) as { objectif_ca: number } | undefined

    // Les factures « En attente » et leur montant, lu depuis le Journal.
    const facturesEnAttente = db
      .prepare(
        `SELECT f.id, f.numero, f.date, f.delai_paiement_jours, c.nom AS client_nom,
          (SELECT SUM(j.montant) FROM journal j WHERE j.numero_facture = f.numero) AS montant
         FROM factures f
         LEFT JOIN clients c ON c.id = f.client_id
         WHERE f.statut = 'En attente'
         ORDER BY f.date`
      )
      .all() as unknown as {
      id: number
      numero: string
      date: string
      delai_paiement_jours: number
      client_nom: string | null
      montant: number | null
    }[]

    const aujourdhui = maintenant.getTime()
    let montantEnAttente = 0
    let nbFacturesEnRetard = 0
    let montantEnRetard = 0
    const prochainesEcheances: FactureEcheance[] = []

    for (const facture of facturesEnAttente) {
      const montant = facture.montant ?? 0
      montantEnAttente += montant

      const joursDepuisEmission = Math.floor((aujourdhui - new Date(facture.date).getTime()) / 86400000)
      if (joursDepuisEmission > seuilAlerteFactureJours) {
        nbFacturesEnRetard += 1
        montantEnRetard += montant
      }

      const dateEcheance = calculerEcheance(facture.date, facture.delai_paiement_jours)
      prochainesEcheances.push({
        id: facture.id,
        numero: facture.numero,
        clientNom: facture.client_nom ?? 'Client supprimé',
        dateEcheance,
        joursRestants: Math.ceil((new Date(dateEcheance).getTime() - aujourdhui) / 86400000),
        montant: facture.montant
      })
    }

    prochainesEcheances.sort((a, b) => a.joursRestants - b.joursRestants)

    const articlesSousSeuil = db
      .prepare(
        `SELECT reference, designation, quantite_stock, seuil_alerte FROM inventaire
         WHERE quantite_stock <= seuil_alerte ORDER BY quantite_stock`
      )
      .all() as unknown as {
      reference: string
      designation: string
      quantite_stock: number
      seuil_alerte: number
    }[]

    const stock = db
      .prepare('SELECT COALESCE(SUM(quantite_stock * prix_achat_unitaire), 0) AS valeur FROM inventaire')
      .get() as { valeur: number }

    const devis = db
      .prepare("SELECT COUNT(*) AS n FROM devis WHERE statut = 'En attente'")
      .get() as { n: number }

    return {
      moisCourant,
      caMois: mois.entrees,
      depensesMois: mois.depenses,
      beneficeMois: mois.entrees - mois.depenses,
      caAnnee: annee.entrees,
      objectifAnnee: objectif?.objectif_ca ?? 0,
      nbFacturesEnAttente: facturesEnAttente.length,
      montantEnAttente,
      nbFacturesEnRetard,
      montantEnRetard,
      articlesSousSeuil: articlesSousSeuil.map((a) => ({
        reference: a.reference,
        designation: a.designation,
        quantiteStock: a.quantite_stock,
        seuilAlerte: a.seuil_alerte
      })),
      prochainesEcheances: prochainesEcheances.slice(0, 8),
      nbDevisEnAttente: devis.n,
      valeurStock: stock.valeur
    } satisfies TableauDeBord
  })
}
