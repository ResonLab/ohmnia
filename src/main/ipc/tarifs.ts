import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import type { TarifDeplacement, TarifMainOeuvre, TarifProduit } from '../../shared/types'

interface LigneTarifProduit {
  id: number
  designation: string
  prix_achat: number
  marge_pct: number | null
  reference_inventaire: string | null
}

interface LigneTarifMainOeuvre {
  id: number
  description: string
  heures: number
  taux_horaire: number | null
}

interface LigneTarifDeplacement {
  id: number
  description: string
  distance_km: number
  prix_km: number | null
}

function versTarifProduit(ligne: LigneTarifProduit): TarifProduit {
  return {
    id: ligne.id,
    designation: ligne.designation,
    prixAchat: ligne.prix_achat,
    margePct: ligne.marge_pct,
    referenceInventaire: ligne.reference_inventaire
  }
}

function versTarifMainOeuvre(ligne: LigneTarifMainOeuvre): TarifMainOeuvre {
  return {
    id: ligne.id,
    description: ligne.description,
    heures: ligne.heures,
    tauxHoraire: ligne.taux_horaire
  }
}

function versTarifDeplacement(ligne: LigneTarifDeplacement): TarifDeplacement {
  return {
    id: ligne.id,
    description: ligne.description,
    distanceKm: ligne.distance_km,
    prixKm: ligne.prix_km
  }
}

export function enregistrerHandlersTarifs(): void {
  // --- Produits ---
  ipcMain.handle('tarifsProduits:lister', () => {
    const lignes = getDb()
      .prepare('SELECT * FROM tarifs_produits ORDER BY id')
      .all() as unknown as LigneTarifProduit[]
    return lignes.map(versTarifProduit)
  })

  ipcMain.handle('tarifsProduits:ajouter', (_e, tarif: Omit<TarifProduit, 'id'>) => {
    if (!tarif.designation.trim()) throw new Error('La désignation est obligatoire.')
    if (tarif.prixAchat < 0) throw new Error("Le prix d'achat ne peut pas être négatif.")

    const resultat = getDb()
      .prepare(
        'INSERT INTO tarifs_produits (designation, prix_achat, marge_pct, reference_inventaire) VALUES (?, ?, ?, ?)'
      )
      .run(
        tarif.designation,
        tarif.prixAchat,
        tarif.margePct,
        tarif.referenceInventaire?.trim() || null
      )

    const ligne = getDb()
      .prepare('SELECT * FROM tarifs_produits WHERE id = ?')
      .get(resultat.lastInsertRowid) as unknown as LigneTarifProduit
    return versTarifProduit(ligne)
  })

  ipcMain.handle('tarifsProduits:modifier', (_e, tarif: TarifProduit) => {
    if (!tarif.designation.trim()) throw new Error('La désignation est obligatoire.')
    if (tarif.prixAchat < 0) throw new Error("Le prix d'achat ne peut pas être négatif.")

    getDb()
      .prepare(
        'UPDATE tarifs_produits SET designation = ?, prix_achat = ?, marge_pct = ?, reference_inventaire = ? WHERE id = ?'
      )
      .run(
        tarif.designation,
        tarif.prixAchat,
        tarif.margePct,
        tarif.referenceInventaire?.trim() || null,
        tarif.id
      )
    return tarif
  })

  ipcMain.handle('tarifsProduits:supprimer', (_e, id: number) => {
    getDb().prepare('DELETE FROM tarifs_produits WHERE id = ?').run(id)
  })

  // --- Main d'oeuvre ---
  ipcMain.handle('tarifsMainOeuvre:lister', () => {
    const lignes = getDb()
      .prepare('SELECT * FROM tarifs_main_oeuvre ORDER BY id')
      .all() as unknown as LigneTarifMainOeuvre[]
    return lignes.map(versTarifMainOeuvre)
  })

  ipcMain.handle('tarifsMainOeuvre:ajouter', (_e, tarif: Omit<TarifMainOeuvre, 'id'>) => {
    if (!tarif.description.trim()) throw new Error('La description est obligatoire.')

    const resultat = getDb()
      .prepare('INSERT INTO tarifs_main_oeuvre (description, heures, taux_horaire) VALUES (?, ?, ?)')
      .run(tarif.description, tarif.heures, tarif.tauxHoraire)

    const ligne = getDb()
      .prepare('SELECT * FROM tarifs_main_oeuvre WHERE id = ?')
      .get(resultat.lastInsertRowid) as unknown as LigneTarifMainOeuvre
    return versTarifMainOeuvre(ligne)
  })

  ipcMain.handle('tarifsMainOeuvre:modifier', (_e, tarif: TarifMainOeuvre) => {
    if (!tarif.description.trim()) throw new Error('La description est obligatoire.')

    getDb()
      .prepare('UPDATE tarifs_main_oeuvre SET description = ?, heures = ?, taux_horaire = ? WHERE id = ?')
      .run(tarif.description, tarif.heures, tarif.tauxHoraire, tarif.id)
    return tarif
  })

  ipcMain.handle('tarifsMainOeuvre:supprimer', (_e, id: number) => {
    getDb().prepare('DELETE FROM tarifs_main_oeuvre WHERE id = ?').run(id)
  })

  // --- Déplacement ---
  ipcMain.handle('tarifsDeplacement:lister', () => {
    const lignes = getDb()
      .prepare('SELECT * FROM tarifs_deplacement ORDER BY id')
      .all() as unknown as LigneTarifDeplacement[]
    return lignes.map(versTarifDeplacement)
  })

  ipcMain.handle('tarifsDeplacement:ajouter', (_e, tarif: Omit<TarifDeplacement, 'id'>) => {
    if (!tarif.description.trim()) throw new Error('La description est obligatoire.')

    const resultat = getDb()
      .prepare('INSERT INTO tarifs_deplacement (description, distance_km, prix_km) VALUES (?, ?, ?)')
      .run(tarif.description, tarif.distanceKm, tarif.prixKm)

    const ligne = getDb()
      .prepare('SELECT * FROM tarifs_deplacement WHERE id = ?')
      .get(resultat.lastInsertRowid) as unknown as LigneTarifDeplacement
    return versTarifDeplacement(ligne)
  })

  ipcMain.handle('tarifsDeplacement:modifier', (_e, tarif: TarifDeplacement) => {
    if (!tarif.description.trim()) throw new Error('La description est obligatoire.')

    getDb()
      .prepare('UPDATE tarifs_deplacement SET description = ?, distance_km = ?, prix_km = ? WHERE id = ?')
      .run(tarif.description, tarif.distanceKm, tarif.prixKm, tarif.id)
    return tarif
  })

  ipcMain.handle('tarifsDeplacement:supprimer', (_e, id: number) => {
    getDb().prepare('DELETE FROM tarifs_deplacement WHERE id = ?').run(id)
  })
}
