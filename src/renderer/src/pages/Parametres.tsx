import { useEffect, useState } from 'react'
import type { Entreprise } from '../../../shared/types'
import { listePays, profilPays, PAYS_PAR_DEFAUT } from '../../../shared/pays'

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

/**
 * Modèle de conditions générales fourni comme point de départ.
 * Volontairement générique : il doit être adapté à l'activité réelle et
 * relu par un juriste avant d'être utilisé sur de vraies factures.
 */
function modeleConditions(nomEntreprise: string): string {
  const nom = nomEntreprise.trim() || "L'entreprise"
  return `1. Champ d'application
Les présentes conditions s'appliquent à toutes les prestations et livraisons de ${nom}, sauf accord écrit contraire.

2. Devis et commandes
Les devis sont valables durant la durée indiquée sur le document. Toute commande implique l'acceptation des présentes conditions.

3. Prix et paiement
Les prix s'entendent dans la devise indiquée sur la facture. Le paiement est dû dans le délai mentionné, sans escompte. Passé ce délai, un intérêt moratoire au taux légal peut être appliqué, ainsi que des frais de rappel.

4. Réserve de propriété
Les marchandises livrées restent la propriété de ${nom} jusqu'au paiement intégral.

5. Délais
Les délais annoncés sont indicatifs. Un retard ne donne pas droit à une réduction de prix ni à des dommages-intérêts, sauf accord écrit.

6. Garantie
Les défauts doivent être signalés par écrit dans les 8 jours suivant la livraison ou la fin de l'intervention. La garantie se limite à la réparation ou au remplacement des éléments défectueux. Sont exclus l'usure normale, les dommages consécutifs à une mauvaise utilisation, à une intervention d'un tiers, à une surtension ou à un défaut d'entretien.

7. Responsabilité
La responsabilité de ${nom} est limitée au montant de la prestation concernée. Elle ne couvre pas les dommages indirects tels que perte de données, perte d'exploitation ou manque à gagner. Il appartient au client de sauvegarder ses données avant toute intervention. Les limitations ci-dessus ne s'appliquent pas en cas de faute grave ou intentionnelle, ni dans les cas où la loi impose une responsabilité.

8. Données du client
Les données auxquelles ${nom} pourrait accéder dans le cadre d'une intervention sont traitées de manière confidentielle et ne sont pas conservées au-delà de ce qui est nécessaire.

9. Droit applicable et for
Le droit applicable et le for sont ceux du siège de ${nom}, sous réserve des dispositions impératives protégeant les consommateurs.`
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
      !window.confirm('Remplacer les conditions générales actuelles par le modèle ?')
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
      setMessageSucces('Paramètres enregistrés.')
    } catch (erreur) {
      setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
    }
  }

  if (chargement) return <p>Chargement…</p>

  const profil = profilPays(valeurs.pays)

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>Identité de l'entreprise</h2>

      <label>
        Pays
        <select value={valeurs.pays} onChange={(e) => changerPays(e.target.value)}>
          {listePays().map((p) => (
            <option key={p.code} value={p.code}>
              {p.nom}
            </option>
          ))}
        </select>
      </label>
      <p className="valeur-calculee">
        Le pays détermine la devise ({profil.symboleDevise}), les taux de {profil.nomTaxe}, le format
        de l'identifiant fiscal et les mentions légales imprimées sur les documents.
      </p>

      <label>
        Nom de l'entreprise
        <input value={valeurs.nom} onChange={(e) => modifierChamp('nom', e.target.value)} />
      </label>

      <label>
        Adresse
        <textarea
          value={valeurs.adresse}
          onChange={(e) => modifierChamp('adresse', e.target.value)}
        />
      </label>

      <label>
        Email
        <input value={valeurs.email} onChange={(e) => modifierChamp('email', e.target.value)} />
      </label>

      <label>
        Téléphone
        <input
          value={valeurs.telephone}
          onChange={(e) => modifierChamp('telephone', e.target.value)}
        />
      </label>

      <label>
        IBAN
        <input value={valeurs.iban} onChange={(e) => modifierChamp('iban', e.target.value)} />
      </label>

      <label>
        Titulaire du compte
        <input
          value={valeurs.titulaireCompte}
          onChange={(e) => modifierChamp('titulaireCompte', e.target.value)}
        />
      </label>

      <label>
        Préfixe numéro de facture
        <input
          value={valeurs.prefixeFacture}
          onChange={(e) => modifierChamp('prefixeFacture', e.target.value)}
        />
      </label>

      <label>
        Logo
        <div className="logo-selecteur">
          {logoDataUrl && <img src={logoDataUrl} alt="Logo de l'entreprise" className="logo-apercu" />}
          <button type="button" onClick={choisirLogo}>
            Choisir un logo…
          </button>
          {logoDataUrl && (
            <button type="button" onClick={retirerLogo}>
              Retirer
            </button>
          )}
        </div>
      </label>

      <label>
        Préfixe numéro de devis
        <input
          value={valeurs.prefixeDevis}
          onChange={(e) => modifierChamp('prefixeDevis', e.target.value)}
        />
      </label>
      </div>

      <div className="carte">
        <h2>{profil.nomTaxe} et identifiant fiscal</h2>

        <label className="case-a-cocher">
          <input
            type="checkbox"
            checked={valeurs.assujettiTva}
            onChange={(e) => changerAssujettissement(e.target.checked)}
          />
          Je suis assujetti à la {profil.nomTaxe}
        </label>
        <p className="valeur-calculee">
          {valeurs.assujettiTva
            ? `La ${profil.nomTaxe} est facturée et détaillée sur les documents.`
            : `Aucune ${profil.nomTaxe} n'est facturée. La mention « ${profil.mentionNonAssujetti} » est imprimée sur les documents.`}
          <br />
          Seuil indicatif d'assujettissement en {profil.nom} : {profil.seuilAssujettissement}.{' '}
          <strong>À vérifier auprès de l'administration fiscale.</strong>
        </p>

        <label>
          {profil.libelleIdentifiant}
          <input
            placeholder={profil.exempleIdentifiant}
            value={valeurs.numeroIde}
            onChange={(e) => modifierChamp('numeroIde', e.target.value)}
          />
        </label>
        <p className="valeur-calculee">{profil.aideIdentifiant}</p>

        {valeurs.assujettiTva && (
          <>
            <label>
              Taux de {profil.nomTaxe} par défaut
              <select
                value={valeurs.tvaDefautPct}
                onChange={(e) => modifierChamp('tvaDefautPct', Number(e.target.value))}
              >
                {profil.tauxTva.map((t) => (
                  <option key={t.taux} value={t.taux}>
                    {t.libelle} — {t.taux}%
                  </option>
                ))}
              </select>
            </label>
            <p className="valeur-calculee">
              Taux en vigueur en {profil.nom} au moment de la rédaction de l'application.{' '}
              <strong>Vérifiez qu'ils sont toujours d'actualité.</strong>
            </p>
          </>
        )}
      </div>

      <div className="carte">
        <h2>Conditions générales et mentions</h2>
        <p className="valeur-calculee">
          Ce texte est imprimé au bas de vos factures et devis. Il encadre notamment la garantie et
          votre responsabilité.{' '}
          <strong>
            Attention : une clause ne peut pas exclure la responsabilité en cas de faute grave ou
            intentionnelle. Faites relire ce texte par un juriste avant de l'utiliser.
          </strong>
        </p>

        <label>
          Conditions générales
          <textarea
            rows={12}
            value={valeurs.conditionsGenerales}
            onChange={(e) => modifierChamp('conditionsGenerales', e.target.value)}
          />
        </label>
        <div className="barre-boutons" style={{ marginTop: 0, marginBottom: '1rem' }}>
          <button className="bouton-secondaire" onClick={insererModeleConditions}>
            Insérer un modèle de départ
          </button>
        </div>

        <label>
          Mentions de pied de page
          <textarea
            rows={3}
            placeholder="Ex. : numéro de TVA intracommunautaire, assurance RC professionnelle, inscription au registre du commerce…"
            value={valeurs.mentionsPied}
            onChange={(e) => modifierChamp('mentionsPied', e.target.value)}
          />
        </label>
      </div>

      <div className="carte">
        <button onClick={enregistrer}>Enregistrer</button>
        {messageErreur && <p className="erreur">{messageErreur}</p>}
        {messageSucces && <p className="succes">{messageSucces}</p>}
      </div>
    </div>
  )
}
