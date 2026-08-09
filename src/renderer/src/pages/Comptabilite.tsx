import { useEffect, useState } from 'react'
import type { CategorieJournal, MouvementBancaire, ResultatImport } from '../../../shared/types'
import { formaterMontant } from '../lib/devise'

export default function Comptabilite(): React.JSX.Element {
  const [annees, setAnnees] = useState<number[]>([])
  const [anneeExport, setAnneeExport] = useState<number | ''>('')
  const [categories, setCategories] = useState<CategorieJournal[]>([])
  const [categorieEntree, setCategorieEntree] = useState<number | ''>('')
  const [categorieDepense, setCategorieDepense] = useState<number | ''>('')
  const [importEnCours, setImportEnCours] = useState<ResultatImport | null>(null)
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)

  useEffect(() => {
    window.api.journal.evolutionAnnuelle().then((e) => setAnnees(e.map((a) => a.annee).sort((a, b) => b - a)))
    window.api.categoriesJournal.lister().then((liste) => {
      setCategories(liste)
      // Pré-sélection raisonnable si ces catégories par défaut existent.
      setCategorieEntree(liste.find((c) => c.libelle === 'Facture client')?.id ?? '')
      setCategorieDepense(liste.find((c) => c.libelle === 'Autre')?.id ?? '')
    })
  }, [])

  function afficherErreur(erreur: unknown): void {
    setMessageSucces(null)
    setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
  }

  function afficherSucces(message: string): void {
    setMessageErreur(null)
    setMessageSucces(message)
  }

  async function exporter(): Promise<void> {
    try {
      const chemin = await window.api.comptabilite.exporterCsv(anneeExport === '' ? null : anneeExport)
      if (chemin) afficherSucces(`Export terminé : ${chemin}`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function choisirReleve(): Promise<void> {
    setMessageErreur(null)
    setMessageSucces(null)
    try {
      const resultat = await window.api.comptabilite.choisirReleve()
      if (!resultat) return
      setImportEnCours(resultat)
      // Par défaut on ne coche que les mouvements pas encore dans le Journal.
      setSelection(
        new Set(
          resultat.mouvements
            .map((m, index) => (m.dejaRapproche ? -1 : index))
            .filter((index) => index >= 0)
        )
      )
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  function basculer(index: number): void {
    setSelection((precedent) => {
      const copie = new Set(precedent)
      if (copie.has(index)) copie.delete(index)
      else copie.add(index)
      return copie
    })
  }

  async function importer(): Promise<void> {
    if (!importEnCours) return
    const retenus = importEnCours.mouvements.filter((_, index) => selection.has(index))
    if (retenus.length === 0) {
      afficherErreur(new Error('Aucun mouvement sélectionné.'))
      return
    }

    try {
      const nb = await window.api.comptabilite.importerMouvements(
        retenus,
        categorieEntree === '' ? null : categorieEntree,
        categorieDepense === '' ? null : categorieDepense
      )
      setImportEnCours(null)
      setSelection(new Set())
      afficherSucces(`${nb} écriture(s) ajoutée(s) au Journal.`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  const mouvements: MouvementBancaire[] = importEnCours?.mouvements ?? []
  const totalSelection = mouvements
    .filter((_, index) => selection.has(index))
    .reduce((somme, m) => somme + m.montant, 0)

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>Export comptable</h2>
        <p className="valeur-calculee">
          Fichier CSV (séparateur point-virgule, UTF-8) avec le détail HT / TVA de chaque écriture —
          format lisible par Excel et par la plupart des logiciels de fiduciaire.
        </p>
        <label>
          Période
          <select
            value={anneeExport}
            onChange={(e) => setAnneeExport(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Toutes les années</option>
            {annees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <button onClick={exporter}>Exporter en CSV</button>
      </div>

      <div className="carte">
        <h2>Import de relevé bancaire</h2>
        <p className="valeur-calculee">
          Formats acceptés : CSV exporté depuis l'e-banking, ou CAMT.053 (XML, standard suisse). Les
          mouvements déjà présents dans le Journal (même date et même montant) sont repérés et
          décochés automatiquement pour éviter les doublons.
        </p>

        <div className="ligne-formulaire">
          <label>
            Catégorie des entrées
            <select
              value={categorieEntree}
              onChange={(e) => setCategorieEntree(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.libelle}
                </option>
              ))}
            </select>
          </label>
          <label>
            Catégorie des dépenses
            <select
              value={categorieDepense}
              onChange={(e) => setCategorieDepense(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.libelle}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button onClick={choisirReleve}>Choisir un relevé…</button>

        {importEnCours && (
          <>
            <p className="valeur-calculee">
              <strong>{importEnCours.fichier}</strong> · format {importEnCours.format} ·{' '}
              {mouvements.length} mouvement(s) lus · {selection.size} sélectionné(s) pour{' '}
              <strong>{formaterMontant(totalSelection)}</strong>
            </p>

            <table className="table-editable">
              <thead>
                <tr>
                  <th></th>
                  <th>Date</th>
                  <th>Libellé</th>
                  <th>Montant</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {mouvements.map((m, index) => (
                  <tr key={index} className={m.dejaRapproche ? 'ligne-grisee' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selection.has(index)}
                        onChange={() => basculer(index)}
                      />
                    </td>
                    <td className="colonne-etroite">{m.date}</td>
                    <td>{m.libelle}</td>
                    <td className={m.montant < 0 ? 'texte-alerte' : ''}>{formaterMontant(m.montant)}</td>
                    <td className="colonne-etroite">
                      {m.dejaRapproche ? 'Déjà au Journal' : 'Nouveau'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="barre-boutons">
              <button className="action-ecriture" onClick={importer}>Importer la sélection ({selection.size})</button>
              <button className="bouton-secondaire" onClick={() => setImportEnCours(null)}>
                Abandonner
              </button>
            </div>
          </>
        )}
      </div>

      {messageErreur && <p className="erreur">{messageErreur}</p>}
      {messageSucces && <p className="succes">{messageSucces}</p>}
    </div>
  )
}
