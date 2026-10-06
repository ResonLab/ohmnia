import { dansUneTransaction, getDb } from '../db/database'
import { lireParametresApp } from './parametresApp'
import { tracerAudit, verifierExerciceOuvert } from '../db/audit'
import { calculerPrixFactureImpression, calculerTotalDocument } from '../../shared/calculs'
import type { Facture, FactureDetail, FactureLigne, HistoriqueFacture } from '../../shared/types'

/**
 * Factures, sans Electron.
 * Voir `./clients.ts` pour la règle : rien de la fenêtre ici.
 */

interface LigneFactureDb {
  id: number
  numero: string
  date: string
  client_id: number
  delai_paiement_jours: number
  remise_pct: number
  remise_montant: number
  impression_incluse: number
  tva_pct: number
  statut: Facture['statut']
  notes_internes: string
  stock_deduit: number
}

interface LigneFactureLigneDb {
  id: number
  designation: string
  reference_inventaire: string | null
  quantite: number
  prix_unitaire: number
}

function versFacture(ligne: LigneFactureDb): Facture {
  return {
    id: ligne.id,
    numero: ligne.numero,
    date: ligne.date,
    clientId: ligne.client_id,
    delaiPaiementJours: ligne.delai_paiement_jours,
    remisePct: ligne.remise_pct,
    remiseMontant: ligne.remise_montant,
    impressionIncluse: ligne.impression_incluse === 1,
    tvaPct: ligne.tva_pct,
    statut: ligne.statut,
    notesInternes: ligne.notes_internes,
    stockDeduit: ligne.stock_deduit === 1
  }
}

function versFactureLigne(ligne: LigneFactureLigneDb): FactureLigne {
  return {
    id: ligne.id,
    designation: ligne.designation,
    referenceInventaire: ligne.reference_inventaire,
    quantite: ligne.quantite,
    prixUnitaire: ligne.prix_unitaire
  }
}

function prochainNumero(prefixe: string): string {
  const lignes = getDb()
    .prepare("SELECT numero FROM factures WHERE numero LIKE ? || '%'")
    .all(prefixe) as unknown as { numero: string }[]

  let maxSuffixe = 0
  for (const { numero } of lignes) {
    const suffixe = Number(numero.slice(prefixe.length))
    if (Number.isFinite(suffixe) && suffixe > maxSuffixe) maxSuffixe = suffixe
  }
  return `${prefixe}${String(maxSuffixe + 1).padStart(4, '0')}`
}

function validerFacture(facture: Omit<Facture, 'id' | 'stockDeduit'>): string | null {
  if (!facture.numero.trim()) return 'Le numéro de facture est obligatoire.'
  if (!facture.date) return 'La date est obligatoire.'
  if (!facture.clientId) return 'Un client doit être sélectionné.'
  if (facture.remisePct < 0 || facture.remisePct > 100)
    return 'La remise doit être comprise entre 0 et 100%.'
  if (facture.remiseMontant < 0) return 'La remise en montant ne peut pas être négative.'
  if (facture.tvaPct < 0 || facture.tvaPct > 100) return 'La TVA doit être comprise entre 0 et 100%.'
  return null
}

export function chargerDetailFacture(id: number): FactureDetail {
  const ligne = getDb().prepare('SELECT * FROM factures WHERE id = ?').get(id) as unknown as
    | LigneFactureDb
    | undefined
  if (!ligne) throw new Error("Cette facture n'existe pas ou a été supprimée.")

  const lignes = getDb()
    .prepare('SELECT * FROM facture_lignes WHERE facture_id = ? ORDER BY id')
    .all(id) as unknown as LigneFactureLigneDb[]

  return { ...versFacture(ligne), lignes: lignes.map(versFactureLigne) }
}

export function prochainNumeroFacture(): string {
  const entreprise = getDb().prepare('SELECT prefixe_facture FROM entreprise WHERE id = 1').get() as {
    prefixe_facture: string
  }
  return prochainNumero(entreprise.prefixe_facture)
}

export function creerBrouillonFacture(clientId: number): FactureDetail {
  const entreprise = getDb()
    .prepare('SELECT prefixe_facture, tva_defaut_pct FROM entreprise WHERE id = 1')
    .get() as { prefixe_facture: string; tva_defaut_pct: number }

  const numero = prochainNumero(entreprise.prefixe_facture)
  const date = new Date().toISOString().slice(0, 10)
  const { delaiPaiementDefaut } = lireParametresApp()

  const resultat = getDb()
    .prepare(
      `INSERT INTO factures (numero, date, client_id, delai_paiement_jours, remise_pct, impression_incluse, tva_pct, statut, notes_internes)
       VALUES (?, ?, ?, ?, 0, 0, ?, 'Brouillon', '')`
    )
    .run(numero, date, clientId, delaiPaiementDefaut, entreprise.tva_defaut_pct)

  return chargerDetailFacture(Number(resultat.lastInsertRowid))
}

