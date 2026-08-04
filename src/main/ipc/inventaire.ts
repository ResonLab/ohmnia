import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import type { ArticleInventaire, ResumeInventaire } from '../../shared/types'

interface LigneInventaire {
  reference: string
  designation: string
  categorie: string
  quantite_stock: number
  seuil_alerte: number
  prix_achat_unitaire: number
  prix_vente_unitaire: number
  fournisseur: string
  emplacement: string
  derniere_maj: string
}

function versArticle(ligne: LigneInventaire): ArticleInventaire {
  return {
    reference: ligne.reference,
    designation: ligne.designation,
    categorie: ligne.categorie,
    quantiteStock: ligne.quantite_stock,
    seuilAlerte: ligne.seuil_alerte,
    prixAchatUnitaire: ligne.prix_achat_unitaire,
    prixVenteUnitaire: ligne.prix_vente_unitaire,
    fournisseur: ligne.fournisseur,
    emplacement: ligne.emplacement,
    derniereMaj: ligne.derniere_maj
  }
}

function validerArticle(article: ArticleInventaire): string | null {
  if (!article.reference.trim()) return 'La référence est obligatoire.'
  if (!article.designation.trim()) return 'La désignation est obligatoire.'
  if (article.quantiteStock < 0) return 'La quantité en stock ne peut pas être négative.'
  if (article.seuilAlerte < 0) return "Le seuil d'alerte ne peut pas être négatif."
  if (article.prixAchatUnitaire < 0 || article.prixVenteUnitaire < 0) {
    return 'Les prix ne peuvent pas être négatifs.'
  }
  return null
}

/** Suggère une référence libre du type ART-0001 basée sur les références existantes. */
function referenceSuggeree(): string {
  const lignes = getDb()
    .prepare("SELECT reference FROM inventaire WHERE reference LIKE 'ART-%'")
    .all() as unknown as { reference: string }[]

  let maxSuffixe = 0
  for (const { reference } of lignes) {
    const suffixe = Number(reference.slice(4))
    if (Number.isFinite(suffixe) && suffixe > maxSuffixe) maxSuffixe = suffixe
  }
  return `ART-${String(maxSuffixe + 1).padStart(4, '0')}`
}

export function enregistrerHandlersInventaire(): void {
  ipcMain.handle('inventaire:lister', () => {
    const lignes = getDb()
      .prepare('SELECT * FROM inventaire ORDER BY reference')
      .all() as unknown as LigneInventaire[]
    return lignes.map(versArticle)
  })

  ipcMain.handle('inventaire:referenceSuggeree', () => referenceSuggeree())

  ipcMain.handle('inventaire:ajouter', (_e, article: ArticleInventaire) => {
    const erreur = validerArticle(article)
    if (erreur) throw new Error(erreur)

    const existe = getDb()
      .prepare('SELECT 1 FROM inventaire WHERE reference = ?')
      .get(article.reference)
    if (existe) throw new Error(`La référence "${article.reference}" existe déjà dans l'inventaire.`)

    getDb()
      .prepare(
        `INSERT INTO inventaire
          (reference, designation, categorie, quantite_stock, seuil_alerte,
           prix_achat_unitaire, prix_vente_unitaire, fournisseur, emplacement, derniere_maj)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        article.reference,
        article.designation,
        article.categorie,
        article.quantiteStock,
        article.seuilAlerte,
        article.prixAchatUnitaire,
        article.prixVenteUnitaire,
        article.fournisseur,
        article.emplacement
      )

    const ligne = getDb()
      .prepare('SELECT * FROM inventaire WHERE reference = ?')
      .get(article.reference) as unknown as LigneInventaire
    return versArticle(ligne)
  })

  // referenceOrigine permet de renommer une référence tout en gardant la ligne.
  ipcMain.handle('inventaire:modifier', (_e, referenceOrigine: string, article: ArticleInventaire) => {
    const erreur = validerArticle(article)
    if (erreur) throw new Error(erreur)

    getDb()
      .prepare(
        `UPDATE inventaire SET
          reference = ?, designation = ?, categorie = ?, quantite_stock = ?, seuil_alerte = ?,
          prix_achat_unitaire = ?, prix_vente_unitaire = ?, fournisseur = ?, emplacement = ?,
          derniere_maj = datetime('now')
         WHERE reference = ?`
      )
      .run(
        article.reference,
        article.designation,
        article.categorie,
        article.quantiteStock,
        article.seuilAlerte,
        article.prixAchatUnitaire,
        article.prixVenteUnitaire,
        article.fournisseur,
        article.emplacement,
        referenceOrigine
      )

    const ligne = getDb()
      .prepare('SELECT * FROM inventaire WHERE reference = ?')
      .get(article.reference) as unknown as LigneInventaire
    return versArticle(ligne)
  })

  ipcMain.handle('inventaire:supprimer', (_e, reference: string) => {
    getDb().prepare('DELETE FROM inventaire WHERE reference = ?').run(reference)
  })

  ipcMain.handle('inventaire:resume', () => {
    const resultat = getDb()
      .prepare(
        `SELECT
          COALESCE(SUM(quantite_stock * prix_achat_unitaire), 0) AS valeur_totale,
          COALESCE(SUM(CASE WHEN quantite_stock <= seuil_alerte THEN 1 ELSE 0 END), 0) AS nb_sous_seuil
         FROM inventaire`
      )
      .get() as { valeur_totale: number; nb_sous_seuil: number }

    return {
      valeurTotaleStock: resultat.valeur_totale,
      nbReferencesSousSeuil: resultat.nb_sous_seuil
    } satisfies ResumeInventaire
  })
}
