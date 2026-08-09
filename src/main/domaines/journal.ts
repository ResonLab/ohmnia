import { getDb } from '../db/database'
import { calculerMontantTva } from '../../shared/calculs'
import { tracerAudit, verifierExerciceOuvert } from '../db/audit'
import type {
  CategorieJournal,
  EcritureJournal,
  EvolutionAnnuelle,
  FiltresJournal,
  RepartitionCategorie
} from '../../shared/types'

/**
 * Journal et catégories, sans Electron.
 * Voir `./clients.ts` pour la règle : rien de la fenêtre ici.
 */

interface LigneJournal {
  id: number
  date: string
  annee: number
  type: 'Entrée' | 'Dépense'
  categorie_id: number | null
  categorie_libelle: string | null
  description: string
  montant: number
  numero_facture: string | null
  notes: string
  tva_pct: number | null
}

/** Valeurs d'une écriture telles que l'interface les envoie, sans les champs calculés. */
type ValeursEcriture = Omit<EcritureJournal, 'id' | 'annee' | 'categorieLibelle' | 'montantTva'>

function versEcriture(ligne: LigneJournal): EcritureJournal {
  return {
    id: ligne.id,
    date: ligne.date,
    annee: ligne.annee,
    type: ligne.type,
    categorieId: ligne.categorie_id,
    categorieLibelle: ligne.categorie_libelle,
    description: ligne.description,
    montant: ligne.montant,
    numeroFacture: ligne.numero_facture,
    notes: ligne.notes,
    tvaPct: ligne.tva_pct,
    montantTva: ligne.tva_pct ? calculerMontantTva(ligne.montant, ligne.tva_pct) : 0
  }
}

function construireClauseFiltres(filtres: FiltresJournal): {
  clause: string
  params: (string | number)[]
} {
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (filtres.annee !== undefined) {
    conditions.push("CAST(strftime('%Y', j.date) AS INTEGER) = ?")
    params.push(filtres.annee)
  }
  if (filtres.type) {
    conditions.push('j.type = ?')
    params.push(filtres.type)
  }
  if (filtres.categorieId !== undefined) {
    conditions.push('j.categorie_id = ?')
    params.push(filtres.categorieId)
  }

  return { clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params }
}

function validerEcriture(valeurs: ValeursEcriture): string | null {
  if (!valeurs.date) return 'La date est obligatoire.'
  if (valeurs.type !== 'Entrée' && valeurs.type !== 'Dépense')
    return 'Le type doit être Entrée ou Dépense.'
  if (typeof valeurs.montant !== 'number' || Number.isNaN(valeurs.montant)) {
    return 'Le montant doit être un nombre valide.'
  }
  if (valeurs.tvaPct !== null && (valeurs.tvaPct < 0 || valeurs.tvaPct > 100)) {
    return 'Le taux de TVA doit être compris entre 0 et 100.'
  }
  return null
}

function relireEcriture(id: number | bigint): EcritureJournal {
  const ligne = getDb()
    .prepare(
      `SELECT j.*, CAST(strftime('%Y', j.date) AS INTEGER) AS annee, c.libelle AS categorie_libelle
       FROM journal j LEFT JOIN categories_journal c ON c.id = j.categorie_id
       WHERE j.id = ?`
    )
    .get(id) as unknown as LigneJournal
  return versEcriture(ligne)
}

// --- Catégories ---

export function listerCategoriesJournal(): CategorieJournal[] {
  return getDb()
    .prepare('SELECT * FROM categories_journal ORDER BY libelle')
    .all() as unknown as CategorieJournal[]
}

export function ajouterCategorieJournal(libelle: string): CategorieJournal {
  if (!libelle.trim()) throw new Error('Le libellé de la catégorie est obligatoire.')
  const existe = getDb()
    .prepare('SELECT 1 FROM categories_journal WHERE libelle = ?')
    .get(libelle.trim())
  if (existe) throw new Error(`La catégorie "${libelle.trim()}" existe déjà.`)

  const resultat = getDb()
    .prepare('INSERT INTO categories_journal (libelle) VALUES (?)')
    .run(libelle.trim())
  return { id: Number(resultat.lastInsertRowid), libelle: libelle.trim() } satisfies CategorieJournal
}

export function renommerCategorieJournal(id: number, libelle: string): CategorieJournal {
  if (!libelle.trim()) throw new Error('Le libellé de la catégorie est obligatoire.')
  getDb().prepare('UPDATE categories_journal SET libelle = ? WHERE id = ?').run(libelle.trim(), id)
  return { id, libelle: libelle.trim() } satisfies CategorieJournal
}

