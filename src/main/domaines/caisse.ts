import { dansUneTransaction, getDb } from '../db/database'
import { tracerAudit, verifierExerciceOuvert } from '../db/audit'
import { calculerReglement, calculerTotalCaisse } from '../../shared/caisse'
import { profilPays } from '../../shared/pays'
import type {
  DemandeVenteCaisse,
  LigneVenteCaisse,
  ModePaiement,
  PaiementCaisse,
  VenteCaisse
} from '../../shared/types'
import { lireEntreprise } from './entreprise'
import { ajouterCategorieJournal, ajouterEcritureJournal, listerCategoriesJournal } from './journal'

/**
 * Caisse, sans Electron.
 * Voir `./clients.ts` pour la règle : rien de la fenêtre ici.
 *
 * Une vente est **atomique** : vente, lignes, paiements, stock et Journal
 * s'écrivent ensemble ou pas du tout. Un exercice clôturé, par exemple,
 * refuse l'écriture au Journal — et toute la vente avec elle, sans quoi le
 * stock baisserait pour une vente qui n'existe pas.
 */

interface LigneVente {
  id: number
  numero: string
  date: string
  total: number
  statut: 'Validée' | 'Annulée'
  servi_par: string
  tva_pct: number
  montant_tva: number
}

interface LignePaiement {
  mode: ModePaiement
  montant: number
  arrondi: number
  devise_recue: string
  montant_recu: number
  taux: number
  rendu: number
}

const CATEGORIE_ESPECES = 'Caisse – espèces'
const CATEGORIE_CARTE = 'Caisse – carte'