export function dupliquerFacture(id: number): FactureDetail {
  const source = chargerDetailFacture(id)
  const entreprise = getDb().prepare('SELECT prefixe_facture FROM entreprise WHERE id = 1').get() as {
    prefixe_facture: string
  }
  const db = getDb()

  return dansUneTransaction(() => {
    const numero = prochainNumero(entreprise.prefixe_facture)
    const resultat = db
      .prepare(
        `INSERT INTO factures (numero, date, client_id, delai_paiement_jours, remise_pct, remise_montant, impression_incluse, tva_pct, statut, notes_internes)
         VALUES (?, date('now'), ?, ?, ?, ?, ?, ?, 'Brouillon', ?)`
      )
      .run(
        numero,
        source.clientId,
        source.delaiPaiementJours,
        source.remisePct,
        source.remiseMontant,
        source.impressionIncluse ? 1 : 0,
        source.tvaPct,
        source.notesInternes
      )

    const nouvelId = Number(resultat.lastInsertRowid)
    const insererLigne = db.prepare(
      'INSERT INTO facture_lignes (facture_id, designation, reference_inventaire, quantite, prix_unitaire) VALUES (?, ?, ?, ?, ?)'
    )
    for (const ligne of source.lignes) {
      insererLigne.run(
        nouvelId,
        ligne.designation,
        ligne.referenceInventaire,
        ligne.quantite,
        ligne.prixUnitaire
      )
    }

    tracerAudit('duplication', 'facture', numero, `Copie de la facture ${source.numero}`)
    return chargerDetailFacture(nouvelId)
  })
}

/**
 * Convertit un devis en facture. Le devis reste intact ; la facture garde un lien
 * vers lui pour retrouver son origine.
 */
export function creerFactureDepuisDevis(devisId: number): FactureDetail {
  const db = getDb()
  const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(devisId) as
    | {
        id: number
        numero: string
        client_id: number
        remise_pct: number
        remise_montant: number
        tva_pct: number
      }
    | undefined
  if (!devis) throw new Error("Ce devis n'existe pas ou a été supprimé.")

  const dejaConvertie = db
    .prepare('SELECT numero FROM factures WHERE devis_origine_id = ?')
    .get(devisId) as { numero: string } | undefined
  if (dejaConvertie) {
    throw new Error(
      `Ce devis a déjà été converti en facture (${dejaConvertie.numero}). ` +
        'Ouvrez cette facture ou dupliquez-la si vous voulez en créer une seconde.'
    )
  }

  const entreprise = db.prepare('SELECT prefixe_facture FROM entreprise WHERE id = 1').get() as {
    prefixe_facture: string
  }
  const { delaiPaiementDefaut } = lireParametresApp()

  const lignesDevis = db
    .prepare(
      'SELECT designation, quantite, prix_unitaire FROM devis_lignes WHERE devis_id = ? ORDER BY id'
    )
    .all(devisId) as unknown as { designation: string; quantite: number; prix_unitaire: number }[]

  return dansUneTransaction(() => {
    const numero = prochainNumero(entreprise.prefixe_facture)
    const resultat = db
      .prepare(
        `INSERT INTO factures (numero, date, client_id, delai_paiement_jours, remise_pct, remise_montant, impression_incluse, tva_pct, statut, notes_internes, devis_origine_id)
         VALUES (?, date('now'), ?, ?, ?, ?, 0, ?, 'Brouillon', ?, ?)`
      )
      .run(
        numero,
        devis.client_id,
        delaiPaiementDefaut,
        devis.remise_pct,
        devis.remise_montant,
        devis.tva_pct,
        `Issue du devis ${devis.numero}`,
        devisId
      )

    const nouvelId = Number(resultat.lastInsertRowid)
    const insererLigne = db.prepare(
      'INSERT INTO facture_lignes (facture_id, designation, reference_inventaire, quantite, prix_unitaire) VALUES (?, ?, NULL, ?, ?)'
    )
    for (const ligne of lignesDevis) {
      insererLigne.run(nouvelId, ligne.designation, ligne.quantite, ligne.prix_unitaire)
    }

    tracerAudit('conversion', 'facture', numero, `Créée depuis le devis ${devis.numero}`)
    return chargerDetailFacture(nouvelId)
  })
}

