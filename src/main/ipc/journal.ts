import { ipcMain } from 'electron'
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

function construireClauseFiltres(filtres: FiltresJournal): { clause: string; params: (string | number)[] } {
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

function validerEcriture(valeurs: Omit<EcritureJournal, 'id' | 'annee' | 'categorieLibelle' | 'montantTva'>): string | null {
  if (!valeurs.date) return 'La date est obligatoire.'
  if (valeurs.type !== 'Entrée' && valeurs.type !== 'Dépense') return 'Le type doit être Entrée ou Dépense.'
  if (typeof valeurs.montant !== 'number' || Number.isNaN(valeurs.montant)) {
    return 'Le montant doit être un nombre valide.'
  }
  if (valeurs.tvaPct !== null && (valeurs.tvaPct < 0 || valeurs.tvaPct > 100)) {
    return 'Le taux de TVA doit être compris entre 0 et 100.'
  }
  return null
}

export function enregistrerHandlersJournal(): void {
  ipcMain.handle('categoriesJournal:lister', () => {
    return getDb().prepare('SELECT * FROM categories_journal ORDER BY libelle').all() as unknown as CategorieJournal[]
  })

  ipcMain.handle('categoriesJournal:ajouter', (_e, libelle: string) => {
    if (!libelle.trim()) throw new Error('Le libellé de la catégorie est obligatoire.')
    const existe = getDb()
      .prepare('SELECT 1 FROM categories_journal WHERE libelle = ?')
      .get(libelle.trim())
    if (existe) throw new Error(`La catégorie "${libelle.trim()}" existe déjà.`)

    const resultat = getDb()
      .prepare('INSERT INTO categories_journal (libelle) VALUES (?)')
      .run(libelle.trim())
    return { id: Number(resultat.lastInsertRowid), libelle: libelle.trim() } satisfies CategorieJournal
  })

  ipcMain.handle('categoriesJournal:renommer', (_e, id: number, libelle: string) => {
    if (!libelle.trim()) throw new Error('Le libellé de la catégorie est obligatoire.')
    getDb().prepare('UPDATE categories_journal SET libelle = ? WHERE id = ?').run(libelle.trim(), id)
    return { id, libelle: libelle.trim() } satisfies CategorieJournal
  })

  ipcMain.handle('categoriesJournal:supprimer', (_e, id: number) => {
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
  })

  ipcMain.handle('journal:lister', (_e, filtres: FiltresJournal = {}) => {
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
  })

  ipcMain.handle(
    'journal:ajouter',
    (_e, valeurs: Omit<EcritureJournal, 'id' | 'annee' | 'categorieLibelle' | 'montantTva'>) => {
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

      const ligne = getDb()
        .prepare(
          `SELECT j.*, CAST(strftime('%Y', j.date) AS INTEGER) AS annee, c.libelle AS categorie_libelle
           FROM journal j LEFT JOIN categories_journal c ON c.id = j.categorie_id
           WHERE j.id = ?`
        )
        .get(resultat.lastInsertRowid) as unknown as LigneJournal
      return versEcriture(ligne)
    }
  )

  ipcMain.handle('journal:modifier', (_e, valeurs: Omit<EcritureJournal, 'annee' | 'categorieLibelle' | 'montantTva'>) => {
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

    const ligne = getDb()
      .prepare(
        `SELECT j.*, CAST(strftime('%Y', j.date) AS INTEGER) AS annee, c.libelle AS categorie_libelle
         FROM journal j LEFT JOIN categories_journal c ON c.id = j.categorie_id
         WHERE j.id = ?`
      )
      .get(valeurs.id) as unknown as LigneJournal
    return versEcriture(ligne)
  })

  ipcMain.handle('journal:supprimer', (_e, id: number) => {
    const ligne = getDb().prepare('SELECT date, description FROM journal WHERE id = ?').get(id) as
      | { date: string; description: string }
      | undefined
    if (!ligne) return

    verifierExerciceOuvert(ligne.date)
    getDb().prepare('DELETE FROM journal WHERE id = ?').run(id)
    tracerAudit('suppression', 'journal', String(id), `${ligne.date} — ${ligne.description}`)
  })

  ipcMain.handle('journal:repartitionParCategorie', (_e, filtres: FiltresJournal = {}) => {
    const { clause, params } = construireClauseFiltres(filtres)
    const lignes = getDb()
      .prepare(
        `SELECT COALESCE(c.libelle, 'Sans catégorie') AS categorie, SUM(j.montant) AS total
         FROM journal j
         LEFT JOIN categories_journal c ON c.id = j.categorie_id
         ${clause}
         GROUP BY categorie
         ORDER BY total DESC`
      )
      .all(...params) as unknown as RepartitionCategorie[]
    return lignes
  })

  ipcMain.handle('journal:evolutionAnnuelle', () => {
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
  })
}
