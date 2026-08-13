import { useEffect, useState } from 'react'
import type { ArticleInventaire, ResumeInventaire } from '../../../shared/types'
import { formaterMontant } from '../lib/devise'
import { t } from '../../../shared/i18n'
import { CATEGORIES_INVENTAIRE, VALEURS_CATEGORIES } from '../../../shared/inventaire'

function articleVide(reference: string): ArticleInventaire {
  return {
    reference,
    designation: '',
    categorie: VALEURS_CATEGORIES[0],
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
    if (!window.confirm(t('inventaire.confirmerSuppression', { reference }))) return
    await window.api.inventaire.supprimer(reference)
    await recharger()
  }

  if (chargement) return <p>{t('etat.chargement')}</p>

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>{t('inventaire.resume')}</h2>
        <div className="resultats-calcules" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
          <p>
            {t('inventaire.valeurTotale')}{' '}
            <strong>{formaterMontant(resume.valeurTotaleStock)}</strong>
          </p>
          <p>
            {t('inventaire.sousSeuil')}{' '}
            <strong className={resume.nbReferencesSousSeuil > 0 ? 'texte-alerte' : ''}>
              {resume.nbReferencesSousSeuil}
            </strong>
          </p>
        </div>
      </div>

      <div className="carte">
        <h2>{t('inventaire.titre')}</h2>
        <table className="table-editable">
          <thead>
            <tr>
              <th>{t('colonne.reference')}</th>
              <th>{t('colonne.designation')}</th>
              <th>{t('inventaire.categorie')}</th>
              <th>{t('inventaire.stock')}</th>
              <th>{t('inventaire.seuil')}</th>
              <th>{t('inventaire.prixAchat')}</th>
              <th>{t('inventaire.prixVente')}</th>
              <th>{t('inventaire.fournisseur')}</th>
              <th>{t('inventaire.emplacement')}</th>
              <th>{t('inventaire.derniereMaj')}</th>
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
                      {CATEGORIES_INVENTAIRE.map((c) => (
                        <option key={c.valeur} value={c.valeur}>
                          {t(c.cle)}
                        </option>
                      ))}
                      {!VALEURS_CATEGORIES.includes(article.categorie) && (
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
                    <button className="action-ecriture bouton-danger" onClick={() => supprimerArticle(article.reference)}>
                      {t('action.supprimer')}
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
              {t('colonne.reference')}
              <input
                value={nouvelArticle.reference}
                onChange={(e) => setNouvelArticle({ ...nouvelArticle, reference: e.target.value })}
              />
            </label>
            <label>
              {t('colonne.designation')}
              <input
                value={nouvelArticle.designation}
                onChange={(e) => setNouvelArticle({ ...nouvelArticle, designation: e.target.value })}
              />
            </label>
            <label>
              {t('inventaire.categorie')}
              <select
                value={nouvelArticle.categorie}
                onChange={(e) => setNouvelArticle({ ...nouvelArticle, categorie: e.target.value })}
              >
                {CATEGORIES_INVENTAIRE.map((c) => (
                  <option key={c.valeur} value={c.valeur}>
                    {t(c.cle)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('inventaire.stock')}
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
              {t('inventaire.seuilAlerte')}
              <input
                type="number"
                step="1"
                value={nouvelArticle.seuilAlerte}
                onChange={(e) => setNouvelArticle({ ...nouvelArticle, seuilAlerte: Number(e.target.value) })}
              />
            </label>
            <label>
              {t('inventaire.prixAchat')}
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
              {t('inventaire.prixVente')}
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
              {t('inventaire.fournisseur')}
              <input
                value={nouvelArticle.fournisseur}
                onChange={(e) => setNouvelArticle({ ...nouvelArticle, fournisseur: e.target.value })}
              />
            </label>
            <label>
              {t('inventaire.emplacement')}
              <input
                value={nouvelArticle.emplacement}
                onChange={(e) => setNouvelArticle({ ...nouvelArticle, emplacement: e.target.value })}
              />
            </label>
            <div className="barre-boutons">
              <button className="action-ecriture" onClick={enregistrerNouvelArticle}>
                {t('action.enregistrer')}
              </button>
              <button className="bouton-danger" onClick={() => setNouvelArticle(null)}>
                {t('action.annuler')}
              </button>
            </div>
          </div>
        ) : (
          <button className="action-ecriture" onClick={preparerNouvelArticle}>
            {t('inventaire.ajouterArticle')}
          </button>
        )}

        {messageErreur && <p className="erreur">{messageErreur}</p>}
      </div>
    </div>
  )
}