/** Heure locale du poste, `YYYY-MM-DD HH:MM:SS` : l'UTC ferait changer de jour avant minuit. */
function maintenantLocal(): string {
  const d = new Date()
  const deux = (n: number): string => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())} ` +
    `${deux(d.getHours())}:${deux(d.getMinutes())}:${deux(d.getSeconds())}`
  )
}

function idCategorie(libelle: string): number {
  const existante = listerCategoriesJournal().find((c) => c.libelle === libelle)
  return existante ? existante.id : ajouterCategorieJournal(libelle).id
}

function versPaiement(ligne: LignePaiement): PaiementCaisse {
  return {
    mode: ligne.mode,
    montant: ligne.montant,
    arrondi: ligne.arrondi,
    deviseRecue: ligne.devise_recue,
    montantRecu: ligne.montant_recu,
    taux: ligne.taux,
    rendu: ligne.rendu
  }
}

export function lireVente(id: number): VenteCaisse {
  const db = getDb()
  const vente = db.prepare('SELECT * FROM ventes_caisse WHERE id = ?').get(id) as unknown as
    | LigneVente
    | undefined
  if (!vente) throw new Error('Vente introuvable.')

  const lignes = db
    .prepare(
      `SELECT reference_inventaire, designation, quantite, prix_unitaire
       FROM ventes_caisse_lignes WHERE vente_id = ? ORDER BY id`
    )
    .all(id) as unknown as {
    reference_inventaire: string
    designation: string
    quantite: number
    prix_unitaire: number
  }[]
  const paiements = db
    .prepare('SELECT * FROM ventes_caisse_paiements WHERE vente_id = ? ORDER BY id')
    .all(id) as unknown as LignePaiement[]

  return {
    id: vente.id,
    numero: vente.numero,
    date: vente.date,
    total: vente.total,
    statut: vente.statut,
    serviPar: vente.servi_par,
    tvaPct: vente.tva_pct,
    montantTva: vente.montant_tva,
    lignes: lignes.map(
      (l): LigneVenteCaisse => ({
        referenceInventaire: l.reference_inventaire,
        designation: l.designation,
        quantite: l.quantite,
        prixUnitaire: l.prix_unitaire
      })
    ),
    paiements: paiements.map(versPaiement),
    avertissements: []
  }
}

/** Les ventes, les plus récentes d'abord ; `date` (`YYYY-MM-DD`) restreint à un jour. */
export function listerVentes(date?: string): VenteCaisse[] {
  const lignes = (
    date
      ? getDb().prepare('SELECT id FROM ventes_caisse WHERE substr(date, 1, 10) = ? ORDER BY id DESC').all(date)
      : getDb().prepare('SELECT id FROM ventes_caisse ORDER BY id DESC').all()
  ) as unknown as { id: number }[]
  return lignes.map((l) => lireVente(l.id))
}

export function vendre(demande: DemandeVenteCaisse): VenteCaisse {
  if (!demande.lignes || demande.lignes.length === 0) throw new Error('Le panier est vide.')

  const entreprise = lireEntreprise()
  const profil = profilPays(entreprise.pays)
  const tvaPct = entreprise.assujettiTva ? entreprise.tvaDefautPct : 0

  return dansUneTransaction(() => {
    const db = getDb()
    const avertissements: string[] = []

    // Les prix viennent de la base, jamais de l'écran.
    const lignes = demande.lignes.map((demandee) => {
      const reference = demandee.referenceInventaire
      if (!Number.isFinite(demandee.quantite) || demandee.quantite <= 0) {
        throw new Error(`La quantité de « ${reference} » doit être supérieure à zéro.`)
      }
      const article = db
        .prepare('SELECT designation, prix_vente_unitaire FROM inventaire WHERE reference = ?')
        .get(reference) as { designation: string; prix_vente_unitaire: number } | undefined
      if (!article) throw new Error(`Article introuvable dans l'inventaire : « ${reference} ».`)
      return {
        referenceInventaire: reference,
        designation: article.designation,
        quantite: demandee.quantite,
        prixUnitaire: article.prix_vente_unitaire
      }
    })

    const { total, montantTva } = calculerTotalCaisse(lignes, entreprise.assujettiTva, tvaPct)
    const devise = demande.deviseRecue || profil.devise
    const reglement = calculerReglement({
      total,
      partCarte: demande.partCarte,
      devise,
      deviseEntreprise: profil.devise,
      taux: demande.taux,
      montantRecuEspeces: demande.montantRecuEspeces,
      arrondiSuisse: profil.devise === 'CHF'
    })

    const horodatage = maintenantLocal()
    const jour = horodatage.slice(0, 10)
    verifierExerciceOuvert(jour)

    const suivant = (db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM ventes_caisse').get() as { n: number }).n
    const numero = `T-${String(suivant).padStart(4, '0')}`
    const venteId = Number(
      db
        .prepare(
          `INSERT INTO ventes_caisse (numero, date, total, servi_par, tva_pct, montant_tva)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(numero, horodatage, total, entreprise.nomTicket, tvaPct, montantTva).lastInsertRowid
    )

    for (const ligne of lignes) {
      db.prepare(
        `INSERT INTO ventes_caisse_lignes (vente_id, reference_inventaire, designation, quantite, prix_unitaire)
         VALUES (?, ?, ?, ?, ?)`
      ).run(venteId, ligne.referenceInventaire, ligne.designation, ligne.quantite, ligne.prixUnitaire)

      // Comme pour une facture : on prévient d'un stock insuffisant sans bloquer
      // la vente, et le stock ne descend jamais sous zéro.
      const stock = (
        db.prepare('SELECT quantite_stock FROM inventaire WHERE reference = ?').get(ligne.referenceInventaire) as {
          quantite_stock: number
        }
      ).quantite_stock
      if (stock < ligne.quantite) {
        avertissements.push(
          `Stock insuffisant pour "${ligne.referenceInventaire}" (${stock} en stock, ${ligne.quantite} vendu).`
        )
      }
      db.prepare(
        "UPDATE inventaire SET quantite_stock = ?, derniere_maj = datetime('now') WHERE reference = ?"
      ).run(Math.max(0, stock - ligne.quantite), ligne.referenceInventaire)
    }

    const enregistrerPaiement = (paiement: PaiementCaisse, categorie: string): void => {
      const ecriture = ajouterEcritureJournal({
        date: jour,
        type: 'Entrée',
        categorieId: idCategorie(categorie),
        description: `Vente caisse ${numero} (${paiement.mode === 'Carte' ? 'carte' : 'espèces'})`,
        montant: paiement.montant,
        numeroFacture: null,
        notes: '',
        tvaPct
      })
      db.prepare(
        `INSERT INTO ventes_caisse_paiements
           (vente_id, mode, montant, arrondi, devise_recue, montant_recu, taux, rendu, ecriture_journal_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        venteId,
        paiement.mode,
        paiement.montant,
        paiement.arrondi,
        paiement.deviseRecue,
        paiement.montantRecu,
        paiement.taux,
        paiement.rendu,
        ecriture.id
      )
    }

    if (reglement.carte > 0) {
      enregistrerPaiement(
        {
          mode: 'Carte',
          montant: reglement.carte,
          arrondi: 0,
          deviseRecue: profil.devise,
          montantRecu: reglement.carte,
          taux: 1,
          rendu: 0
        },
        CATEGORIE_CARTE
      )
    }
    if (reglement.especes > 0) {
      enregistrerPaiement(
        {
          mode: 'Espèces',
          montant: reglement.especes,
          arrondi: reglement.arrondi,
          deviseRecue: devise,
          montantRecu: demande.montantRecuEspeces,
          taux: devise === profil.devise ? 1 : demande.taux,
          rendu: reglement.rendu
        },
        CATEGORIE_ESPECES
      )
    }

    tracerAudit('creation', 'vente_caisse', numero, `${total} ${profil.devise}`)

    return { ...lireVente(venteId), avertissements }
  })
}