export function enregistrerFacture(detail: FactureDetail): FactureDetail {
  const erreur = validerFacture(detail)
  if (erreur) throw new Error(erreur)

  const db = getDb()
  dansUneTransaction(() => {
    db.prepare(
      `UPDATE factures SET
        numero = ?, date = ?, client_id = ?, delai_paiement_jours = ?, remise_pct = ?, remise_montant = ?,
        impression_incluse = ?, tva_pct = ?, statut = ?, notes_internes = ?
       WHERE id = ?`
    ).run(
      detail.numero,
      detail.date,
      detail.clientId,
      detail.delaiPaiementJours,
      detail.remisePct,
      detail.remiseMontant,
      detail.impressionIncluse ? 1 : 0,
      detail.tvaPct,
      detail.statut,
      detail.notesInternes,
      detail.id
    )

    db.prepare('DELETE FROM facture_lignes WHERE facture_id = ?').run(detail.id)
    const insererLigne = db.prepare(
      'INSERT INTO facture_lignes (facture_id, designation, reference_inventaire, quantite, prix_unitaire) VALUES (?, ?, ?, ?, ?)'
    )
    for (const ligne of detail.lignes) {
      if (!ligne.designation.trim()) continue
      // Une référence vide est stockée comme NULL, jamais comme chaîne vide :
      // cela garde les données propres et les comparaisons prévisibles.
      const reference = ligne.referenceInventaire?.trim() || null
      insererLigne.run(detail.id, ligne.designation, reference, ligne.quantite, ligne.prixUnitaire)
    }
  })

  return chargerDetailFacture(detail.id)
}

export function supprimerFacture(id: number): void {
  getDb().prepare('DELETE FROM factures WHERE id = ?').run(id)
}

/**
 * Les frais d'impression ne s'ajoutent au total que si la facture les inclut.
 * Un seul endroit les calcule : le total affiché, le montant à encaisser et
 * l'entrée au Journal doivent donner le même chiffre.
 */
function fraisImpressionDe(detail: FactureDetail): number {
  if (!detail.impressionIncluse) return 0
  const p = getDb().prepare('SELECT * FROM parametres_impression WHERE id = 1').get() as {
    prix_sachet_a4: number
    feuilles_par_sachet: number
    feuilles_par_facture: number
    prix_imprimante: number
    nb_factures_avant_remplacement: number
    prix_encre: number
    feuilles_par_cartouche: number
    prix_timbre: number
    prix_sachet_enveloppes: number
    nb_enveloppes_par_sachet: number
    marge_impression_pct: number
  }
  return calculerPrixFactureImpression({
    prixSachetA4: p.prix_sachet_a4,
    feuillesParSachet: p.feuilles_par_sachet,
    feuillesParFacture: p.feuilles_par_facture,
    prixImprimante: p.prix_imprimante,
    nbFacturesAvantRemplacement: p.nb_factures_avant_remplacement,
    prixEncre: p.prix_encre,
    feuillesParCartouche: p.feuilles_par_cartouche,
    prixTimbre: p.prix_timbre,
    prixSachetEnveloppes: p.prix_sachet_enveloppes,
    nbEnveloppesParSachet: p.nb_enveloppes_par_sachet,
    margeImpressionPct: p.marge_impression_pct
  })
}

/**
 * Le montant TTC d'une facture, calculé depuis ses lignes.
 *
 * **Il ne vient plus du Journal.** Le Journal n'a une écriture qu'une fois la
 * facture payée : une facture envoyée et pas encore encaissée n'y figure pas, et
 * son montant à encaisser doit pourtant s'afficher. Les lignes sont la seule
 * source qui existe à chaque étape.
 */
export function totalFacture(id: number): number {
  const detail = chargerDetailFacture(id)
  return calculerTotalDocument(
    detail.lignes,
    detail.remisePct,
    detail.tvaPct,
    fraisImpressionDe(detail),
    detail.remiseMontant
  ).total
}

