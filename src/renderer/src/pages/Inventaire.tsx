import { useEffect, useState } from 'react'
import type { ArticleInventaire, ResumeInventaire } from '../../../shared/types'
import { formaterMontant } from '../lib/devise'

const CATEGORIES = [
  'Composants',
  'Câbles/Connectique',
  'Outillage',
  'Consommables',
  'Appareils',
  'Divers'
]

function articleVide(reference: string): ArticleInventaire {
  return {
    reference,
    designation: '',
    categorie: CATEGORIES[0],
    quantiteStock: 0,
    seuilAlerte: 0,
    prixAchatUnitaire: 0,
    prixVenteUnitaire: 0,
    fournisseur: '',
    emplacement: '',
    derniereMaj: ''
  }
}

export default function Inventaire(): React.JSX.Element {
  const [articles, setArticles] = useState<ArticleInventaire[]>([])
  const [resume, setResume] = useState<ResumeInventaire>({ valeurTotaleStock: 0, nbReferencesSousSeuil: 0 })
  const [nouvelArticle, setNouvelArticle] = useState<ArticleInventaire | null>(null)
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)

  async function recharger(): Promise<void> {
    const [liste, res] = await Promise.all([window.api.inventaire.lister(), window.api.inventaire.resume()])
    setArticles(liste)
    setResume(res)
  }

  useEffect(() => {
    recharger().finally(() => setChargement(false))
  }, [])

  function afficherErreur(erreur: unknown): void {
    setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
  }

  async function preparerNouvelArticle(): Promise<void> {
    const reference = await window.api.inventaire.referenceSuggeree()
    setNouvelArticle(articleVide(reference))
  }

  async function enregistrerNouvelArticle(): Promise<void> {
    if (!nouvelArticle) return
    setMessageErreur(null)
    try {
      await window.api.inventaire.ajouter(nouvelArticle)
      setNouvelArticle(null)
      await recharger()
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function modifierArticle(referenceOrigine: string, article: ArticleInventaire): Promise<void> {
    setMessageErreur(null)
    // Mise à jour optimiste de l'affichage, puis persistance.
    setArticles((precedent) => precedent.map((a) => (a.reference === referenceOrigine ? article : a)))
    try {
      await window.api.inventaire.modifier(referenceOrigine, article)
      await recharger()
    } catch (erreur) {
      afficherErreur(erreur)
      await recharger()
    }
  }

  async function supprimerArticle(reference: string): Promise<void> {
    if (!window.confirm(`Supprimer la référence ${reference} de l'inventaire ?`)) return
    await window.api.inventaire.supprimer(reference)
    await recharger()
  }

  if (chargement) return <p>Chargement…</p>

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>Résumé du stock</h2>
        <div className="resultats-calcules" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
          <p>
            Valeur totale du stock (au prix d'achat) :{' '}
            <strong>{formaterMontant(resume.valeurTotaleStock)}</strong>
          </p>
          <p>
            Références sous le seuil d'alerte :{' '}
            <strong className={resume.nbReferencesSousSeuil > 0 ? 'texte-alerte' : ''}>
              {resume.nbReferencesSousSeuil}
            </strong>
          </p>
        </div>
      </div>

      <div className="carte">
        <h2>Inventaire</h2>
        <table className="table-editable">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th>Catégorie</th>
              <th>Stock</th>
              <th>Seuil</th>
              <th>Prix achat</th>
              <th>Prix vente</th>
              <th>Fournisseur</th>
              <th>Emplacement</th>
              <th>Dernière MAJ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => {
              const sousSeuil = article.quantiteStock <= article.seuilAlerte
              return (
                <tr key={article.reference} className={sousSeuil ? 'alerte' : ''}>
                  <td>
                    <input
                      value={article.reference}
                      onChange={(e) =>
                        modifierArticle(article.reference, { ...article, reference: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={article.designation}
                      onChange={(e) =>
                        modifierArticle(article.reference, { ...article, designation: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={article.categorie}
                      onChange={(e) =>
                        modifierArticle(article.reference, { ...article, categorie: e.target.value })
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {!CATEGORIES.includes(article.categorie) && (
                        <option value={article.categorie}>{article.categorie}</option>
                      )}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="1"
                      value={article.quantiteStock}
                      onChange={(e) =>
                        modifierArticle(article.reference, {
                          ...article,
                          quantiteStock: Number(e.target.value)
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="1"
                      value={article.seuilAlerte}
                      onChange={(e) =>
                        modifierArticle(article.reference, { ...article, seuilAlerte: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.05"
                      value={article.prixAchatUnitaire}
                      onChange={(e) =>
                        modifierArticle(article.reference, {
                          ...article,
                          prixAchatUnitaire: Number(e.target.value)
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.05"
                      value={article.prixVenteUnitaire}
                      onChange={(e) =>
                        modifierArticle(article.reference, {
                          ...article,
                          prixVenteUnitaire: Number(e.target.value)
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={article.fournisseur}
                      onChange={(e) =>
                        modifierArticle(article.reference, { ...article, fournisseur: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={article.emplacement}
                      onChange={(e) =>
                        modifierArticle(article.reference, { ...article, emplacement: e.target.value })
                      }
                    />
                  </td>
                  <td className="colonne-etroite">{article.derniereMaj.slice(0, 10)}</td>
                  <td>
                    <button className="bouton-danger" onClick={() => supprimerArticle(article.reference)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {nouvelArticle ? (
          <div className="ligne-formulaire">
            <label>
              Référence
              <input
                value={nouvelArticle.reference}
                onChange={(e) => setNouvelArticle({ ...nouvelArticle, reference: e.target.value })}
              />
            </label>
            <label>
              Désignation
              <input
                value={nouvelArticle.designation}
                onChange={(e) => setNouvelArticle({ ...nouvelArticle, designation: e.target.value })}
              />
            </label>
            <label>
              Catégorie
              <select
                value={nouvelArticle.categorie}
                onChange={(e) => setNouvelArticle({ ...nouvelArticle, categorie: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stock
              <input
                type="number"
                step="1"
                value={nouvelArticle.quantiteStock}
                onChange={(e) =>
                  setNouvelArticle({ ...nouvelArticle, quantiteStock: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Seuil d'alerte
              <input
                type="number"
                step="1"
                value={nouvelArticle.seuilAlerte}
                onChange={(e) => setNouvelArticle({ ...nouvelArticle, seuilAlerte: Number(e.target.value) })}
              />
            </label>
            <label>
              Prix achat
              <input
                type="number"
                step="0.05"
                value={nouvelArticle.prixAchatUnitaire}
                onChange={(e) =>
                  setNouvelArticle({ ...nouvelArticle, prixAchatUnitaire: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Prix vente
              <input
                type="number"
                step="0.05"
                value={nouvelArticle.prixVenteUnitaire}
                onChange={(e) =>
                  setNouvelArticle({ ...nouvelArticle, prixVenteUnitaire: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Fournisseur
              <input
                value={nouvelArticle.fournisseur}
                onChange={(e) => setNouvelArticle({ ...nouvelArticle, fournisseur: e.target.value })}
              />
            </label>
            <label>
              Emplacement
              <input
                value={nouvelArticle.emplacement}
                onChange={(e) => setNouvelArticle({ ...nouvelArticle, emplacement: e.target.value })}
              />
            </label>
            <div className="barre-boutons">
              <button onClick={enregistrerNouvelArticle}>Enregistrer</button>
              <button className="bouton-danger" onClick={() => setNouvelArticle(null)}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button onClick={preparerNouvelArticle}>+ Ajouter un article</button>
        )}

        {messageErreur && <p className="erreur">{messageErreur}</p>}
      </div>
    </div>
  )
}
