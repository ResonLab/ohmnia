import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import type { ResultatRecherche } from '../../shared/types'

const LIMITE_PAR_TYPE = 6

export function enregistrerHandlersRecherche(): void {
  ipcMain.handle('recherche:globale', (_e, terme: string) => {
    const recherche = terme.trim()
    if (recherche.length < 2) return []

    const db = getDb()
    // LIKE avec échappement : un terme contenant % ou _ ne devient pas un joker.
    const motif = `%${recherche.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
    const resultats: ResultatRecherche[] = []

    const clients = db
      .prepare(
        `SELECT nom, email, telephone FROM clients
         WHERE nom LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR telephone LIKE ? ESCAPE '\\'
         ORDER BY nom LIMIT ?`
      )
      .all(motif, motif, motif, LIMITE_PAR_TYPE) as unknown as {
      nom: string
      email: string
      telephone: string
    }[]
    for (const c of clients) {
      resultats.push({
        type: 'client',
        module: 'clients',
        titre: c.nom,
        sousTitre: [c.email, c.telephone].filter(Boolean).join(' · ') || 'Client'
      })
    }

    const factures = db
      .prepare(
        `SELECT f.numero, f.date, f.statut, COALESCE(c.nom, '') AS client_nom
         FROM factures f LEFT JOIN clients c ON c.id = f.client_id
         WHERE f.numero LIKE ? ESCAPE '\\' OR c.nom LIKE ? ESCAPE '\\'
            OR EXISTS (SELECT 1 FROM facture_lignes l WHERE l.facture_id = f.id AND l.designation LIKE ? ESCAPE '\\')
         ORDER BY f.date DESC LIMIT ?`
      )
      .all(motif, motif, motif, LIMITE_PAR_TYPE) as unknown as {
      numero: string
      date: string
      statut: string
      client_nom: string
    }[]
    for (const f of factures) {
      resultats.push({
        type: 'facture',
        module: 'facturation',
        titre: `Facture ${f.numero}`,
        sousTitre: `${f.date} · ${f.client_nom || 'Sans client'} · ${f.statut}`
      })
    }

    const devis = db
      .prepare(
        `SELECT d.numero, d.date, d.statut, COALESCE(c.nom, '') AS client_nom
         FROM devis d LEFT JOIN clients c ON c.id = d.client_id
         WHERE d.numero LIKE ? ESCAPE '\\' OR c.nom LIKE ? ESCAPE '\\'
            OR EXISTS (SELECT 1 FROM devis_lignes l WHERE l.devis_id = d.id AND l.designation LIKE ? ESCAPE '\\')
         ORDER BY d.date DESC LIMIT ?`
      )
      .all(motif, motif, motif, LIMITE_PAR_TYPE) as unknown as {
      numero: string
      date: string
      statut: string
      client_nom: string
    }[]
    for (const d of devis) {
      resultats.push({
        type: 'devis',
        module: 'devis',
        titre: `Devis ${d.numero}`,
        sousTitre: `${d.date} · ${d.client_nom || 'Sans client'} · ${d.statut}`
      })
    }

    const articles = db
      .prepare(
        `SELECT reference, designation, quantite_stock, emplacement FROM inventaire
         WHERE reference LIKE ? ESCAPE '\\' OR designation LIKE ? ESCAPE '\\'
            OR fournisseur LIKE ? ESCAPE '\\' OR emplacement LIKE ? ESCAPE '\\'
         ORDER BY reference LIMIT ?`
      )
      .all(motif, motif, motif, motif, LIMITE_PAR_TYPE) as unknown as {
      reference: string
      designation: string
      quantite_stock: number
      emplacement: string
    }[]
    for (const a of articles) {
      resultats.push({
        type: 'article',
        module: 'inventaire',
        titre: `${a.reference} — ${a.designation}`,
        sousTitre: `${a.quantite_stock} en stock${a.emplacement ? ` · ${a.emplacement}` : ''}`
      })
    }

    const ecritures = db
      .prepare(
        `SELECT j.date, j.type, j.description, j.montant, COALESCE(c.libelle, '') AS categorie
         FROM journal j LEFT JOIN categories_journal c ON c.id = j.categorie_id
         WHERE j.description LIKE ? ESCAPE '\\' OR j.notes LIKE ? ESCAPE '\\'
            OR j.numero_facture LIKE ? ESCAPE '\\'
         ORDER BY j.date DESC LIMIT ?`
      )
      .all(motif, motif, motif, LIMITE_PAR_TYPE) as unknown as {
      date: string
      type: string
      description: string
      montant: number
      categorie: string
    }[]
    for (const e of ecritures) {
      resultats.push({
        type: 'ecriture',
        module: 'journal',
        titre: e.description || 'Écriture sans description',
        sousTitre: `${e.date} · ${e.type} · ${e.montant.toFixed(2)} CHF${e.categorie ? ` · ${e.categorie}` : ''}`
      })
    }

    const modeles = db
      .prepare(
        `SELECT m.nom, COUNT(l.id) AS nb FROM modeles_prestations m
         LEFT JOIN modele_lignes l ON l.modele_id = m.id
         WHERE m.nom LIKE ? ESCAPE '\\'
         GROUP BY m.id ORDER BY m.nom LIMIT ?`
      )
      .all(motif, LIMITE_PAR_TYPE) as unknown as { nom: string; nb: number }[]
    for (const m of modeles) {
      resultats.push({
        type: 'modele',
        module: 'modeles',
        titre: m.nom,
        sousTitre: `Modèle · ${m.nb} ligne(s)`
      })
    }

    return resultats
  })
}
