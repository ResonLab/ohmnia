import { useEffect, useMemo, useState } from 'react'
import type {
  CategorieJournal,
  EcritureJournal,
  EvolutionAnnuelle,
  FiltresJournal,
  RepartitionCategorie,
  TypeMouvement
} from '../../../shared/types'
import Camembert from '../components/Camembert'
import BarresAnnuelles from '../components/BarresAnnuelles'
import Justificatifs from '../components/Justificatifs'
import { formaterMontant, symboleDevise } from '../lib/devise'

function ecritureVide(): Omit<EcritureJournal, 'id' | 'annee' | 'categorieLibelle' | 'montantTva'> {
  return {
    date: new Date().toISOString().slice(0, 10),
    type: 'Dépense',
    categorieId: null,
    description: '',
    montant: 0,
    numeroFacture: null,
    notes: '',
    tvaPct: null
  }
}

export default function Journal(): React.JSX.Element {
  const [categories, setCategories] = useState<CategorieJournal[]>([])
  const [ecritures, setEcritures] = useState<EcritureJournal[]>([])
  const [repartition, setRepartition] = useState<RepartitionCategorie[]>([])
  const [evolution, setEvolution] = useState<EvolutionAnnuelle[]>([])

  const [filtreAnnee, setFiltreAnnee] = useState<number | ''>('')
  const [filtreType, setFiltreType] = useState<TypeMouvement | ''>('')
  const [filtreCategorieId, setFiltreCategorieId] = useState<number | ''>('')

  const [nouvelleEcriture, setNouvelleEcriture] = useState(ecritureVide())
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [compteurJustificatifs, setCompteurJustificatifs] = useState<Record<number, number>>({})
  const [ecritureJustificatifs, setEcritureJustificatifs] = useState<EcritureJournal | null>(null)

  const filtres: FiltresJournal = useMemo(
    () => ({
      annee: filtreAnnee === '' ? undefined : filtreAnnee,
      type: filtreType === '' ? undefined : filtreType,
      categorieId: filtreCategorieId === '' ? undefined : filtreCategorieId
    }),
    [filtreAnnee, filtreType, filtreCategorieId]
  )

  async function recharger(): Promise<void> {
    const [e, r, ev, nbJustificatifs] = await Promise.all([
      window.api.journal.lister(filtres),
      window.api.journal.repartitionParCategorie({ annee: filtres.annee, type: filtres.type }),
      window.api.journal.evolutionAnnuelle(),
      window.api.justificatifs.compterParEcriture()
    ])
    setEcritures(e)
    setRepartition(r)
    setEvolution(ev)
    setCompteurJustificatifs(nbJustificatifs)
  }

  useEffect(() => {
    window.api.categoriesJournal.lister().then(setCategories)
  }, [])

  useEffect(() => {
    setChargement(true)
    recharger().finally(() => setChargement(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreAnnee, filtreType, filtreCategorieId])

  async function ajouterEcriture(): Promise<void> {
    setMessageErreur(null)
    try {
      await window.api.journal.ajouter(nouvelleEcriture)
      setNouvelleEcriture(ecritureVide())
      await recharger()
    } catch (erreur) {
      setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
    }
  }

  async function supprimerEcriture(id: number): Promise<void> {
    await window.api.journal.supprimer(id)
    await recharger()
  }

  const anneesDisponibles = Array.from(new Set(evolution.map((e) => e.annee))).sort((a, b) => b - a)

  const total = ecritures.reduce((s, e) => s + e.montant, 0)

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>Ajout rapide</h2>
        <div className="ligne-formulaire">
          <label>
            Date
            <input
              type="date"
              value={nouvelleEcriture.date}
              onChange={(e) => setNouvelleEcriture({ ...nouvelleEcriture, date: e.target.value })}
            />
          </label>
          <label>
            Type
            <select
              value={nouvelleEcriture.type}
              onChange={(e) =>
                setNouvelleEcriture({ ...nouvelleEcriture, type: e.target.value as TypeMouvement })
              }
            >
              <option value="Entrée">Entrée</option>
              <option value="Dépense">Dépense</option>
            </select>
          </label>
          <label>
            Catégorie
            <select
              value={nouvelleEcriture.categorieId ?? ''}
              onChange={(e) =>
                setNouvelleEcriture({
                  ...nouvelleEcriture,
                  categorieId: e.target.value === '' ? null : Number(e.target.value)
                })
              }
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
            Description
            <input
              value={nouvelleEcriture.description}
              onChange={(e) => setNouvelleEcriture({ ...nouvelleEcriture, description: e.target.value })}
            />
          </label>
          <label>
            Montant ({symboleDevise()})
            <input
              type="number"
              step="0.05"
              value={nouvelleEcriture.montant}
              onChange={(e) =>
                setNouvelleEcriture({ ...nouvelleEcriture, montant: Number(e.target.value) })
              }
            />
          </label>
          <label>
            TVA %
            <input
              type="number"
              step="0.1"
              value={nouvelleEcriture.tvaPct ?? ''}
              onChange={(e) =>
                setNouvelleEcriture({
                  ...nouvelleEcriture,
                  tvaPct: e.target.value === '' ? null : Number(e.target.value)
                })
              }
            />
          </label>
          <label>
            N° facture liée
            <input
              value={nouvelleEcriture.numeroFacture ?? ''}
              onChange={(e) =>
                setNouvelleEcriture({ ...nouvelleEcriture, numeroFacture: e.target.value || null })
              }
            />
          </label>
        </div>
        <label>
          Notes
          <textarea
            value={nouvelleEcriture.notes}
            onChange={(e) => setNouvelleEcriture({ ...nouvelleEcriture, notes: e.target.value })}
          />
        </label>
        <button onClick={ajouterEcriture}>Ajouter au journal</button>
        {messageErreur && <p className="erreur">{messageErreur}</p>}
      </div>

      <div className="carte">
        <h2>Tableau de bord</h2>
        <div className="ligne-formulaire">
          <label>
            Année
            <select value={filtreAnnee} onChange={(e) => setFiltreAnnee(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Toutes</option>
              {anneesDisponibles.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={filtreType} onChange={(e) => setFiltreType(e.target.value as TypeMouvement | '')}>
              <option value="">Tous</option>
              <option value="Entrée">Entrée</option>
              <option value="Dépense">Dépense</option>
            </select>
          </label>
          <label>
            Catégorie
            <select
              value={filtreCategorieId}
              onChange={(e) => setFiltreCategorieId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.libelle}
                </option>
              ))}
            </select>
          </label>
        </div>

        {chargement ? (
          <p>Chargement…</p>
        ) : (
          <>
            <p className="valeur-calculee">
              Total : <strong>{formaterMontant(total)}</strong> — {ecritures.length} ligne(s)
            </p>

            <div className="graphiques-cote-a-cote">
              <div>
                <h3>Répartition par catégorie</h3>
                <Camembert donnees={repartition.map((r) => ({ label: r.categorie, valeur: r.total }))} />
              </div>
              <div>
                <h3>Évolution annuelle Entrées vs Dépenses</h3>
                <BarresAnnuelles donnees={evolution} />
              </div>
            </div>

            <table className="table-editable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Catégorie</th>
                  <th>Description</th>
                  <th>Montant</th>
                  <th>TVA</th>
                  <th>Facture</th>
                  <th>Justif.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ecritures.map((e) => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{e.type}</td>
                    <td>{e.categorieLibelle ?? '—'}</td>
                    <td>{e.description}</td>
                    <td>{formaterMontant(e.montant)}</td>
                    <td>{e.tvaPct ? `${e.tvaPct}% (${formaterMontant(e.montantTva)})` : '—'}</td>
                    <td>{e.numeroFacture ?? '—'}</td>
                    <td>
                      <button onClick={() => setEcritureJustificatifs(e)}>
                        {compteurJustificatifs[e.id] ? `📎 ${compteurJustificatifs[e.id]}` : '📎'}
                      </button>
                    </td>
                    <td>
                      <button className="bouton-danger" onClick={() => supprimerEcriture(e.id)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {ecritureJustificatifs && (
        <Justificatifs
          journalId={ecritureJustificatifs.id}
          description={ecritureJustificatifs.description}
          onFermer={() => setEcritureJustificatifs(null)}
          onChangement={recharger}
        />
      )}
    </div>
  )
}
