import { useEffect, useState } from 'react'
import type {
  FactureDetail,
  FactureLigne,
  HistoriqueFacture,
  ModelePrestation,
  ParametresImpressionDb,
  StatutFacture
} from '../../../shared/types'
import {
  calculerEcheance,
  calculerPrixFactureImpression,
  calculerTotalDocument,
  ordinalFrancais
} from '../../../shared/calculs'
import ClientSelecteur from '../components/ClientSelecteur'
import Modale from '../components/Modale'
import { formaterMontant, symboleDevise } from '../lib/devise'

/** Ligne vide temporaire (id négatif : elle n'existe pas encore en base). */
function ligneVide(): FactureLigne {
  return { id: -Date.now(), designation: '', referenceInventaire: null, quantite: 1, prixUnitaire: 0 }
}

export default function Facturation(): React.JSX.Element {
  const [historique, setHistorique] = useState<HistoriqueFacture[]>([])
  const [brouillon, setBrouillon] = useState<FactureDetail | null>(null)
  const [clientIdNouveau, setClientIdNouveau] = useState<number | null>(null)
  const [impressionParams, setImpressionParams] = useState<ParametresImpressionDb | null>(null)
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [messageInfo, setMessageInfo] = useState<string | null>(null)

  const [seuilAlerteJours, setSeuilAlerteJours] = useState(30)
  const [rappelEnCours, setRappelEnCours] = useState<{
    factureId: number
    niveau: number
    frais: number
  } | null>(null)
  const [modeles, setModeles] = useState<ModelePrestation[]>([])
  const [modeleAInserer, setModeleAInserer] = useState(false)
  const [modeleAEnregistrer, setModeleAEnregistrer] = useState(false)
  const [nomNouveauModele, setNomNouveauModele] = useState('')

  async function rechargerHistorique(): Promise<void> {
    setHistorique(await window.api.factures.historique())
  }

  useEffect(() => {
    rechargerHistorique()
    window.api.parametresImpression.lire().then(setImpressionParams)
    window.api.parametresApp.lire().then((p) => setSeuilAlerteJours(p.seuilAlerteFactureJours))
    window.api.modeles.lister().then(setModeles)
  }, [])

  function afficherErreur(erreur: unknown): void {
    setMessageInfo(null)
    setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
  }

  async function creerBrouillon(): Promise<void> {
    setMessageErreur(null)
    if (!clientIdNouveau) {
      setMessageErreur('Choisissez d\'abord un client pour créer la facture.')
      return
    }
    try {
      const detail = await window.api.factures.creerBrouillon(clientIdNouveau)
      setBrouillon({ ...detail, lignes: [ligneVide()] })
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function ouvrirBrouillon(id: number): Promise<void> {
    setMessageErreur(null)
    try {
      const detail = await window.api.factures.obtenirDetail(id)
      setBrouillon({ ...detail, lignes: detail.lignes.length ? detail.lignes : [ligneVide()] })
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function enregistrerBrouillon(): Promise<FactureDetail | null> {
    if (!brouillon) return null
    try {
      const misAJour = await window.api.factures.enregistrer(brouillon)
      setBrouillon({ ...misAJour, lignes: misAJour.lignes.length ? misAJour.lignes : [ligneVide()] })
      await rechargerHistorique()
      setMessageErreur(null)
      setMessageInfo('Facture enregistrée.')
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
      const chemin = await window.api.pdf.generer('facture', misAJour.id)
      setMessageInfo(`PDF exporté : ${chemin}`)

      const confirmer = window.confirm(
        'Enregistrer cette facture dans l\'historique et dans le Journal ?\n' +
          '(Si elle y est déjà, aucun doublon ne sera créé.)'
      )
      if (confirmer) {
        const resultat = await window.api.factures.confirmerEnregistrementHistorique(misAJour.id)
        const messages: string[] = []
        if (resultat.dejaEnregistreeDansJournal) {
          messages.push('Cette facture était déjà dans le Journal (aucun doublon créé).')
        } else {
          messages.push(`Écriture ajoutée au Journal : ${formaterMontant(resultat.total)}.`)
        }
        messages.push(...resultat.avertissements)
        setMessageInfo(`PDF exporté : ${chemin}\n${messages.join('\n')}`)
        await rechargerHistorique()
      }
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  /** Insère les lignes d'un modèle à la suite de celles déjà saisies. */
  async function insererModele(modeleId: number): Promise<void> {
    if (!brouillon) return
    const modele = modeles.find((m) => m.id === modeleId)
    if (!modele) return

    const nouvellesLignes: FactureLigne[] = modele.lignes.map((l, index) => ({
      id: -Date.now() - index,
      designation: l.designation,
      referenceInventaire: l.referenceInventaire,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire
    }))

    // Les lignes vides existantes sont remplacées plutôt que conservées.
    const lignesUtiles = brouillon.lignes.filter((l) => l.designation.trim())
    setBrouillon({ ...brouillon, lignes: [...lignesUtiles, ...nouvellesLignes] })
    setModeleAInserer(false)
    setMessageErreur(null)
    setMessageInfo(`${nouvellesLignes.length} ligne(s) insérée(s) depuis « ${modele.nom} ».`)
  }

  /** Enregistre les lignes de la facture ouverte comme nouveau modèle réutilisable. */
  async function enregistrerCommeModele(): Promise<void> {
    if (!brouillon) return
    if (!nomNouveauModele.trim()) {
      afficherErreur(new Error('Donne un nom à ce modèle.'))
      return
    }
    try {
      // La facture doit être enregistrée pour que ses lignes existent en base.
      const misAJour = await window.api.factures.enregistrer(brouillon)
      const modele = await window.api.modeles.creerDepuisFacture(misAJour.id, nomNouveauModele)
      setModeles(await window.api.modeles.lister())
      setNomNouveauModele('')
      setModeleAEnregistrer(false)
      setMessageErreur(null)
      setMessageInfo(`Modèle « ${modele.nom} » créé avec ${modele.lignes.length} ligne(s).`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function dupliquerFacture(id: number): Promise<void> {
    try {
      const copie = await window.api.factures.dupliquer(id)
      await rechargerHistorique()
      setBrouillon({ ...copie, lignes: copie.lignes.length ? copie.lignes : [ligneVide()] })
      setMessageErreur(null)
      setMessageInfo(`Facture dupliquée sous le numéro ${copie.numero}.`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  /** Ouvre la modale de rappel en proposant le niveau suivant et les frais d'usage. */
  async function ouvrirModaleRappel(factureId: number): Promise<void> {
    try {
      const { niveau, fraisSuggeres } = await window.api.rappels.prochainNiveau(factureId)
      setRappelEnCours({ factureId, niveau, frais: fraisSuggeres })
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  /** Crée le rappel puis exporte immédiatement le PDF correspondant. */
  async function confirmerRappel(): Promise<void> {
    if (!rappelEnCours) return
    const { factureId, niveau, frais } = rappelEnCours

    if (!Number.isFinite(frais) || frais < 0) {
      afficherErreur(new Error('Les frais de rappel doivent être un nombre positif ou zéro.'))
      return
    }

    try {
      const rappel = await window.api.rappels.creer(factureId, niveau, frais)
      const chemin = await window.api.pdf.generer('rappel', factureId, rappel.id)
      setRappelEnCours(null)
      await rechargerHistorique()
      setMessageErreur(null)
      setMessageInfo(`${ordinalFrancais(niveau)} rappel créé et exporté :\n${chemin}`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function changerStatut(id: number, statut: StatutFacture): Promise<void> {
    await window.api.factures.changerStatut(id, statut)
    await rechargerHistorique()
  }

  async function supprimerFacture(id: number): Promise<void> {
    if (!window.confirm('Supprimer définitivement cette facture ?')) return
    await window.api.factures.supprimer(id)
    if (brouillon?.id === id) setBrouillon(null)
    await rechargerHistorique()
  }

  function modifierLigne(index: number, ligne: FactureLigne): void {
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

  const fraisImpression =
    brouillon?.impressionIncluse && impressionParams ? calculerPrixFactureImpression(impressionParams) : 0

  const totaux = brouillon
    ? calculerTotalDocument(brouillon.lignes, brouillon.remisePct, brouillon.tvaPct, fraisImpression)
    : null

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>Nouvelle facture</h2>
        <div className="ligne-formulaire">
          <label>
            Client
            <ClientSelecteur clientId={clientIdNouveau} onChange={setClientIdNouveau} />
          </label>
        </div>
        <button onClick={creerBrouillon}>Créer un brouillon de facture</button>
      </div>

      {brouillon && (
        <div className="carte">
          <h2>Facture {brouillon.numero} (brouillon interne)</h2>

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
              Délai de paiement (jours)
              <input
                type="number"
                step="1"
                value={brouillon.delaiPaiementJours}
                onChange={(e) =>
                  setBrouillon({ ...brouillon, delaiPaiementJours: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Échéance calculée
              <input readOnly value={calculerEcheance(brouillon.date, brouillon.delaiPaiementJours)} />
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
                <th>Réf. inventaire</th>
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
                    <button className="bouton-danger" onClick={() => supprimerLigne(index)}>
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="barre-boutons" style={{ marginTop: 0 }}>
            <button onClick={() => setBrouillon({ ...brouillon, lignes: [...brouillon.lignes, ligneVide()] })}>
              + Ajouter une ligne
            </button>
            {modeles.length > 0 && (
              <button className="bouton-secondaire" onClick={() => setModeleAInserer(true)}>
                Insérer un modèle
              </button>
            )}
            <button className="bouton-secondaire" onClick={() => setModeleAEnregistrer(true)}>
              Enregistrer comme modèle
            </button>
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
            <label className="case-a-cocher">
              <input
                type="checkbox"
                checked={brouillon.impressionIncluse}
                onChange={(e) => setBrouillon({ ...brouillon, impressionIncluse: e.target.checked })}
              />
              À imprimer / envoyer par courrier
            </label>
            <label>
              Statut
              <select
                value={brouillon.statut}
                onChange={(e) => setBrouillon({ ...brouillon, statut: e.target.value as StatutFacture })}
              >
                <option value="En attente">En attente</option>
                <option value="Payée">Payée</option>
                <option value="Annulée">Annulée</option>
              </select>
            </label>
          </div>

          <label>
            Notes internes (jamais imprimées sur le document client)
            <textarea
              value={brouillon.notesInternes}
              onChange={(e) => setBrouillon({ ...brouillon, notesInternes: e.target.value })}
            />
          </label>

          {totaux && (
            <div className="resultats-calcules">
              <p>Sous-total : {formaterMontant(totaux.sousTotal)}</p>
              {brouillon.remisePct > 0 && <p>Remise : {brouillon.remisePct}%</p>}
              {fraisImpression > 0 && (
                <p>Frais d'impression / envoi : {formaterMontant(fraisImpression)}</p>
              )}
              <p>
                TVA ({brouillon.tvaPct}%) : {formaterMontant(totaux.montantTva)}
              </p>
              <p>
                <strong>TOTAL À PAYER : {formaterMontant(totaux.total)}</strong>
              </p>
            </div>
          )}

          <div className="barre-boutons">
            <button onClick={enregistrerBrouillon}>Enregistrer</button>
            <button onClick={exporterPdf}>Exporter en PDF</button>
          </div>
        </div>
      )}

      <div className="carte">
        <h2>Historique des factures</h2>
        <table className="table-editable">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Date</th>
              <th>Client</th>
              <th>Statut</th>
              <th>Montant (depuis le Journal)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {historique.map((facture) => {
              const enRetard = facture.joursEnAttente !== null && facture.joursEnAttente > seuilAlerteJours
              return (
                <tr key={facture.id} className={enRetard ? 'alerte' : ''}>
                  <td>{facture.numero}</td>
                  <td>{facture.date}</td>
                  <td>{facture.clientNom}</td>
                  <td>
                    <select
                      value={facture.statut}
                      onChange={(e) => changerStatut(facture.id, e.target.value as StatutFacture)}
                    >
                      <option value="En attente">En attente</option>
                      <option value="Payée">Payée</option>
                      <option value="Annulée">Annulée</option>
                    </select>
                    {enRetard && (
                      <span className="badge-alerte">En attente depuis {facture.joursEnAttente} jours</span>
                    )}
                  </td>
                  <td>{facture.montant === null ? '—' : `${formaterMontant(facture.montant)}`}</td>
                  <td className="cellule-actions">
                    <button onClick={() => ouvrirBrouillon(facture.id)}>Ouvrir</button>
                    <button onClick={() => dupliquerFacture(facture.id)}>Dupliquer</button>
                    {facture.statut === 'En attente' && (
                      <button onClick={() => ouvrirModaleRappel(facture.id)}>Rappel</button>
                    )}
                    <button className="bouton-danger" onClick={() => supprimerFacture(facture.id)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modeleAInserer && (
        <Modale titre="Insérer un modèle de prestations" onFermer={() => setModeleAInserer(false)}>
          <p>Les lignes du modèle seront ajoutées à la suite de celles déjà saisies.</p>
          <ul className="liste-modeles">
            {modeles.map((m) => (
              <li key={m.id}>
                <button onClick={() => insererModele(m.id)}>
                  <span className="liste-clients-nom">{m.nom}</span>
                  <span className="liste-clients-meta">{m.lignes.length} ligne(s)</span>
                </button>
              </li>
            ))}
          </ul>
        </Modale>
      )}

      {modeleAEnregistrer && (
        <Modale
          titre="Enregistrer comme modèle"
          onFermer={() => setModeleAEnregistrer(false)}
          onValider={enregistrerCommeModele}
          libelleValider="Créer le modèle"
        >
          <p>
            Les lignes de cette facture seront enregistrées comme modèle réutilisable. La facture est
            enregistrée au passage.
          </p>
          <label>
            Nom du modèle
            <input
              autoFocus
              placeholder="ex. Diagnostic standard"
              value={nomNouveauModele}
              onChange={(e) => setNomNouveauModele(e.target.value)}
            />
          </label>
        </Modale>
      )}

      {rappelEnCours && (
        <Modale
          titre={`Émettre le ${ordinalFrancais(rappelEnCours.niveau)} rappel`}
          onFermer={() => setRappelEnCours(null)}
          onValider={confirmerRappel}
          libelleValider="Créer le rappel et exporter le PDF"
        >
          <p>
            Le rappel reprend les lignes de la facture, y ajoute les frais ci-dessous et recalcule le
            montant total dû.
          </p>
          <label>
            Frais de rappel à facturer ({symboleDevise()})
            <input
              type="number"
              step="0.05"
              min="0"
              autoFocus
              value={rappelEnCours.frais}
              onChange={(e) => setRappelEnCours({ ...rappelEnCours, frais: Number(e.target.value) })}
            />
          </label>
        </Modale>
      )}

      {messageErreur && <p className="erreur">{messageErreur}</p>}
      {messageInfo && <p className="succes" style={{ whiteSpace: 'pre-line' }}>{messageInfo}</p>}
    </div>
  )
}