export function supprimerCategorieJournal(id: number): void {
  // Les écritures existantes ne doivent pas perdre leur catégorie sans avertissement.
  const nbEcritures = getDb()
    .prepare('SELECT COUNT(*) AS n FROM journal WHERE categorie_id = ?')
    .get(id) as { n: number }
  if (nbEcritures.n > 0) {
    throw new Error(
      `Cette catégorie est utilisée par ${nbEcritures.n} écriture(s) du Journal. ` +
        'Renommez-la plutôt que de la supprimer, ou changez la catégorie de ces écritures.'
    )
  }
  getDb().prepare('DELETE FROM categories_journal WHERE id = ?').run(id)
}

// --- Écritures ---

export function listerJournal(filtres: FiltresJournal = {}): EcritureJournal[] {
  const { clause, params } = construireClauseFiltres(filtres)
  const lignes = getDb()
    .prepare(
      `SELECT j.*, CAST(strftime('%Y', j.date) AS INTEGER) AS annee, c.libelle AS categorie_libelle
       FROM journal j
       LEFT JOIN categories_journal c ON c.id = j.categorie_id
       ${clause}
       ORDER BY j.date DESC, j.id DESC`
    )
    .all(...params) as unknown as LigneJournal[]
  return lignes.map(versEcriture)
}

export function ajouterEcritureJournal(valeurs: ValeursEcriture): EcritureJournal {
  const erreur = validerEcriture(valeurs)
  if (erreur) throw new Error(erreur)
  verifierExerciceOuvert(valeurs.date)

  const resultat = getDb()
    .prepare(
      `INSERT INTO journal (date, type, categorie_id, description, montant, numero_facture, notes, tva_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      valeurs.date,
      valeurs.type,
      valeurs.categorieId,
      valeurs.description,
      valeurs.montant,
      valeurs.numeroFacture,
      valeurs.notes,
      valeurs.tvaPct
    )

  return relireEcriture(resultat.lastInsertRowid)
}

export function modifierEcritureJournal(
  valeurs: ValeursEcriture & { id: number }
): EcritureJournal {
  const erreur = validerEcriture(valeurs)
  if (erreur) throw new Error(erreur)
  verifierExerciceOuvert(valeurs.date)

  // L'ancienne date compte aussi : on ne peut pas sortir une écriture
  // d'un exercice clôturé en changeant simplement sa date.
  const ancienne = getDb().prepare('SELECT date FROM journal WHERE id = ?').get(valeurs.id) as
    | { date: string }
    | undefined
  if (ancienne) verifierExerciceOuvert(ancienne.date)

  getDb()
    .prepare(
      `UPDATE journal SET
        date = ?, type = ?, categorie_id = ?, description = ?, montant = ?,
        numero_facture = ?, notes = ?, tva_pct = ?
       WHERE id = ?`
    )
    .run(
      valeurs.date,
      valeurs.type,
      valeurs.categorieId,
      valeurs.description,
      valeurs.montant,
      valeurs.numeroFacture,
      valeurs.notes,
      valeurs.tvaPct,
      valeurs.id
    )

  return relireEcriture(valeurs.id)
}

export function supprimerEcritureJournal(id: number): void {
  const ligne = getDb().prepare('SELECT date, description FROM journal WHERE id = ?').get(id) as
    | { date: string; description: string }
    | undefined
  if (!ligne) return

  verifierExerciceOuvert(ligne.date)
  getDb().prepare('DELETE FROM journal WHERE id = ?').run(id)
  tracerAudit('suppression', 'journal', String(id), `${ligne.date} — ${ligne.description}`)
}

export function repartitionParCategorie(filtres: FiltresJournal = {}): RepartitionCategorie[] {
  const { clause, params } = construireClauseFiltres(filtres)
  return getDb()
    .prepare(
      `SELECT COALESCE(c.libelle, 'Sans catégorie') AS categorie, SUM(j.montant) AS total
       FROM journal j
       LEFT JOIN categories_journal c ON c.id = j.categorie_id
       ${clause}
       GROUP BY categorie
       ORDER BY total DESC`
    )
    .all(...params) as unknown as RepartitionCategorie[]
}

export function evolutionAnnuelle(): EvolutionAnnuelle[] {
  return getDb()
    .prepare(
      `SELECT
        CAST(strftime('%Y', date) AS INTEGER) AS annee,
        SUM(CASE WHEN type = 'Entrée' THEN montant ELSE 0 END) AS entrees,
        SUM(CASE WHEN type = 'Dépense' THEN montant ELSE 0 END) AS depenses
       FROM journal
       GROUP BY annee
       ORDER BY annee`
    )
    .all() as unknown as EvolutionAnnuelle[]
}
