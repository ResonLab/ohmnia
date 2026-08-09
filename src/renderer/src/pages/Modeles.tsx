import { useEffect, useState } from 'react'
import type { ModeleLigne, ModelePrestation } from '../../../shared/types'
import { calculerSousTotal } from '../../../shared/calculs'
import { formaterMontant } from '../lib/devise'

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
    setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
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
      afficherSucces('Modèle créé. Ajoute ses lignes puis enregistre.')
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
      afficherSucces('Modèle enregistré.')
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function supprimer(id: number): Promise<void> {
    if (!window.confirm('Supprimer définitivement ce modèle ?')) return
    await window.api.modeles.supprimer(id)
    if (selection?.id === id) setSelection(null)
    await recharger()
    afficherSucces('Modèle supprimé.')
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

  if (chargement) return <p>Chargement…</p>

  return (
    <div className="clients-layout">
      <aside className="carte clients-liste">
        <h2>Modèles</h2>
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
                  {m.lignes.length} ligne(s) · {formaterMontant(calculerSousTotal(m.lignes))}
                </span>
              </button>
            </li>
          ))}
          {modeles.length === 0 && <li className="liste-vide">Aucun modèle pour l'instant.</li>}
        </ul>

        <label>
          Nouveau modèle
          <input
            placeholder="ex. Diagnostic standard"
            value={nouveauNom}
            onChange={(e) => setNouveauNom(e.target.value)}
          />
        </label>
        <button className="action-ecriture" onClick={creerModele}>Créer</button>
      </aside>

      <section className="clients-detail">
        {selection ? (
          <div className="carte">
            <h2>Modèle « {selection.nom} »</h2>
            <label>
              Nom
              <input
                value={selection.nom}
                onChange={(e) => setSelection({ ...selection, nom: e.target.value })}
              />
            </label>

            <table className="table-editable">
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Réf. inventaire</th>
                  <th>Qté</th>
                  <th>Prix unitaire</th>
                  <th>Total</th>
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
                        placeholder="optionnel"
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
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              onClick={() => setSelection({ ...selection, lignes: [...selection.lignes, ligneVide()] })}
            >
              + Ajouter une ligne
            </button>

            <div className="resultats-calcules">
              <p>
                Total du modèle : <strong>{formaterMontant(calculerSousTotal(selection.lignes))}</strong>{' '}
                (hors remise et TVA)
              </p>
            </div>

            <div className="barre-boutons">
              <button className="action-ecriture" onClick={enregistrer}>Enregistrer</button>
              <button className="action-ecriture bouton-danger" onClick={() => supprimer(selection.id)}>
                Supprimer le modèle
              </button>
            </div>
          </div>
        ) : (
          <div className="carte etat-vide">
            <p>
              Un modèle est un panier de lignes réutilisable : sélectionne-en un à gauche, ou crée-en un
              nouveau. Tu peux aussi en créer directement depuis une facture existante.
            </p>
          </div>
        )}

        {messageErreur && <p className="erreur">{messageErreur}</p>}
        {messageSucces && <p className="succes">{messageSucces}</p>}
      </section>
    </div>
  )
}