/** Déduit le stock des articles facturés, une seule fois par facture. */
function deduireStockUneFois(detail: FactureDetail): string[] {
  const db = getDb()
  const avertissements: string[] = []
  if (detail.stockDeduit) return avertissements

  for (const ligne of detail.lignes) {
    if (!ligne.referenceInventaire) continue
    const article = db
      .prepare('SELECT quantite_stock FROM inventaire WHERE reference = ?')
      .get(ligne.referenceInventaire) as { quantite_stock: number } | undefined

    if (!article) {
      avertissements.push(`Référence "${ligne.referenceInventaire}" introuvable dans l'inventaire.`)
      continue
    }
    if (article.quantite_stock < ligne.quantite) {
      avertissements.push(
        `Stock insuffisant pour "${ligne.referenceInventaire}" (${article.quantite_stock} en stock, ${ligne.quantite} facturé).`
      )
    }
    db.prepare(
      "UPDATE inventaire SET quantite_stock = quantite_stock - ?, derniere_maj = datetime('now') WHERE reference = ?"
    ).run(ligne.quantite, ligne.referenceInventaire)
  }
  db.prepare('UPDATE factures SET stock_deduit = 1 WHERE id = ?').run(detail.id)
  return avertissements
}

/**
 * Change le statut d'une facture.
 *
 * **Passer à « Payée » est le seul moment où l'argent entre au Journal.** Une
 * facture brouillon ou envoyée n'est pas une entrée d'argent : la compter ici
 * faisait monter le chiffre d'affaires d'une facture que personne n'avait payée.
 * Si une écriture existe déjà (factures d'avant ce changement), elle est gardée
 * et rien n'est dupliqué. Le stock est déduit si ça n'a pas encore été fait.
 */
export function changerStatutFacture(
  id: number,
  statut: Facture['statut']
): { entreeAjoutee: boolean; total: number; avertissements: string[] } {
  const db = getDb()
  const detail = chargerDetailFacture(id)
  let entreeAjoutee = false
  let avertissements: string[] = []
  const total = totalFacture(id)

  dansUneTransaction(() => {
    if (statut === 'Payée') {
      const dejaDansJournal = db
        .prepare('SELECT COUNT(*) AS n FROM journal WHERE numero_facture = ?')
        .get(detail.numero) as { n: number }

      if (dejaDansJournal.n === 0) {
        const aujourdhui = new Date().toISOString().slice(0, 10)
        verifierExerciceOuvert(aujourdhui)
        db.prepare(
          `INSERT INTO journal (date, type, categorie_id, description, montant, numero_facture, notes, tva_pct)
           VALUES (?, 'Entrée', (SELECT id FROM categories_journal WHERE libelle = 'Facture client'), ?, ?, ?, '', ?)`
        ).run(aujourdhui, `Facture ${detail.numero}`, total, detail.numero, detail.tvaPct)
        entreeAjoutee = true
      }
      avertissements = deduireStockUneFois(detail)
    }
    db.prepare('UPDATE factures SET statut = ? WHERE id = ?').run(statut, id)
  })

  return { entreeAjoutee, total, avertissements }
}

export function historiqueFactures(): HistoriqueFacture[] {
  const lignes = getDb()
    .prepare(
      `SELECT f.*, c.nom AS client_nom
       FROM factures f
       LEFT JOIN clients c ON c.id = f.client_id
       ORDER BY f.date DESC, f.id DESC`
    )
    .all() as unknown as (LigneFactureDb & { client_nom: string | null })[]

  const maintenant = Date.now()
  return lignes.map((ligne): HistoriqueFacture => {
    const facture = versFacture(ligne)
    let joursEnAttente: number | null = null
    if (facture.statut === 'Envoyée') {
      joursEnAttente = Math.floor(
        (maintenant - new Date(facture.date).getTime()) / (1000 * 60 * 60 * 24)
      )
    }
    return {
      ...facture,
      clientNom: ligne.client_nom ?? 'Client supprimé',
      montant: totalFacture(ligne.id),
      joursEnAttente
    }
  })
}

/**
 * Marque la facture comme envoyée au client : elle quitte l'état de brouillon.
 * Le stock des articles facturés est déduit (une seule fois). **Le Journal n'est
 * pas touché** — l'entrée d'argent n'existe qu'au paiement.
 */
export function confirmerEnregistrementHistorique(id: number): {
  avertissements: string[]
  total: number
} {
  const db = getDb()
  const detail = chargerDetailFacture(id)
  let avertissements: string[] = []

  dansUneTransaction(() => {
    avertissements = deduireStockUneFois(detail)
    // On ne fait jamais reculer une facture déjà payée ou annulée.
    if (detail.statut === 'Brouillon') {
      db.prepare("UPDATE factures SET statut = 'Envoyée' WHERE id = ?").run(id)
    }
  })

  return { avertissements, total: totalFacture(id) }
}
