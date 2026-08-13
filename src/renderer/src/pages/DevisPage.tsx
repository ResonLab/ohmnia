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
import { t } from '../../../shared/i18n'
import { STATUTS_DEVIS } from '../../../shared/documents'

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
      setMessageErreur(t('devis.choisirClient'))
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
      setMessageInfo(t('devis.enregistre'))
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
      setMessageInfo(t('devis.pdfExporte', { chemin }))
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
    setMessageInfo(
      t('devis.lignesInserees', { nombre: nouvellesLignes.length, modele: modele.nom })
    )
  }

  async function dupliquerDevis(id: number): Promise<void> {
    try {
      const copie = await window.api.devis.dupliquer(id)
      await rechargerHistorique()
      setBrouillon({ ...copie, lignes: copie.lignes.length ? copie.lignes : [ligneVide()] })
      setMessageErreur(null)
      setMessageInfo(t('devis.duplique', { numero: copie.numero }))
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
        t('devis.factureCreee', { numero: facture.numero })
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
    if (!window.confirm(t('devis.confirmerSuppression'))) return
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
        <h2>{t('devis.nouveau')}</h2>
        <div className="ligne-formulaire">
          <label>
            {t('colonne.client')}
            <ClientSelecteur clientId={clientIdNouveau} onChange={setClientIdNouveau} />
          </label>
        </div>
        <button className="action-ecriture" onClick={creerBrouillon}>{t('devis.creerBrouillon')}</button>
      </div>

      {brouillon && (
        <div className="carte">
          <h2>Devis {brouillon.numero} (brouillon interne)</h2>

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
              {t('devis.validiteJours')}
              <input
                type="number"
                step="1"
                value={brouillon.validiteJours}
                onChange={(e) => setBrouillon({ ...brouillon, validiteJours: Number(e.target.value) })}
              />
            </label>
            <label>
              {t('doc.valableJusquau')}
              <input readOnly value={calculerDateValidite(brouillon.date, brouillon.validiteJours)} />
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
            <label>
              {t('devis.statut')}
              <select
                value={brouillon.statut}
                onChange={(e) => setBrouillon({ ...brouillon, statut: e.target.value as StatutDevis })}
              >
                {STATUTS_DEVIS.map((statut) => (
                  <option key={statut.valeur} value={statut.valeur}>
                    {t(statut.cle)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {totaux && (
            <div className="resultats-calcules">
              <p>{t('devis.sousTotal', { montant: formaterMontant(totaux.sousTotal) })}</p>
              {brouillon.remisePct > 0 && <p>{t('devis.remiseLigne', { pct: brouillon.remisePct })}</p>}
              <p>
                {t('devis.tvaLigne', {
                  pct: brouillon.tvaPct,
                  montant: formaterMontant(totaux.montantTva)
                })}
              </p>
              <p>
                <strong>{t('devis.totalLigne', { montant: formaterMontant(totaux.total) })}</strong>
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
        <h2>{t('devis.historique')}</h2>
        <table className="table-editable">
          <thead>
            <tr>
              <th>{t('devis.numero')}</th>
              <th>{t('colonne.date')}</th>
              <th>{t('colonne.client')}</th>
              <th>{t('devis.statut')}</th>
              <th>Total</th>
              <th>{t('devis.facture')}</th>
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
                    {STATUTS_DEVIS.map((statut) => (
                      <option key={statut.valeur} value={statut.valeur}>
                        {t(statut.cle)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{formaterMontant(devis.total)}</td>
                <td className="colonne-etroite">{devis.factureLiee ?? '—'}</td>
                <td className="cellule-actions">
                  <button onClick={() => ouvrirBrouillon(devis.id)}>{t('devis.ouvrir')}</button>
                  <button className="action-ecriture" onClick={() => dupliquerDevis(devis.id)}>{t('devis.dupliquer')}</button>
                  {!devis.factureLiee && (
                    <button className="action-ecriture" onClick={() => convertirEnFacture(devis.id)}>{t('devis.versFacture')}</button>
                  )}
                  <button className="action-ecriture bouton-danger" onClick={() => supprimerDevis(devis.id)}>
                    {t('action.supprimer')}
                  </button>
                </td>
              </tr>
            ))}
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

      {messageErreur && <p className="erreur">{messageErreur}</p>}
      {messageInfo && <p className="succes" style={{ whiteSpace: 'pre-line' }}>{messageInfo}</p>}
    </div>
  )
}
