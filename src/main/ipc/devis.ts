import { ipcMain } from 'electron'
import { dansUneTransaction, getDb } from '../db/database'
import { lireParametresApp } from './parametresApp'
import { tracerAudit } from '../db/audit'
import { calculerTotalDocument } from '../../shared/calculs'
import type { Devis, DevisDetail, DevisLigne, HistoriqueDevis } from '../../shared/types'

interface LigneDevisDb {
  id: number
  numero: string
  date: string
  client_id: number
  validite_jours: number
  remise_pct: number
  tva_pct: number
  statut: Devis['statut']
}

interface LigneDevisLigneDb {
  id: number
  designation: string
  quantite: number
  prix_unitaire: number
}

function versDevis(ligne: LigneDevisDb): Devis {
  return {
    id: ligne.id,
    numero: ligne.numero,
    date: ligne.date,
    clientId: ligne.client_id,
    validiteJours: ligne.validite_jours,
    remisePct: ligne.remise_pct,
    tvaPct: ligne.tva_pct,
    statut: ligne.statut
  }
}

function versDevisLigne(ligne: LigneDevisLigneDb): DevisLigne {
  return { id: ligne.id, designation: ligne.designation, quantite: ligne.quantite, prixUnitaire: ligne.prix_unitaire }
}

function prochainNumero(prefixe: string): string {
  const lignes = getDb()
    .prepare("SELECT numero FROM devis WHERE numero LIKE ? || '%'")
    .all(prefixe) as unknown as { numero: string }[]

  let maxSuffixe = 0
  for (const { numero } of lignes) {
    const suffixe = Number(numero.slice(prefixe.length))
    if (Number.isFinite(suffixe) && suffixe > maxSuffixe) maxSuffixe = suffixe
  }
  return `${prefixe}${String(maxSuffixe + 1).padStart(4, '0')}`
}

function validerDevis(devis: Omit<Devis, 'id'>): string | null {
  if (!devis.numero.trim()) return 'Le numéro de devis est obligatoire.'
  if (!devis.date) return 'La date est obligatoire.'
  if (!devis.clientId) return 'Un client doit être sélectionné.'
  if (devis.remisePct < 0 || devis.remisePct > 100) return 'La remise doit être comprise entre 0 et 100%.'
  if (devis.tvaPct < 0 || devis.tvaPct > 100) return 'La TVA doit être comprise entre 0 et 100%.'
  return null
}

function chargerDetail(id: number): DevisDetail {
  const ligne = getDb().prepare('SELECT * FROM devis WHERE id = ?').get(id) as unknown as LigneDevisDb | undefined
  if (!ligne) throw new Error("Ce devis n'existe pas ou a été supprimé.")

  const lignes = getDb()
    .prepare('SELECT * FROM devis_lignes WHERE devis_id = ? ORDER BY id')
    .all(id) as unknown as LigneDevisLigneDb[]

  return { ...versDevis(ligne), lignes: lignes.map(versDevisLigne) }
}

