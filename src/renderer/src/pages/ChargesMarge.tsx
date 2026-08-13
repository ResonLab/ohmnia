import { useEffect, useState } from 'react'
import type {
  ChargeFixe,
  ParametresDeplacement,
  ParametresImpressionDb,
  ParametresMarge
} from '../../../shared/types'
import {
  calculerCoutCarburantKm,
  calculerCoutHoraireRevient,
  calculerCoutRevientFacture,
  calculerCoutRevientKm,
  calculerMargeSuggeree,
  calculerPrixFactureImpression,
  calculerPrixVenteKm,
  calculerTauxHoraireSuggere
} from '../../../shared/calculs'
import { formaterMontant, symboleDevise } from '../lib/devise'
import { t } from '../../../shared/i18n'
import { CATEGORIES_CHARGES, VALEURS_CATEGORIES_CHARGES } from '../../../shared/charges'


export default function ChargesMarge(): React.JSX.Element {
  const [charges, setCharges] = useState<ChargeFixe[]>([])
  const [margeParams, setMargeParams] = useState<ParametresMarge>({
    heuresFacturablesMois: 0,
    caEstimeMensuel: 0
  })
  const [deplacementParams, setDeplacementParams] = useState<ParametresDeplacement>({
    consoL100km: 0,
    prixEssence: 0,
    entretienKm: 0,
    margeLivraisonPct: 0
  })
  const [impressionParams, setImpressionParams] = useState<ParametresImpressionDb>({
    prixSachetA4: 0,
    feuillesParSachet: 0,
    feuillesParFacture: 1,
    prixImprimante: 0,
    nbFacturesAvantRemplacement: 0,
    prixEncre: 0,
    feuillesParCartouche: 0,
    prixTimbre: 0,
    prixSachetEnveloppes: 0,
    nbEnveloppesParSachet: 0,
    margeImpressionPct: 0
  })
  const [chargement, setChargement] = useState(true)
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      window.api.chargesFixes.lister(),
      window.api.parametresMarge.lire(),
      window.api.parametresDeplacement.lire(),
      window.api.parametresImpression.lire()
    ])
      .then(([c, m, d, i]) => {
        setCharges(c)
        setMargeParams(m)
        setDeplacementParams(d)
        setImpressionParams(i)
      })
      .finally(() => setChargement(false))
  }, [])

  function afficherSucces(message: string): void {
    setMessageErreur(null)
    setMessageSucces(message)
    setTimeout(() => setMessageSucces(null), 2500)
  }

  function afficherErreur(erreur: unknown): void {
    setMessageSucces(null)
    setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
  }

  async function ajouterCharge(): Promise<void> {
    try {
      const nouvelle = await window.api.chargesFixes.ajouter({
        libelle: t('charge.nouvelle'),
        montantMensuel: 0,
        categorie: VALEURS_CATEGORIES_CHARGES[0],
        actif: true
      })
      setCharges((precedent) => [...precedent, nouvelle])
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function modifierCharge(charge: ChargeFixe): Promise<void> {
    try {
      await window.api.chargesFixes.modifier(charge)
      setCharges((precedent) => precedent.map((c) => (c.id === charge.id ? charge : c)))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function supprimerCharge(id: number): Promise<void> {
    await window.api.chargesFixes.supprimer(id)
    setCharges((precedent) => precedent.filter((c) => c.id !== id))
  }

  async function enregistrerMarge(): Promise<void> {
    try {
      const misAJour = await window.api.parametresMarge.enregistrer(margeParams)
      setMargeParams(misAJour)
      afficherSucces(t('charge.margeEnregistree'))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function enregistrerDeplacement(): Promise<void> {
    try {
      const misAJour = await window.api.parametresDeplacement.enregistrer(deplacementParams)
      setDeplacementParams(misAJour)
      afficherSucces(t('charge.deplacementEnregistre'))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function enregistrerImpression(): Promise<void> {
    try {
      const misAJour = await window.api.parametresImpression.enregistrer(impressionParams)
      setImpressionParams(misAJour)
      afficherSucces(t('charge.impressionEnregistree'))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  if (chargement) return <p>{t('etat.chargement')}</p>

  const chargesFixesTotalMensuel = charges
    .filter((c) => c.actif)
    .reduce((total, c) => total + c.montantMensuel, 0)

  const margeSuggeree = calculerMargeSuggeree(chargesFixesTotalMensuel, margeParams.caEstimeMensuel)
  const coutHoraireRevient = calculerCoutHoraireRevient(
    chargesFixesTotalMensuel,
    margeParams.heuresFacturablesMois
  )
  const tauxHoraireSuggere = calculerTauxHoraireSuggere(coutHoraireRevient, margeSuggeree)

  const coutCarburantKm = calculerCoutCarburantKm(
    deplacementParams.consoL100km,
    deplacementParams.prixEssence
  )
  const coutRevientKm = calculerCoutRevientKm(coutCarburantKm, deplacementParams.entretienKm)
  const prixVenteKm = calculerPrixVenteKm(coutRevientKm, deplacementParams.margeLivraisonPct)

  const coutRevientFacture = calculerCoutRevientFacture(impressionParams)
  const prixFactureImpression = calculerPrixFactureImpression(impressionParams)

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>{t('charge.titre')}</h2>
        <table className="table-editable">
          <thead>
            <tr>
              <th>{t('charge.libelle')}</th>
              <th>{t('charge.categorie')}</th>
              <th>{t('charge.montantMois', { devise: symboleDevise() })}</th>
              <th>{t('charge.actif')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {charges.map((charge) => (
              <tr key={charge.id}>
                <td>
                  <input
                    value={charge.libelle}
                    onChange={(e) => modifierCharge({ ...charge, libelle: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={charge.categorie}
                    onChange={(e) => modifierCharge({ ...charge, categorie: e.target.value })}
                  >
                    {CATEGORIES_CHARGES.map((cat) => (
                      <option key={cat.valeur} value={cat.valeur}>
                        {t(cat.cle)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    step="0.05"
                    value={charge.montantMensuel}
                    onChange={(e) =>
                      modifierCharge({ ...charge, montantMensuel: Number(e.target.value) })
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={charge.actif}
                    onChange={(e) => modifierCharge({ ...charge, actif: e.target.checked })}
                  />
                </td>
                <td>
                  <button className="action-administration bouton-danger" onClick={() => supprimerCharge(charge.id)}>
                    {t('action.supprimer')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="action-administration" onClick={ajouterCharge}>{t('charge.ajouter')}</button>
        <p className="valeur-calculee">
          {t('charge.totalActives')}{' '}
          <strong>{t('charge.parMois', { montant: formaterMontant(chargesFixesTotalMensuel) })}</strong>
        </p>
      </div>

      <div className="carte">
        <h2>{t('charge.margeTitre')}</h2>
        <label>
          {t('charge.heuresFacturables')}
          <input
            type="number"
            step="1"
            value={margeParams.heuresFacturablesMois}
            onChange={(e) =>
              setMargeParams({ ...margeParams, heuresFacturablesMois: Number(e.target.value) })
            }
          />
        </label>
        <label>
          {t('charge.caEstime', { devise: symboleDevise() })}
          <input
            type="number"
            step="10"
            value={margeParams.caEstimeMensuel}
            onChange={(e) => setMargeParams({ ...margeParams, caEstimeMensuel: Number(e.target.value) })}
          />
        </label>
        <button className="action-administration" onClick={enregistrerMarge}>{t('action.enregistrer')}</button>

        <div className="resultats-calcules">
          <p>
            {t('charge.coutHoraire')}{' '}
            <strong>{t('charge.parHeure', { montant: formaterMontant(coutHoraireRevient) })}</strong>
          </p>
          <p>
            {t('charge.margeSuggeree')} <strong>{(margeSuggeree * 100).toFixed(1)} %</strong>
            {chargesFixesTotalMensuel <= 0 && t('charge.margeDefaut')}
          </p>
          <p>
            {t('charge.tauxSuggere')}{' '}
            <strong>{t('charge.parHeure', { montant: formaterMontant(tauxHoraireSuggere) })}</strong>
          </p>
        </div>
      </div>

      <div className="carte">
        <h2>{t('charge.deplacementTitre')}</h2>
        <label>
          {t('charge.consommation')}
          <input
            type="number"
            step="0.1"
            value={deplacementParams.consoL100km}
            onChange={(e) =>
              setDeplacementParams({ ...deplacementParams, consoL100km: Number(e.target.value) })
            }
          />
        </label>
        <label>
          {t('charge.prixEssence', { devise: symboleDevise() })}
          <input
            type="number"
            step="0.01"
            value={deplacementParams.prixEssence}
            onChange={(e) =>
              setDeplacementParams({ ...deplacementParams, prixEssence: Number(e.target.value) })
            }
          />
        </label>
        <label>
          {t('charge.entretienKm', { devise: symboleDevise() })}
          <input
            type="number"
            step="0.01"
            value={deplacementParams.entretienKm}
            onChange={(e) =>
              setDeplacementParams({ ...deplacementParams, entretienKm: Number(e.target.value) })
            }
          />
        </label>
        <label>
          {t('charge.margeLivraison')}
          <input
            type="number"
            step="1"
            value={deplacementParams.margeLivraisonPct}
            onChange={(e) =>
              setDeplacementParams({ ...deplacementParams, margeLivraisonPct: Number(e.target.value) })
            }
          />
        </label>
        <button className="action-administration" onClick={enregistrerDeplacement}>{t('action.enregistrer')}</button>

        <div className="resultats-calcules">
          <p>
            {t('charge.coutCarburantKm')}{' '}
            <strong>{t('charge.parKm', { montant: formaterMontant(coutCarburantKm) })}</strong>
          </p>
          <p>
            {t('charge.coutRevientKm')}{' '}
            <strong>{t('charge.parKm', { montant: formaterMontant(coutRevientKm) })}</strong>
          </p>
          <p>
            {t('charge.prixVenteKm')}{' '}
            <strong>{t('charge.parKm', { montant: formaterMontant(prixVenteKm) })}</strong>
          </p>
        </div>
      </div>

      <div className="carte">
        <h2>{t('charge.impressionTitre')}</h2>
        <label>
          {t('charge.prixSachetA4')}
          <input
            type="number"
            step="0.1"
            value={impressionParams.prixSachetA4}
            onChange={(e) =>
              setImpressionParams({ ...impressionParams, prixSachetA4: Number(e.target.value) })
            }
          />
        </label>
        <label>
          {t('charge.feuillesParSachet')}
          <input
            type="number"
            step="1"
            value={impressionParams.feuillesParSachet}
            onChange={(e) =>
              setImpressionParams({ ...impressionParams, feuillesParSachet: Number(e.target.value) })
            }
          />
        </label>
        <label>
          {t('charge.feuillesParFacture')}
          <input
            type="number"
            step="1"
            value={impressionParams.feuillesParFacture}
            onChange={(e) =>
              setImpressionParams({ ...impressionParams, feuillesParFacture: Number(e.target.value) })
            }
          />
        </label>
        <label>
          {t('charge.prixImprimante')}
          <input
            type="number"
            step="1"
            value={impressionParams.prixImprimante}
            onChange={(e) =>
              setImpressionParams({ ...impressionParams, prixImprimante: Number(e.target.value) })
            }
          />
        </label>
        <label>
          {t('charge.facturesAvantRemplacement')}
          <input
            type="number"
            step="1"
            value={impressionParams.nbFacturesAvantRemplacement}
            onChange={(e) =>
              setImpressionParams({
                ...impressionParams,
                nbFacturesAvantRemplacement: Number(e.target.value)
              })
            }
          />
        </label>
        <label>
          {t('charge.prixCartouche')}
          <input
            type="number"
            step="0.1"
            value={impressionParams.prixEncre}
            onChange={(e) => setImpressionParams({ ...impressionParams, prixEncre: Number(e.target.value) })}
          />
        </label>
        <label>
          {t('charge.feuillesParCartouche')}
          <input
            type="number"
            step="1"
            value={impressionParams.feuillesParCartouche}
            onChange={(e) =>
              setImpressionParams({ ...impressionParams, feuillesParCartouche: Number(e.target.value) })
            }
          />
        </label>
        <label>
          {t('charge.prixTimbre')}
          <input
            type="number"
            step="0.05"
            value={impressionParams.prixTimbre}
            onChange={(e) => setImpressionParams({ ...impressionParams, prixTimbre: Number(e.target.value) })}
          />
        </label>
        <label>
          {t('charge.prixSachetEnveloppes')}
          <input
            type="number"
            step="0.1"
            value={impressionParams.prixSachetEnveloppes}
            onChange={(e) =>
              setImpressionParams({ ...impressionParams, prixSachetEnveloppes: Number(e.target.value) })
            }
          />
        </label>
        <label>
          {t('charge.enveloppesParSachet')}
          <input
            type="number"
            step="1"
            value={impressionParams.nbEnveloppesParSachet}
            onChange={(e) =>
              setImpressionParams({ ...impressionParams, nbEnveloppesParSachet: Number(e.target.value) })
            }
          />
        </label>
        <label>
          {t('charge.margeImpression')}
          <input
            type="number"
            step="1"
            value={impressionParams.margeImpressionPct}
            onChange={(e) =>
              setImpressionParams({ ...impressionParams, margeImpressionPct: Number(e.target.value) })
            }
          />
        </label>
        <button className="action-administration" onClick={enregistrerImpression}>{t('action.enregistrer')}</button>

        <div className="resultats-calcules">
          <p>
            {t('charge.coutRevientFacture')} <strong>{formaterMontant(coutRevientFacture)}</strong>
          </p>
          <p>
            {t('charge.prixFactureClient')} <strong>{formaterMontant(prixFactureImpression)}</strong>
          </p>
        </div>
      </div>

      {messageErreur && <p className="erreur">{messageErreur}</p>}
      {messageSucces && <p className="succes">{messageSucces}</p>}
    </div>
  )
}
