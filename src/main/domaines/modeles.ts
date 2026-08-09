import { dansUneTransaction, getDb } from '../db/database'
import { tracerAudit } from '../db/audit'
import type { ModeleLigne, ModelePrestation } from '../../shared/types'

/**
 * Modèles de prestations, sans Electron.
 * Voir `./clients.ts` pour la règle : rien de la fenêtre ici.
 */

interface LigneModeleDb {
  id: number
  designation: string
  reference_inventaire: string | null
  quantite: number
  prix_unitaire: number
}

function versModeleLigne(ligne: LigneModeleDb): ModeleLigne {
  return {
    id: ligne.id,
    designation: ligne.designation,
    referenceInventaire: ligne.reference_inventaire,
    quantite: ligne.quantite,
    prixUnitaire: ligne.prix_unitaire
  }
}

function chargerModele(id: number): ModelePrestation {
  const modele = getDb().prepare('SELECT * FROM modeles_prestations WHERE id = ?').get(id) as
    | { id: number; nom: string }
    | undefined
  if (!modele) throw new Error("Ce modèle n'existe pas ou a été supprimé.")

  const lignes = getDb()
    .prepare('SELECT * FROM modele_lignes WHERE modele_id = ? ORDER BY id')
    .all(id) as unknown as LigneModeleDb[]

  return { id: modele.id, nom: modele.nom, lignes: lignes.map(versModeleLigne) }
}

export function listerModeles(): ModelePrestation[] {
  const modeles = getDb()
    .prepare('SELECT id FROM modeles_prestations ORDER BY nom')
    .all() as unknown as { id: number }[]
  return modeles.map((m) => chargerModele(m.id))
}

export function creerModele(nom: string): ModelePrestation {
  if (!nom.trim()) throw new Error('Le nom du modèle est obligatoire.')

  const existe = getDb().prepare('SELECT 1 FROM modeles_prestations WHERE nom = ?').get(nom.trim())
  if (existe) throw new Error(`Un modèle nommé « ${nom.trim()} » existe déjà.`)

  const resultat = getDb().prepare('INSERT INTO modeles_prestations (nom) VALUES (?)').run(nom.trim())
  tracerAudit('creation', 'modele', nom.trim())
  return chargerModele(Number(resultat.lastInsertRowid))
}

export function enregistrerModele(modele: ModelePrestation): ModelePrestation {
  if (!modele.nom.trim()) throw new Error('Le nom du modèle est obligatoire.')

  const db = getDb()
  dansUneTransaction(() => {
    db.prepare('UPDATE modeles_prestations SET nom = ? WHERE id = ?').run(modele.nom.trim(), modele.id)
    db.prepare('DELETE FROM modele_lignes WHERE modele_id = ?').run(modele.id)

    const insererLigne = db.prepare(
      'INSERT INTO modele_lignes (modele_id, designation, reference_inventaire, quantite, prix_unitaire) VALUES (?, ?, ?, ?, ?)'
    )
    for (const ligne of modele.lignes) {
      if (!ligne.designation.trim()) continue
      insererLigne.run(
        modele.id,
        ligne.designation,
        ligne.referenceInventaire,
        ligne.quantite,
        ligne.prixUnitaire
      )
    }
  })

  return chargerModele(modele.id)
}

export function supprimerModele(id: number): void {
  getDb().prepare('DELETE FROM modeles_prestations WHERE id = ?').run(id)
}

/**
 * Crée un modèle à partir des lignes d'une facture existante :
 * le moyen le plus rapide de transformer un travail déjà fait en modèle réutilisable.
 */
export function creerModeleDepuisFacture(factureId: number, nom: string): ModelePrestation {
  if (!nom.trim()) throw new Error('Le nom du modèle est obligatoire.')

  const db = getDb()
  const lignes = db
    .prepare(
      'SELECT designation, reference_inventaire, quantite, prix_unitaire FROM facture_lignes WHERE facture_id = ? ORDER BY id'
    )
    .all(factureId) as unknown as Omit<LigneModeleDb, 'id'>[]
  if (lignes.length === 0) throw new Error('Cette facture ne contient aucune ligne à enregistrer.')

  return dansUneTransaction(() => {
    const resultat = db.prepare('INSERT INTO modeles_prestations (nom) VALUES (?)').run(nom.trim())
    const modeleId = Number(resultat.lastInsertRowid)

    const insererLigne = db.prepare(
      'INSERT INTO modele_lignes (modele_id, designation, reference_inventaire, quantite, prix_unitaire) VALUES (?, ?, ?, ?, ?)'
    )
    for (const ligne of lignes) {
      insererLigne.run(
        modeleId,
        ligne.designation,
        ligne.reference_inventaire,
        ligne.quantite,
        ligne.prix_unitaire
      )
    }

    tracerAudit('creation', 'modele', nom.trim(), `Depuis la facture id=${factureId}`)
    return chargerModele(modeleId)
  })
}
