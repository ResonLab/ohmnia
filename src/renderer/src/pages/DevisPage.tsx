import { useEffect, useState } from 'react'
import type {
  DevisDetail,
  DevisLigne,
  HistoriqueDevis,
  ModelePrestation,
  StatutDevis
} from '../../../shared/types'
import { calculerDateValidite, calculerTotalDocument } from '../../../shared/calculs'
import ClientSelecteur from '../components/ClientSelecteur'
import Modale from '../components/Modale'
import { formaterMontant } from '../lib/devise'

function ligneVide(): DevisLigne {
  return { id: -Date.now(), designation: '', quantite: 1, prixUnitaire: 0 }
}

export default function DevisPage(): React.JSX.Element {
  const [historique, setHistorique] = useState<HistoriqueDevis[]>([])
  const [brouillon, setBrouillon] = useState<DevisDetail | null>(null)
  const [clientIdNouveau, setClientIdNouveau] = useState<number | null>(null)
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [messageInfo, setMessageInfo] = useState<string | null>(null)
  const [modeles, setModeles] = useState<ModelePrestation[]>([])
  const [modeleAInserer, setModeleAInserer] = useState(false)

  async function rechargerHistorique(): Promise<void> {
    setHistorique(await window.api.devis.historique())
  }

  useEffect(() => {
    rechargerHistorique()
    window.api.modeles.lister().then(setModeles)
  }, [])

  function afficherErreur(erreur: unknown): void {
    setMessageInfo(null)
    setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
  }

  async function creerBrouillon(): Promise<void> {
    setMessageErreur(null)
    if (!clientIdNouveau) {
      setMessageErreur('Choisissez d\'abord un client pour créer le devis.')
      return
    }
    try {
      const detail = await window.api.devis.creerBrouillon(clientIdNouveau)
      setBrouillon({ ...detail, lignes: [ligneVide()] })
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function ouvrirBrouillon(id: number): Promise<void> {
    setMessageErreur(null)
    try {
      const detail = await window.api.devis.obtenirDetail(id)
      setBrouillon({ ...detail, lignes: detail.lignes.length ? detail.lignes : [ligneVide()] })
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function enregistrerBrouillon(): Promise<DevisDetail | null> {
    if (!brouillon) return null
    try {
      const misAJour = await window.api.devis.enregistrer(brouillon)
      setBrouillon({ ...misAJour, lignes: misAJour.lignes.length ? misAJour.lignes : [ligneVide()] })
      await rechargerHistorique()
      setMessageErreur(null)
      setMessageInfo('Devis enregistré.')
      return misAJour
    } catch (erreur) {
      afficherErreur(erreur)
      return null
    }
  }

  async function exporterPdf(): Promise<void> {
    if (!brouillon) return
    const misAJour = await enregistrerBrouillon()
    if (!misAJour) return
    try {
      const chemin = await window.api.pdf.generer('devis', misAJour.id)
      setMessageInfo(`PDF exporté : ${chemin}`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  /** Insère les lignes d'un modèle à la suite de celles déjà saisies. */
  function insererModele(modeleId: number): void {
    if (!brouillon) return
    const modele = modeles.find((m) => m.id === modeleId)
    if (!modele) return

    const nouvellesLignes: DevisLigne[] = modele.lignes.map((l, index) => ({
      id: -Date.now() - index,
      designation: l.designation,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire
    }))

    const lignesUtiles = brouillon.lignes.filter((l) => l.designation.trim())
    setBrouillon({ ...brouillon, lignes: [...lignesUtiles, ...nouvellesLignes] })
    setModeleAInserer(false)
    setMessageErreur(null)
    setMessageInfo(`${nouvellesLignes.length} ligne(s) insérée(s) depuis « ${modele.nom} ».`)
  }

  async function dupliquerDevis(id: number): Promise<void> {
    try {
      const copie = await window.api.devis.dupliquer(id)
      await rechargerHistorique()
      setBrouillon({ ...copie, lignes: copie.lignes.length ? copie.lignes : [ligneVide()] })
      setMessageErreur(null)
      setMessageInfo(`Devis dupliqué sous le numéro ${copie.numero}.`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function convertirEnFacture(id: number): Promise<void> {
    try {
      const facture = await window.api.factures.creerDepuisDevis(id)
      await rechargerHistorique()
      setMessageErreur(null)
      setMessageInfo(
        `Facture ${facture.numero} créée depuis ce devis. Ouvre le module Facturation pour la compléter.`
      )
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function changerStatut(id: number, statut: StatutDevis): Promise<void> {
    await window.api.devis.changerStatut(id, statut)
    await rechargerHistorique()
  }

  async function supprimerDevis(id: number): Promise<void> {
    if (!window.confirm('Supprimer définitivement ce devis ?')) return
    await window.api.devis.supprimer(id)
    if (brouillon?.id === id) setBrouillon(null)
    await rechargerHistorique()
  }

  function modifierLigne(index: number, ligne: DevisLigne): void {
    if (!brouillon) return
    const lignes = [...brouillon.lignes]
    lignes[index] = ligne
    setBrouillon({ ...brouillon, lignes })
  }

  function supprimerLigne(index: number): void {
    if (!brouillon) return
    const lignes = brouillon.lignes.filter((_, i) => i !== index)
    setBrouillon({ ...brouillon, lignes: lignes.length ? lignes : [ligneVide()] })
  }

  const totaux = brouillon
    ? calculerTotalDocument(brouillon.lignes, brouillon.remisePct, brouillon.tvaPct)
    : null

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>Nouveau devis</h2>
        <div className="ligne-formulaire">
          <label>
            Client
            <ClientSelecteur clientId={clientIdNouveau} onChange={setClientIdNouveau} />
          </label>
        </div>
        <button className="action-ecriture" onClick={creerBrouillon}>Créer un brouillon de devis</button>
      </div>

      {brouillon && (
        <div className="carte">
          <h2>Devis {brouillon.numero} (brouillon interne)</h2>

          <div className="ligne-formulaire">
            <label>
              Numéro
              <input
                value={brouillon.numero}
                onChange={(e) => setBrouillon({ ...brouillon, numero: e.target.value })}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={brouillon.date}
                onChange={(e) => setBrouillon({ ...brouillon, date: e.target.value })}
              />
            </label>
            <label>
              Validité (jours)
              <input
                type="number"
                step="1"
                value={brouillon.validiteJours}
                onChange={(e) => setBrouillon({ ...brouillon, validiteJours: Number(e.target.value) })}
              />
            </label>
            <label>
              Valable jusqu'au
              <input readOnly value={calculerDateValidite(brouillon.date, brouillon.validiteJours)} />
            </label>
            <label>
              Client
              <ClientSelecteur
                clientId={brouillon.clientId}
                onChange={(clientId) => setBrouillon({ ...brouillon, clientId })}
              />
            </label>
          </div>

          <table className="table-editable">
            <thead>
              <tr>
                <th>Désignation</th>
                <th>Qté</th>
                <th>Prix unitaire</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {brouillon.lignes.map((ligne, index) => (
                <tr key={ligne.id}>
                  <td>
                    <input
                      value={ligne.designation}
                      onChange={(e) => modifierLigne(index, { ...ligne, designation: e.target.value })}
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
                    <button className="action-ecriture bouton-danger" onClick={() => supprimerLigne(index)}>
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="barre-boutons" style={{ marginTop: 0 }}>
            <button className="action-ecriture" onClick={() => setBrouillon({ ...brouillon, lignes: [...brouillon.lignes, ligneVide()] })}>
              + Ajouter une ligne
            </button>
            {modeles.length > 0 && (
              <button className="action-ecriture bouton-secondaire" onClick={() => setModeleAInserer(true)}>
                Insérer un modèle
              </button>
            )}
          </div>

          <div className="ligne-formulaire" style={{ marginTop: '1rem' }}>
            <label>
              Remise (%)
              <input
                type="number"
                step="1"
                value={brouillon.remisePct}
                onChange={(e) => setBrouillon({ ...brouillon, remisePct: Number(e.target.value) })}
              />
            </label>
            <label>
              TVA (%)
              <input
                type="number"
                step="0.1"
                value={brouillon.tvaPct}
                onChange={(e) => setBrouillon({ ...brouillon, tvaPct: Number(e.target.value) })}
              />
            </label>
            <label>
              Statut
              <select
                value={brouillon.statut}
                onChange={(e) => setBrouillon({ ...brouillon, statut: e.target.value as StatutDevis })}
              >
                <option value="En attente">En attente</option>
                <option value="Accepté">Accepté</option>
                <option value="Refusé">Refusé</option>
              </select>
            </label>
          </div>

          {totaux && (
            <div className="resultats-calcules">
              <p>Sous-total : {formaterMontant(totaux.sousTotal)}</p>
              {brouillon.remisePct > 0 && <p>Remise : {brouillon.remisePct}%</p>}
              <p>
                TVA ({brouillon.tvaPct}%) : {formaterMontant(totaux.montantTva)}
              </p>
              <p>
                <strong>TOTAL DEVIS : {formaterMontant(totaux.total)}</strong>
              </p>
            </div>
          )}

          <div className="barre-boutons">
            <button className="action-ecriture" onClick={enregistrerBrouillon}>Enregistrer</button>
            <button onClick={exporterPdf}>Exporter en PDF</button>
          </div>
        </div>
      )}

      <div className="carte">
        <h2>Historique des devis</h2>
        <table className="table-editable">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Date</th>
              <th>Client</th>
              <th>Statut</th>
              <th>Total</th>
              <th>Facturé</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {historique.map((devis) => (
              <tr key={devis.id}>
                <td>{devis.numero}</td>
                <td>{devis.date}</td>
                <td>{devis.clientNom}</td>
                <td>
                  <select
                    value={devis.statut}
                    onChange={(e) => changerStatut(devis.id, e.target.value as StatutDevis)}
                  >
                    <option value="En attente">En attente</option>
                    <option value="Accepté">Accepté</option>
                    <option value="Refusé">Refusé</option>
                  </select>
                </td>
                <td>{formaterMontant(devis.total)}</td>
                <td className="colonne-etroite">{devis.factureLiee ?? '—'}</td>
                <td className="cellule-actions">
                  <button onClick={() => ouvrirBrouillon(devis.id)}>Ouvrir</button>
                  <button className="action-ecriture" onClick={() => dupliquerDevis(devis.id)}>Dupliquer</button>
                  {!devis.factureLiee && (
                    <button className="action-ecriture" onClick={() => convertirEnFacture(devis.id)}>→ Facture</button>
                  )}
                  <button className="action-ecriture bouton-danger" onClick={() => supprimerDevis(devis.id)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modeleAInserer && (
        <Modale titre="Insérer un modèle de prestations" onFermer={() => setModeleAInserer(false)}>
          <p>Les lignes du modèle seront ajoutées à la suite de celles déjà saisies.</p>
          <ul className="liste-modeles">
            {modeles.map((m) => (
              <li key={m.id}>
                <button className="action-ecriture" onClick={() => insererModele(m.id)}>
                  <span className="liste-clients-nom">{m.nom}</span>
                  <span className="liste-clients-meta">{m.lignes.length} ligne(s)</span>
                </button>
              </li>
            ))}
          </ul>
        </Modale>
      )}

      {messageErreur && <p className="erreur">{messageErreur}</p>}
      {messageInfo && <p className="succes" style={{ whiteSpace: 'pre-line' }}>{messageInfo}</p>}
    </div>
  )
}
