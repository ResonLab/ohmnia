import { useEffect, useState } from 'react'
import type { Entreprise } from '../../../shared/types'
import { modeleConditions } from '../../../shared/modeleConditions'
import { t } from '../../../shared/i18n'
import { ecranPays, listePays, profilPays, PAYS_PAR_DEFAUT } from '../../../shared/pays'

const ENTREPRISE_VIDE: Entreprise = {
  nom: '',
  adresse: '',
  email: '',
  telephone: '',
  iban: '',
  titulaireCompte: '',
  tvaDefautPct: 0,
  logoPath: null,
  prefixeFacture: 'F',
  prefixeDevis: 'D',
  assujettiTva: false,
  numeroIde: '',
  conditionsGenerales: '',
  mentionsPied: '',
  pays: PAYS_PAR_DEFAUT
}

export default function Parametres(): React.JSX.Element {
  const [valeurs, setValeurs] = useState<Entreprise>(ENTREPRISE_VIDE)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)

  useEffect(() => {
    window.api.entreprise
      .lire()
      .then(async (entreprise) => {
        setValeurs(entreprise)
        setLogoDataUrl(await window.api.entreprise.lireLogoDataUrl())
      })
      .finally(() => setChargement(false))
  }, [])

  async function choisirLogo(): Promise<void> {
    setMessageErreur(null)
    try {
      const resultat = await window.api.entreprise.choisirLogo()
      if (!resultat) return
      setLogoDataUrl(resultat.dataUrl)
    } catch (erreur) {
      setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
    }
  }

  async function retirerLogo(): Promise<void> {
    setMessageErreur(null)
    try {
      await window.api.entreprise.retirerLogo()
      setLogoDataUrl(null)
    } catch (erreur) {
      setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
    }
  }

  function modifierChamp<K extends keyof Entreprise>(champ: K, valeur: Entreprise[K]): void {
    setValeurs((precedent) => ({ ...precedent, [champ]: valeur }))
  }

  /**
   * Changer de pays réaligne le taux de taxe par défaut sur celui du nouveau pays :
   * conserver un taux suisse sur une facture française n'aurait aucun sens.
   * L'identifiant fiscal est vidé car son format change aussi.
   */
  function changerPays(nouveauPays: string): void {
    const profil = profilPays(nouveauPays)
    setValeurs((precedent) => ({
      ...precedent,
      pays: nouveauPays,
      numeroIde: '',
      tvaDefautPct: precedent.assujettiTva ? profil.tauxTvaParDefaut : 0
    }))
    setMessageSucces(null)
    setMessageErreur(null)
  }

  /** Décocher l'assujettissement remet le taux à zéro, pour ne jamais facturer de taxe par erreur. */
  function changerAssujettissement(assujetti: boolean): void {
    const profil = profilPays(valeurs.pays)
    setValeurs((precedent) => ({
      ...precedent,
      assujettiTva: assujetti,
      tvaDefautPct: assujetti ? profil.tauxTvaParDefaut : 0
    }))
  }

  function insererModeleConditions(): void {
    if (
      valeurs.conditionsGenerales.trim() &&
      !window.confirm(t('ent.remplacerConditions'))
    ) {
      return
    }
    modifierChamp('conditionsGenerales', modeleConditions(valeurs.nom))
  }

  async function enregistrer(): Promise<void> {
    setMessageErreur(null)
    setMessageSucces(null)
    try {
      const misAJour = await window.api.entreprise.enregistrer(valeurs)
      setValeurs(misAJour)
      setMessageSucces(t('ent.enregistre'))
    } catch (erreur) {
      setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
    }
  }

  if (chargement) return <p>{t('action.chargement')}</p>

  const profil = profilPays(valeurs.pays)

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>{t('ent.identite')}</h2>

      <label>
        {t('ent.pays')}
        <select value={valeurs.pays} onChange={(e) => changerPays(e.target.value)}>
          {listePays().map((p) => (
            <option key={p.code} value={p.code}>
              {ecranPays(p).nom}
            </option>
          ))}
        </select>
      </label>
      <p className="valeur-calculee">
        {t('ent.paysAide', { devise: profil.symboleDevise, taxe: profil.nomTaxe })}
      </p>

      <label>
        {t('ent.nom')}
        <input value={valeurs.nom} onChange={(e) => modifierChamp('nom', e.target.value)} />
      </label>

      <label>
        {t('ent.adresse')}
        <textarea
          value={valeurs.adresse}
          onChange={(e) => modifierChamp('adresse', e.target.value)}
        />
      </label>

      <label>
        {t('ent.email')}
        <input value={valeurs.email} onChange={(e) => modifierChamp('email', e.target.value)} />
      </label>

      <label>
        {t('ent.telephone')}
        <input
          value={valeurs.telephone}
          onChange={(e) => modifierChamp('telephone', e.target.value)}
        />
      </label>

      <label>
        {t('ent.iban')}
        <input value={valeurs.iban} onChange={(e) => modifierChamp('iban', e.target.value)} />
      </label>

      <label>
        {t('ent.titulaire')}
        <input
          value={valeurs.titulaireCompte}
          onChange={(e) => modifierChamp('titulaireCompte', e.target.value)}
        />
      </label>

      <label>
        {t('ent.prefixeFacture')}
        <input
          value={valeurs.prefixeFacture}
          onChange={(e) => modifierChamp('prefixeFacture', e.target.value)}
        />
      </label>

      <label>
        {t('ent.logo')}
        <div className="logo-selecteur">
          {logoDataUrl && <img src={logoDataUrl} alt={t('ent.logoAlt')} className="logo-apercu" />}
          <button type="button" onClick={choisirLogo}>
            {t('ent.choisirLogo')}
          </button>
          {logoDataUrl && (
            <button type="button" onClick={retirerLogo}>
              {t('ent.retirer')}
            </button>
          )}
        </div>
      </label>

      <label>
        {t('ent.prefixeDevis')}
        <input
          value={valeurs.prefixeDevis}
          onChange={(e) => modifierChamp('prefixeDevis', e.target.value)}
        />
      </label>
      </div>

      <div className="carte">
        <h2>{t('ent.taxeEtIdentifiant', { taxe: profil.nomTaxe })}</h2>

        <label className="case-a-cocher">
          <input
            type="checkbox"
            checked={valeurs.assujettiTva}
            onChange={(e) => changerAssujettissement(e.target.checked)}
          />
          {t('ent.assujetti', { taxe: profil.nomTaxe })}
        </label>
        <p className="valeur-calculee">
          {valeurs.assujettiTva
            ? t('ent.assujettiOui', { taxe: profil.nomTaxe })
            : t('ent.assujettiNon', {
                taxe: profil.nomTaxe,
                // La mention est reprise telle quelle : elle part sur la
                // facture et appartient au pays, pas au lecteur.
                mention: profil.mentionNonAssujetti
              })}
          <br />
          {t('ent.seuil', {
            pays: ecranPays(profil).nom,
            seuil: ecranPays(profil).seuilAssujettissement
          })}{' '}
          <strong>{t('ent.seuilVerifier')}</strong>
        </p>

        <label>
          {profil.libelleIdentifiant}
          <input
            placeholder={profil.exempleIdentifiant}
            value={valeurs.numeroIde}
            onChange={(e) => modifierChamp('numeroIde', e.target.value)}
          />
        </label>
        <p className="valeur-calculee">{ecranPays(profil).aideIdentifiant}</p>

        {valeurs.assujettiTva && (
          <>
            <label>
              {t('ent.tauxParDefaut', { taxe: profil.nomTaxe })}
              <select
                value={valeurs.tvaDefautPct}
                onChange={(e) => modifierChamp('tvaDefautPct', Number(e.target.value))}
              >
                {profil.tauxTva.map((taux, index) => (
                  <option key={taux.taux} value={taux.taux}>
                    {ecranPays(profil).libellesTaux[index]} — {taux.taux}%
                  </option>
                ))}
              </select>
            </label>
            <p className="valeur-calculee">
              {t('ent.tauxEnVigueur', { pays: ecranPays(profil).nom })}{' '}
              <strong>{t('ent.tauxVerifier')}</strong>
            </p>
          </>
        )}
      </div>

      <div className="carte">
        <h2>{t('ent.conditionsTitre')}</h2>
        <p className="valeur-calculee">
          {t('ent.conditionsAide')}{' '}
          <strong>{t('ent.conditionsAvertissement')}</strong>
        </p>

        <label>
          {t('ent.conditions')}
          <textarea
            rows={12}
            value={valeurs.conditionsGenerales}
            onChange={(e) => modifierChamp('conditionsGenerales', e.target.value)}
          />
        </label>
        <div className="barre-boutons" style={{ marginTop: 0, marginBottom: '1rem' }}>
          <button className="bouton-secondaire" onClick={insererModeleConditions}>
            {t('ent.insererModele')}
          </button>
          {/*
            **Le modèle reste en français, et on le dit.** C'est un texte
            juridique inséré au bas de vraies factures : le traduire
            mécaniquement produirait un contrat que personne n'a relu. Plutôt
            que de le traduire ou de le cacher, on annonce sa langue et son
            cadre — l'utilisateur décide en connaissance de cause.
          */}
          <span className="valeur-calculee">{t('ent.modeleEnFrancais')}</span>
        </div>

        <label>
          {t('ent.mentionsPied')}
          <textarea
            rows={3}
            placeholder={t('ent.mentionsPiedExemple')}
            value={valeurs.mentionsPied}
            onChange={(e) => modifierChamp('mentionsPied', e.target.value)}
          />
        </label>
      </div>

      <div className="carte">
        <button onClick={enregistrer}>{t('action.enregistrer')}</button>
        {messageErreur && <p className="erreur">{messageErreur}</p>}
        {messageSucces && <p className="succes">{messageSucces}</p>}
      </div>
    </div>
  )
}
