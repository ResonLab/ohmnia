import { useEffect, useState } from 'react'
import type { TarifDeplacement, TarifMainOeuvre, TarifProduit } from '../../../shared/types'
import { calculerPrixVenteProduit, calculerTotalLigne } from '../../../shared/calculs'
import { chargerValeursSuggerees, type ValeursSuggerees } from '../lib/suggestions'
import { formaterMontant } from '../lib/devise'

export default function Tarifs(): React.JSX.Element {
  const [produits, setProduits] = useState<TarifProduit[]>([])
  const [mainOeuvre, setMainOeuvre] = useState<TarifMainOeuvre[]>([])
  const [deplacements, setDeplacements] = useState<TarifDeplacement[]>([])
  const [suggestions, setSuggestions] = useState<ValeursSuggerees | null>(null)
  const [chargement, setChargement] = useState(true)
  const [messageErreur, setMessageErreur] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      window.api.tarifsProduits.lister(),
      window.api.tarifsMainOeuvre.lister(),
      window.api.tarifsDeplacement.lister(),
      chargerValeursSuggerees()
    ])
      .then(([p, m, d, s]) => {
        setProduits(p)
        setMainOeuvre(m)
        setDeplacements(d)
        setSuggestions(s)
      })
      .finally(() => setChargement(false))
  }, [])

  function afficherErreur(erreur: unknown): void {
    setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
  }

  async function ajouterProduit(): Promise<void> {
    try {
      const nouveau = await window.api.tarifsProduits.ajouter({
        designation: 'Nouveau produit',
        prixAchat: 0,
        margePct: null,
        referenceInventaire: null
      })
      setProduits((precedent) => [...precedent, nouveau])
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function modifierProduit(tarif: TarifProduit): Promise<void> {
    try {
      await window.api.tarifsProduits.modifier(tarif)
      setProduits((precedent) => precedent.map((t) => (t.id === tarif.id ? tarif : t)))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function supprimerProduit(id: number): Promise<void> {
    await window.api.tarifsProduits.supprimer(id)
    setProduits((precedent) => precedent.filter((t) => t.id !== id))
  }

  async function ajouterMainOeuvre(): Promise<void> {
    try {
      const nouveau = await window.api.tarifsMainOeuvre.ajouter({
        description: 'Nouvelle prestation',
        heures: 0,
        tauxHoraire: null
      })
      setMainOeuvre((precedent) => [...precedent, nouveau])
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function modifierMainOeuvre(tarif: TarifMainOeuvre): Promise<void> {
    try {
      await window.api.tarifsMainOeuvre.modifier(tarif)
      setMainOeuvre((precedent) => precedent.map((t) => (t.id === tarif.id ? tarif : t)))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function supprimerMainOeuvre(id: number): Promise<void> {
    await window.api.tarifsMainOeuvre.supprimer(id)
    setMainOeuvre((precedent) => precedent.filter((t) => t.id !== id))
  }

  async function ajouterDeplacement(): Promise<void> {
    try {
      const nouveau = await window.api.tarifsDeplacement.ajouter({
        description: 'Nouveau déplacement',
        distanceKm: 0,
        prixKm: null
      })
      setDeplacements((precedent) => [...precedent, nouveau])
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function modifierDeplacement(tarif: TarifDeplacement): Promise<void> {
    try {
      await window.api.tarifsDeplacement.modifier(tarif)
      setDeplacements((precedent) => precedent.map((t) => (t.id === tarif.id ? tarif : t)))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function supprimerDeplacement(id: number): Promise<void> {
    await window.api.tarifsDeplacement.supprimer(id)
    setDeplacements((precedent) => precedent.filter((t) => t.id !== id))
  }

  if (chargement || !suggestions) return <p>Chargement…</p>

  const margeSuggereePct = suggestions.margeSuggeree * 100

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>Produits & prestations</h2>
        <table className="table-editable">
          <thead>
            <tr>
              <th>Désignation</th>
              <th>Prix d'achat</th>
              <th>Marge % (vide = suggérée {margeSuggereePct.toFixed(1)}%)</th>
              <th>Prix de vente</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {produits.map((produit) => {
              const margeEffective = produit.margePct ?? margeSuggereePct
              const prixVente = calculerPrixVenteProduit(produit.prixAchat, margeEffective)
              return (
                <tr key={produit.id}>
                  <td>
                    <input
                      value={produit.designation}
                      onChange={(e) => modifierProduit({ ...produit, designation: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.05"
                      value={produit.prixAchat}
                      onChange={(e) => modifierProduit({ ...produit, prixAchat: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="1"
                      placeholder={margeSuggereePct.toFixed(1)}
                      value={produit.margePct ?? ''}
                      onChange={(e) =>
                        modifierProduit({
                          ...produit,
                          margePct: e.target.value === '' ? null : Number(e.target.value)
                        })
                      }
                    />
                  </td>
                  <td>{formaterMontant(prixVente)}</td>
                  <td>
                    <button className="action-ecriture bouton-danger" onClick={() => supprimerProduit(produit.id)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button className="action-ecriture" onClick={ajouterProduit}>+ Ajouter un produit</button>
      </div>

      <div className="carte">
        <h2>Heures / main d'œuvre</h2>
        <table className="table-editable">
          <thead>
            <tr>
              <th>Description</th>
              <th>Heures</th>
              <th>Taux horaire (vide = suggéré {formaterMontant(suggestions.tauxHoraireSuggere)})</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {mainOeuvre.map((ligne) => {
              const tauxEffectif = ligne.tauxHoraire ?? suggestions.tauxHoraireSuggere
              const total = calculerTotalLigne(ligne.heures, tauxEffectif)
              return (
                <tr key={ligne.id}>
                  <td>
                    <input
                      value={ligne.description}
                      onChange={(e) => modifierMainOeuvre({ ...ligne, description: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.25"
                      value={ligne.heures}
                      onChange={(e) => modifierMainOeuvre({ ...ligne, heures: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="1"
                      placeholder={suggestions.tauxHoraireSuggere.toFixed(2)}
                      value={ligne.tauxHoraire ?? ''}
                      onChange={(e) =>
                        modifierMainOeuvre({
                          ...ligne,
                          tauxHoraire: e.target.value === '' ? null : Number(e.target.value)
                        })
                      }
                    />
                  </td>
                  <td>{formaterMontant(total)}</td>
                  <td>
                    <button className="action-ecriture bouton-danger" onClick={() => supprimerMainOeuvre(ligne.id)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button className="action-ecriture" onClick={ajouterMainOeuvre}>+ Ajouter une ligne</button>
      </div>

      <div className="carte">
        <h2>Déplacement</h2>
        <table className="table-editable">
          <thead>
            <tr>
              <th>Description</th>
              <th>Distance (km)</th>
              <th>Prix/km (vide = suggéré {formaterMontant(suggestions.prixVenteKmSuggere)})</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {deplacements.map((ligne) => {
              const prixEffectif = ligne.prixKm ?? suggestions.prixVenteKmSuggere
              const total = calculerTotalLigne(ligne.distanceKm, prixEffectif)
              return (
                <tr key={ligne.id}>
                  <td>
                    <input
                      value={ligne.description}
                      onChange={(e) => modifierDeplacement({ ...ligne, description: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="1"
                      value={ligne.distanceKm}
                      onChange={(e) => modifierDeplacement({ ...ligne, distanceKm: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.05"
                      placeholder={suggestions.prixVenteKmSuggere.toFixed(2)}
                      value={ligne.prixKm ?? ''}
                      onChange={(e) =>
                        modifierDeplacement({
                          ...ligne,
                          prixKm: e.target.value === '' ? null : Number(e.target.value)
                        })
                      }
                    />
                  </td>
                  <td>{formaterMontant(total)}</td>
                  <td>
                    <button className="action-ecriture bouton-danger" onClick={() => supprimerDeplacement(ligne.id)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button className="action-ecriture" onClick={ajouterDeplacement}>+ Ajouter un déplacement</button>
      </div>

      {messageErreur && <p className="erreur">{messageErreur}</p>}
    </div>
  )
}
