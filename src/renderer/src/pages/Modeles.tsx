import { useEffect, useState } from 'react'
import type { ModeleLigne, ModelePrestation } from '../../../shared/types'
import { calculerSousTotal } from '../../../shared/calculs'
import { formaterMontant } from '../lib/devise'
import { t } from '../../../shared/i18n'

function ligneVide(): ModeleLigne {
  return { id: -Date.now(), designation: '', referenceInventaire: null, quantite: 1, prixUnitaire: 0 }
}

export default function Modeles(): React.JSX.Element {
  const [modeles, setModeles] = useState<ModelePrestation[]>([])
  const [selection, setSelection] = useState<ModelePrestation | null>(null)
  const [nouveauNom, setNouveauNom] = useState('')
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)

  async function recharger(): Promise<void> {
    setModeles(await window.api.modeles.lister())
  }

  useEffect(() => {
    recharger().finally(() => setChargement(false))
  }, [])

  function afficherErreur(erreur: unknown): void {
    setMessageSucces(null)
    setMessageErreur(erreur instanceof Error ? erreur.message : t('erreur.inconnue'))
  }

  function afficherSucces(message: string): void {
    setMessageErreur(null)
    setMessageSucces(message)
    setTimeout(() => setMessageSucces(null), 2500)
  }

  async function creerModele(): Promise<void> {
    try {
      const modele = await window.api.modeles.creer(nouveauNom)
      setNouveauNom('')
      await recharger()
      setSelection({ ...modele, lignes: [ligneVide()] })
      afficherSucces(t('modele.cree'))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function enregistrer(): Promise<void> {
    if (!selection) return
    try {
      const misAJour = await window.api.modeles.enregistrer(selection)
      setSelection({ ...misAJour, lignes: misAJour.lignes.length ? misAJour.lignes : [ligneVide()] })
      await recharger()
      afficherSucces(t('modele.enregistre'))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function supprimer(id: number): Promise<void> {
    if (!window.confirm(t('modele.confirmerSuppression'))) return
    await window.api.modeles.supprimer(id)
    if (selection?.id === id) setSelection(null)
    await recharger()
    afficherSucces(t('modele.supprime'))
  }

  function modifierLigne(index: number, ligne: ModeleLigne): void {
    if (!selection) return
    const lignes = [...selection.lignes]
    lignes[index] = ligne
    setSelection({ ...selection, lignes })
  }

  function retirerLigne(index: number): void {
    if (!selection) return
    const lignes = selection.lignes.filter((_, i) => i !== index)
    setSelection({ ...selection, lignes: lignes.length ? lignes : [ligneVide()] })
  }

  if (chargement) return <p>{t('etat.chargement')}</p>

  return (
    <div className="clients-layout">
      <aside className="carte clients-liste">
        <h2>{t('modele.titre')}</h2>
        <ul className="liste-clients">
          {modeles.map((m) => (
            <li key={m.id}>
              <button
                className={selection?.id === m.id ? 'actif' : ''}
                onClick={() =>
                  setSelection({ ...m, lignes: m.lignes.length ? m.lignes : [ligneVide()] })
                }
              >
                <span className="liste-clients-nom">{m.nom}</span>
                <span className="liste-clients-meta">
                  {t('modele.lignes', { nombre: m.lignes.length })}{' '}
                  {formaterMontant(calculerSousTotal(m.lignes))}
                </span>
              </button>
            </li>
          ))}
          {modeles.length === 0 && <li className="liste-vide">{t('modele.aucun')}</li>}
        </ul>

        <label>
          {t('modele.nouveau')}
          <input
            placeholder={t('modele.exemple')}
            value={nouveauNom}
            onChange={(e) => setNouveauNom(e.target.value)}
          />
        </label>
        <button className="action-ecriture" onClick={creerModele}>{t('modele.creer')}</button>
      </aside>

      <section className="clients-detail">
        {selection ? (
          <div className="carte">
            <h2>{t('modele.entete', { nom: selection.nom })}</h2>
            <label>
              {t('modele.nom')}
              <input
                value={selection.nom}
                onChange={(e) => setSelection({ ...selection, nom: e.target.value })}
              />
            </label>

            <table className="table-editable">
              <thead>
                <tr>
                  <th>{t('colonne.designation')}</th>
                  <th>{t('modele.refInventaire')}</th>
                  <th>{t('doc.quantite')}</th>
                  <th>{t('doc.prixUnitaire')}</th>
                  <th>{t('colonne.total')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {selection.lignes.map((ligne, index) => (
                  <tr key={ligne.id}>
                    <td>
                      <input
                        value={ligne.designation}
                        onChange={(e) => modifierLigne(index, { ...ligne, designation: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        placeholder={t('modele.optionnel')}
                        value={ligne.referenceInventaire ?? ''}
                        onChange={(e) =>
                          modifierLigne(index, { ...ligne, referenceInventaire: e.target.value || null })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.5"
                        value={ligne.quantite}
                        onChange={(e) => modifierLigne(index, { ...ligne, quantite: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.05"
                        value={ligne.prixUnitaire}
                        onChange={(e) =>
                          modifierLigne(index, { ...ligne, prixUnitaire: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td>{formaterMontant(ligne.quantite * ligne.prixUnitaire)}</td>
                    <td>
                      <button className="action-ecriture bouton-danger" onClick={() => retirerLigne(index)}>
                        {t('modele.retirer')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              onClick={() => setSelection({ ...selection, lignes: [...selection.lignes, ligneVide()] })}
            >
              {t('modele.ajouterLigne')}
            </button>

            <div className="resultats-calcules">
              <p>
                {t('modele.total')}{' '}
                <strong>{formaterMontant(calculerSousTotal(selection.lignes))}</strong>{' '}
                {t('modele.horsRemise')}
              </p>
            </div>

            <div className="barre-boutons">
              <button className="action-ecriture" onClick={enregistrer}>{t('action.enregistrer')}</button>
              <button className="action-ecriture bouton-danger" onClick={() => supprimer(selection.id)}>
                {t('modele.supprimerModele')}
              </button>
            </div>
          </div>
        ) : (
          <div className="carte etat-vide">
            <p>
              {t('modele.aide')}
            </p>
          </div>
        )}

        {messageErreur && <p className="erreur">{messageErreur}</p>}
        {messageSucces && <p className="succes">{messageSucces}</p>}
      </section>
    </div>
  )
}
