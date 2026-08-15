import { useEffect, useState } from 'react'
import type {
  FactureDetail,
  FactureLigne,
  HistoriqueFacture,
  Rappel,
  ModelePrestation,
  ParametresImpressionDb,
  StatutFacture
} from '../../../shared/types'
import {
  calculerEcheance,
  calculerPrixFactureImpression,
  calculerTotalDocument
} from '../../../shared/calculs'
import ClientSelecteur from '../components/ClientSelecteur'
import Modale from '../components/Modale'
import { formaterMontant, symboleDevise } from '../lib/devise'
import { ordinal, t } from '../../../shared/i18n'
import { STATUTS_FACTURE } from '../../../shared/documents'
import { NIVEAU_MAX_RELANCE, type RelanceProposee } from '../../../shared/calculs'

/** Ligne vide temporaire (id négatif : elle n'existe pas encore en base). */
function ligneVide(): FactureLigne {
  return { id: -Date.now(), designation: '', referenceInventaire: null, quantite: 1, prixUnitaire: 0 }
}

export default function Facturation(): React.JSX.Element {
  const [historique, setHistorique] = useState<HistoriqueFacture[]>([])
  /**
   * Les rappels déjà envoyés pour une facture, dépliés sous sa ligne.
   *
   * **`rappels:lister` existait de bout en bout et aucun écran ne l'appelait.**
   * On pouvait émettre un rappel sans jamais revoir ce qui était parti : à
   * quelle date, à quel niveau, avec quels frais. Or c'est la première question
   * qu'on se pose avant de relancer une seconde fois, et la carte des relances
   * ne répond qu'à « faut-il relancer », pas à « qu'a-t-on déjà envoyé ».
   *
   * On garde la facture ouverte plutôt qu'une liste : une seule à la fois, et
   * refermer efface — ces lignes ne servent qu'à répondre à une question posée.
   */
  const [rappelsOuverts, setRappelsOuverts] = useState<{ factureId: number; liste: Rappel[] } | null>(null)

  async function basculerRappels(factureId: number): Promise<void> {
    if (rappelsOuverts?.factureId === factureId) {
      setRappelsOuverts(null)
      return
    }
    setRappelsOuverts({ factureId, liste: await window.api.rappels.lister(factureId) })
  }
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

  const [relances, setRelances] = useState<RelanceProposee[]>([])

  const [seuilRelance, setSeuilRelance] = useState(0)

  /**
   * L'historique et les relances sont rechargés ensemble, et c'est délibéré :
   * émettre un rappel change les deux. Les recharger séparément laisserait la
   * liste des relances proposer un rappel qu'on vient d'envoyer.
   */
  async function rechargerHistorique(): Promise<void> {
    setHistorique(await window.api.factures.historique())
    setRelances(await window.api.rappels.aFaire())
  }

  useEffect(() => {
    rechargerHistorique()
    window.api.parametresImpression.lire().then(setImpressionParams)
    window.api.parametresApp.lire().then((p) => setSeuilRelance(p.seuilAlerteFactureJours))
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
      setMessageErreur(t('facture.choisirClient'))
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
      setMessageInfo(t('facture.enregistree'))
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
      setMessageInfo(t('devis.pdfExporte', { chemin }))

      const confirmer = window.confirm(t('facture.confirmerHistorique'))
      if (confirmer) {
        const resultat = await window.api.factures.confirmerEnregistrementHistorique(misAJour.id)
        const messages: string[] = []
        if (resultat.dejaEnregistreeDansJournal) {
          messages.push(t('facture.dejaAuJournal'))
        } else {
          messages.push(
            t('facture.ecritureAjoutee', { montant: formaterMontant(resultat.total) })
          )
        }
        messages.push(...resultat.avertissements)
        setMessageInfo(`${t('devis.pdfExporte', { chemin })}\n${messages.join('\n')}`)
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
    setMessageInfo(
      t('devis.lignesInserees', { nombre: nouvellesLignes.length, modele: modele.nom })
    )
  }

  /** Enregistre les lignes de la facture ouverte comme nouveau modèle réutilisable. */
  async function enregistrerCommeModele(): Promise<void> {
    if (!brouillon) return
    if (!nomNouveauModele.trim()) {
      afficherErreur(new Error(t('facture.nomModele')))
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
      setMessageInfo(
        t('facture.modeleCree', { nom: modele.nom, nombre: modele.lignes.length })
      )
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
      setMessageInfo(t('facture.dupliquee', { numero: copie.numero }))
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
      afficherErreur(new Error(t('facture.fraisRappelInvalides')))
      return
    }

    try {
      const rappel = await window.api.rappels.creer(factureId, niveau, frais)
      const chemin = await window.api.pdf.generer('rappel', factureId, rappel.id)
      setRappelEnCours(null)
      await rechargerHistorique()
      setMessageErreur(null)
      setMessageInfo(t('facture.rappelCree', { rang: ordinal(niveau), chemin }))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function changerStatut(id: number, statut: StatutFacture): Promise<void> {
    await window.api.factures.changerStatut(id, statut)
    await rechargerHistorique()
  }

  async function supprimerFacture(id: number): Promise<void> {
    if (!window.confirm(t('facture.confirmerSuppression'))) return
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
        <h2>{t('facture.nouvelle')}</h2>
        <div className="ligne-formulaire">
          <label>
            {t('colonne.client')}
            <ClientSelecteur clientId={clientIdNouveau} onChange={setClientIdNouveau} />
          </label>
        </div>
        <button className="action-ecriture" onClick={creerBrouillon}>{t('facture.creerBrouillon')}</button>
      </div>

      {brouillon && (
        <div className="carte">
          <h2>Facture {brouillon.numero} (brouillon interne)</h2>

          <div className="ligne-formulaire">
            <label>
              {t('devis.numero')}
              <input
                value={brouillon.numero}
                onChange={(e) => setBrouillon({ ...brouillon, numero: e.target.value })}
              />
            </label>
            <label>
              {t('colonne.date')}
              <input
                type="date"
                value={brouillon.date}
                onChange={(e) => setBrouillon({ ...brouillon, date: e.target.value })}
              />
            </label>
            <label>
              {t('facture.delaiPaiement')}
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
              {t('facture.echeanceCalculee')}
              <input readOnly value={calculerEcheance(brouillon.date, brouillon.delaiPaiementJours)} />
            </label>
            <label>
              {t('colonne.client')}
              <ClientSelecteur
                clientId={brouillon.clientId}
                onChange={(clientId) => setBrouillon({ ...brouillon, clientId })}
              />
            </label>
          </div>

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
                    <button className="action-ecriture bouton-danger" onClick={() => supprimerLigne(index)}>
                      {t('devis.retirer')}
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
                {t('devis.insererModele')}
              </button>
            )}
            <button className="action-ecriture bouton-secondaire" onClick={() => setModeleAEnregistrer(true)}>
              {t('facture.enregistrerCommeModele')}
            </button>
          </div>

          <div className="ligne-formulaire" style={{ marginTop: '1rem' }}>
            <label>
              {t('devis.remisePct')}
              <input
                type="number"
                step="1"
                value={brouillon.remisePct}
                onChange={(e) => setBrouillon({ ...brouillon, remisePct: Number(e.target.value) })}
              />
            </label>
            <label>
              {t('devis.tvaPct')}
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
              {t('facture.aImprimer')}
            </label>
            <label>
              {t('devis.statut')}
              <select
                value={brouillon.statut}
                onChange={(e) => setBrouillon({ ...brouillon, statut: e.target.value as StatutFacture })}
              >
                {STATUTS_FACTURE.map((statut) => (
                  <option key={statut.valeur} value={statut.valeur}>
                    {t(statut.cle)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            {t('facture.notesInternes')}
            <textarea
              value={brouillon.notesInternes}
              onChange={(e) => setBrouillon({ ...brouillon, notesInternes: e.target.value })}
            />
          </label>

          {totaux && (
            <div className="resultats-calcules">
              <p>{t('devis.sousTotal', { montant: formaterMontant(totaux.sousTotal) })}</p>
              {brouillon.remisePct > 0 && <p>{t('devis.remiseLigne', { pct: brouillon.remisePct })}</p>}
              {fraisImpression > 0 && (
                <p>{t('facture.fraisImpression', { montant: formaterMontant(fraisImpression) })}</p>
              )}
              <p>
                {t('devis.tvaLigne', {
                  pct: brouillon.tvaPct,
                  montant: formaterMontant(totaux.montantTva)
                })}
              </p>
              <p>
                <strong>{t('facture.totalAPayer', { montant: formaterMontant(totaux.total) })}</strong>
              </p>
            </div>
          )}

          <div className="barre-boutons">
            <button className="action-ecriture" onClick={enregistrerBrouillon}>{t('action.enregistrer')}</button>
            <button onClick={exporterPdf}>{t('devis.exporterPdf')}</button>
          </div>
        </div>
      )}

      <div className="carte">
        <h2>{t('relance.titre')}</h2>
        <p className="valeur-calculee">
          {t('relance.aide', { seuil: seuilRelance })}
        </p>
        {relances.length === 0 ? (
          <p className="graphique-vide">{t('relance.aucune')}</p>
        ) : (
          <table className="table-editable">
            <tbody>
              {relances.map((relance) => (
                <tr key={relance.factureId}>
                  <td className="colonne-etroite">{relance.numero}</td>
                  <td>{relance.clientNom}</td>
                  <td className="colonne-etroite texte-alerte">
                    {t('relance.retard', { jours: relance.joursDeRetard })}
                  </td>
                  <td className="colonne-etroite">
                    {relance.joursDepuisDernierRappel === null
                      ? t('relance.jamaisRelancee')
                      : t('relance.dernierRappel', { jours: relance.joursDepuisDernierRappel })}
                  </td>
                  <td>
                    {/* Une facture épuisée reste affichée — elle est le vrai
                        problème — mais sans bouton : proposer un quatrième
                        rappel serait proposer ce qui ne marche pas. */}
                    {relance.epuisee ? (
                      <span className="discret">
                        {t('relance.epuisee', { max: NIVEAU_MAX_RELANCE })}
                      </span>
                    ) : (
                      <button
                        className="action-ecriture"
                        onClick={() => ouvrirModaleRappel(relance.factureId)}
                      >
                        {t('relance.emettre', { rang: ordinal(relance.niveau) })}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="carte">
        <h2>{t('facture.historique')}</h2>
        <table className="table-editable">
          <thead>
            <tr>
              <th>{t('devis.numero')}</th>
              <th>{t('colonne.date')}</th>
              <th>{t('colonne.client')}</th>
              <th>{t('devis.statut')}</th>
              <th>{t('facture.montantJournal')}</th>
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
                      {STATUTS_FACTURE.map((statut) => (
                        <option key={statut.valeur} value={statut.valeur}>
                          {t(statut.cle)}
                        </option>
                      ))}
                    </select>
                    {enRetard && (
                      <span className="badge-alerte">
                        {t('facture.enAttenteDepuis', { jours: facture.joursEnAttente ?? 0 })}
                      </span>
                    )}
                  </td>
                  <td>{facture.montant === null ? '—' : `${formaterMontant(facture.montant)}`}</td>
                  <td className="cellule-actions">
                    <button onClick={() => ouvrirBrouillon(facture.id)}>{t('devis.ouvrir')}</button>
                    <button className="discret" onClick={() => basculerRappels(facture.id)}>
                      {t('facture.voirRappels')}
                    </button>
                    <button className="action-ecriture" onClick={() => dupliquerFacture(facture.id)}>{t('devis.dupliquer')}</button>
                    {facture.statut === 'En attente' && (
                      <button className="action-ecriture" onClick={() => ouvrirModaleRappel(facture.id)}>{t('facture.rappel')}</button>
                    )}
                    <button className="action-ecriture bouton-danger" onClick={() => supprimerFacture(facture.id)}>
                      {t('action.supprimer')}
                    </button>
                  </td>
                </tr>
              )
            })}
            {/*
              Les rappels de la facture ouverte, sous sa ligne. Une seconde
              ligne de tableau plutôt qu'une modale : on veut lire sans perdre
              de vue la facture dont il s'agit.
            */}
            {rappelsOuverts && (
              <tr>
                <td colSpan={6}>
                  <strong>{t('facture.rappelsEnvoyes')}</strong>
                  {rappelsOuverts.liste.length === 0 ? (
                    <p className="discret">{t('facture.aucunRappel')}</p>
                  ) : (
                    <ul>
                      {rappelsOuverts.liste.map((rappel) => (
                        <li key={rappel.id}>
                          {t('facture.rappelNiveau', {
                            niveau: rappel.niveau,
                            date: rappel.date,
                            frais: formaterMontant(rappel.frais)
                          })}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modeleAInserer && (
        <Modale titre={t('devis.modaleModele')} onFermer={() => setModeleAInserer(false)}>
          <p>{t('devis.modaleAide')}</p>
          <ul className="liste-modeles">
            {modeles.map((m) => (
              <li key={m.id}>
                <button className="action-ecriture" onClick={() => insererModele(m.id)}>
                  <span className="liste-clients-nom">{m.nom}</span>
                  <span className="liste-clients-meta">
                    {t('devis.lignesModele', { nombre: m.lignes.length })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Modale>
      )}

      {modeleAEnregistrer && (
        <Modale
          titre={t('facture.modaleModeleTitre')}
          onFermer={() => setModeleAEnregistrer(false)}
          onValider={enregistrerCommeModele}
          libelleValider={t('facture.modaleModeleValider')}
        >
          <p>
            {t('facture.modaleModeleAide')}
          </p>
          <label>
            {t('facture.nomDuModele')}
            <input
              autoFocus
              placeholder={t('modele.exemple')}
              value={nomNouveauModele}
              onChange={(e) => setNomNouveauModele(e.target.value)}
            />
          </label>
        </Modale>
      )}

      {rappelEnCours && (
        <Modale
          titre={t('facture.modaleRappelTitre', { rang: ordinal(rappelEnCours.niveau) })}
          onFermer={() => setRappelEnCours(null)}
          onValider={confirmerRappel}
          libelleValider={t('facture.modaleRappelValider')}
        >
          <p>
            {t('facture.modaleRappelAide')}
          </p>
          <label>
            {t('facture.fraisRappel', { devise: symboleDevise() })}
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