export function enregistrerHandlersDevis(): void {
  ipcMain.handle('devis:prochainNumero', () => {
    const entreprise = getDb().prepare('SELECT prefixe_devis FROM entreprise WHERE id = 1').get() as {
      prefixe_devis: string
    }
    return prochainNumero(entreprise.prefixe_devis)
  })

  ipcMain.handle('devis:creerBrouillon', (_e, clientId: number) => {
    const entreprise = getDb()
      .prepare('SELECT prefixe_devis, tva_defaut_pct FROM entreprise WHERE id = 1')
      .get() as { prefixe_devis: string; tva_defaut_pct: number }

    const numero = prochainNumero(entreprise.prefixe_devis)
    const date = new Date().toISOString().slice(0, 10)
    const { validiteDevisDefaut } = lireParametresApp()

    const resultat = getDb()
      .prepare(
        `INSERT INTO devis (numero, date, client_id, validite_jours, remise_pct, tva_pct, statut)
         VALUES (?, ?, ?, ?, 0, ?, 'En attente')`
      )
      .run(numero, date, clientId, validiteDevisDefaut, entreprise.tva_defaut_pct)

    return chargerDetail(Number(resultat.lastInsertRowid))
  })

  ipcMain.handle('devis:obtenirDetail', (_e, id: number) => chargerDetail(id))

  ipcMain.handle('devis:dupliquer', (_e, id: number) => {
    const source = chargerDetail(id)
    const db = getDb()
    const entreprise = db.prepare('SELECT prefixe_devis FROM entreprise WHERE id = 1').get() as {
      prefixe_devis: string
    }

    return dansUneTransaction(() => {
      const numero = prochainNumero(entreprise.prefixe_devis)
      const resultat = db
        .prepare(
          `INSERT INTO devis (numero, date, client_id, validite_jours, remise_pct, tva_pct, statut)
           VALUES (?, date('now'), ?, ?, ?, ?, 'En attente')`
        )
        .run(numero, source.clientId, source.validiteJours, source.remisePct, source.tvaPct)

      const nouvelId = Number(resultat.lastInsertRowid)
      const insererLigne = db.prepare(
        'INSERT INTO devis_lignes (devis_id, designation, quantite, prix_unitaire) VALUES (?, ?, ?, ?)'
      )
      for (const ligne of source.lignes) {
        insererLigne.run(nouvelId, ligne.designation, ligne.quantite, ligne.prixUnitaire)
      }

      tracerAudit('duplication', 'devis', numero, `Copie du devis ${source.numero}`)
      return chargerDetail(nouvelId)
    })
  })

  ipcMain.handle('devis:enregistrer', (_e, detail: DevisDetail) => {
    const erreur = validerDevis(detail)
    if (erreur) throw new Error(erreur)

    const db = getDb()
    dansUneTransaction(() => {
      db.prepare(
        `UPDATE devis SET numero = ?, date = ?, client_id = ?, validite_jours = ?, remise_pct = ?, tva_pct = ?, statut = ?
         WHERE id = ?`
      ).run(detail.numero, detail.date, detail.clientId, detail.validiteJours, detail.remisePct, detail.tvaPct, detail.statut, detail.id)

      db.prepare('DELETE FROM devis_lignes WHERE devis_id = ?').run(detail.id)
      const insererLigne = db.prepare(
        'INSERT INTO devis_lignes (devis_id, designation, quantite, prix_unitaire) VALUES (?, ?, ?, ?)'
      )
      for (const ligne of detail.lignes) {
        if (!ligne.designation.trim()) continue
        insererLigne.run(detail.id, ligne.designation, ligne.quantite, ligne.prixUnitaire)
      }
    })

    return chargerDetail(detail.id)
  })

  ipcMain.handle('devis:supprimer', (_e, id: number) => {
    getDb().prepare('DELETE FROM devis WHERE id = ?').run(id)
  })

  ipcMain.handle('devis:changerStatut', (_e, id: number, statut: Devis['statut']) => {
    getDb().prepare('UPDATE devis SET statut = ? WHERE id = ?').run(statut, id)
  })

  ipcMain.handle('devis:historique', () => {
    const lignes = getDb()
      .prepare(
        `SELECT d.*, c.nom AS client_nom,
          (SELECT f.numero FROM factures f WHERE f.devis_origine_id = d.id) AS facture_liee
         FROM devis d
         LEFT JOIN clients c ON c.id = d.client_id
         ORDER BY d.date DESC, d.id DESC`
      )
      .all() as unknown as (LigneDevisDb & { client_nom: string | null; facture_liee: string | null })[]

    return lignes.map((ligne): HistoriqueDevis => {
      const devisLignes = getDb()
        .prepare('SELECT * FROM devis_lignes WHERE devis_id = ?')
        .all(ligne.id) as unknown as LigneDevisLigneDb[]
      const { total } = calculerTotalDocument(
        devisLignes.map(versDevisLigne),
        ligne.remise_pct,
        ligne.tva_pct
      )
      return {
        ...versDevis(ligne),
        clientNom: ligne.client_nom ?? 'Client supprimé',
        total,
        factureLiee: ligne.facture_liee
      }
    })
  })
}
