import { useEffect, useState } from 'react'
import type { CategorieJournal, TypeMouvement } from '../../../shared/types'
import { chargerValeursSuggerees, type ValeursSuggerees } from '../lib/suggestions'
import ClientSelecteur from '../components/ClientSelecteur'
import { symboleDevise } from '../lib/devise'
import { t, type CleTraduction } from '../../../shared/i18n'
import { TYPES_MOUVEMENT, TYPE_PAR_DEFAUT } from '../../../shared/journal'
import { VALEURS_CATEGORIES } from '../../../shared/inventaire'

type Destination =
  | 'journal'
  | 'facture'
  | 'devis'
  | 'client'
  | 'tarifProduit'
  | 'tarifMainOeuvre'
  | 'tarifDeplacement'
  | 'inventaire'

const DESTINATIONS: { id: Destination; cle: CleTraduction }[] = [
  { id: 'journal', cle: 'ajout.destJournal' },
  { id: 'facture', cle: 'ajout.destFacture' },
  { id: 'devis', cle: 'ajout.destDevis' },
  { id: 'client', cle: 'ajout.destClient' },
  { id: 'tarifProduit', cle: 'ajout.destTarifProduit' },
  { id: 'tarifMainOeuvre', cle: 'ajout.destTarifMainOeuvre' },
  { id: 'tarifDeplacement', cle: 'ajout.destTarifDeplacement' },
  { id: 'inventaire', cle: 'ajout.destInventaire' }
]

export default function AjoutRapide(): React.JSX.Element {
  const [destination, setDestination] = useState<Destination>('journal')
  const [categories, setCategories] = useState<CategorieJournal[]>([])
  const [suggestions, setSuggestions] = useState<ValeursSuggerees | null>(null)
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)

  // Champs (seuls les pertinents pour la destination choisie sont affichés).
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [type, setType] = useState<TypeMouvement>(TYPE_PAR_DEFAUT)
  const [categorieId, setCategorieId] = useState<number | ''>('')
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState(0)
  const [tvaPct, setTvaPct] = useState<number | ''>('')
  const [numeroFacture, setNumeroFacture] = useState('')
  const [notes, setNotes] = useState('')

  const [prixAchat, setPrixAchat] = useState(0)
  const [margePct, setMargePct] = useState<number | ''>('')
  const [heures, setHeures] = useState(0)
  const [tauxHoraire, setTauxHoraire] = useState<number | ''>('')
  const [distanceKm, setDistanceKm] = useState(0)
  const [prixKm, setPrixKm] = useState<number | ''>('')

  const [reference, setReference] = useState('')
  const [quantiteStock, setQuantiteStock] = useState(0)
  const [seuilAlerte, setSeuilAlerte] = useState(0)
  const [prixVente, setPrixVente] = useState(0)
  const [fournisseur, setFournisseur] = useState('')
  const [emplacement, setEmplacement] = useState('')

  // Facture / devis / client
  const [clientId, setClientId] = useState<number | null>(null)
  const [adresseClient, setAdresseClient] = useState('')
  const [emailClient, setEmailClient] = useState('')
  const [telephoneClient, setTelephoneClient] = useState('')

  useEffect(() => {
    window.api.categoriesJournal.lister().then(setCategories)
    chargerValeursSuggerees().then(setSuggestions)
  }, [])

  // Une référence libre est resuggérée chaque fois qu'on (re)vient sur l'inventaire,
  // y compris après un enregistrement qui a vidé le champ.
  useEffect(() => {
    if (destination === 'inventaire' && !reference) {
      window.api.inventaire.referenceSuggeree().then(setReference)
    }
  }, [destination, reference])

  function reinitialiser(): void {
    setLibelle('')
    setMontant(0)
    setNotes('')
    setNumeroFacture('')
    setPrixAchat(0)
    setHeures(0)
    setDistanceKm(0)
    setQuantiteStock(0)
    setSeuilAlerte(0)
    setPrixVente(0)
    setFournisseur('')
    setEmplacement('')
    setReference('')
  }

  function afficherSucces(message: string): void {
    setMessageErreur(null)
    setMessageSucces(message)
    setTimeout(() => setMessageSucces(null), 3000)
  }

  async function enregistrer(): Promise<void> {
    setMessageErreur(null)
    setMessageSucces(null)
    try {
      if (destination === 'journal') {
        if (!libelle.trim()) throw new Error('La description est obligatoire.')
        await window.api.journal.ajouter({
          date,
          type,
          categorieId: categorieId === '' ? null : categorieId,
          description: libelle,
          montant,
          numeroFacture: numeroFacture || null,
          notes,
          tvaPct: tvaPct === '' ? null : tvaPct
        })
        afficherSucces(t('ajout.ecritureAjoutee'))
      } else if (destination === 'tarifProduit') {
        await window.api.tarifsProduits.ajouter({
          designation: libelle,
          prixAchat,
          margePct: margePct === '' ? null : margePct,
          referenceInventaire: null
        })
        afficherSucces(t('ajout.produitAjoute'))
      } else if (destination === 'tarifMainOeuvre') {
        await window.api.tarifsMainOeuvre.ajouter({
          description: libelle,
          heures,
          tauxHoraire: tauxHoraire === '' ? null : tauxHoraire
        })
        afficherSucces(t('ajout.mainOeuvreAjoutee'))
      } else if (destination === 'tarifDeplacement') {
        await window.api.tarifsDeplacement.ajouter({
          description: libelle,
          distanceKm,
          prixKm: prixKm === '' ? null : prixKm
        })
        afficherSucces(t('ajout.deplacementAjoute'))
      } else if (destination === 'facture') {
        if (!clientId) throw new Error(t('ajout.choisirClientFacture'))
        const facture = await window.api.factures.creerBrouillon(clientId)
        afficherSucces(
          t('ajout.brouillonFactureCree', { numero: facture.numero })
        )
      } else if (destination === 'devis') {
        if (!clientId) throw new Error(t('ajout.choisirClientDevis'))
        const devis = await window.api.devis.creerBrouillon(clientId)
        afficherSucces(
          t('ajout.brouillonDevisCree', { numero: devis.numero })
        )
      } else if (destination === 'client') {
        const client = await window.api.clients.ajouter({
          nom: libelle,
          adresse: adresseClient,
          email: emailClient,
          telephone: telephoneClient
        })
        setAdresseClient('')
        setEmailClient('')
        setTelephoneClient('')
        afficherSucces(t('ajout.clientCree', { nom: client.nom }))
      } else {
        await window.api.inventaire.ajouter({
          reference,
          designation: libelle,
          categorie: VALEURS_CATEGORIES[VALEURS_CATEGORIES.length - 1],
          quantiteStock,
          seuilAlerte,
          prixAchatUnitaire: prixAchat,
          prixVenteUnitaire: prixVente,
          fournisseur,
          emplacement,
          derniereMaj: ''
        })
        afficherSucces(t('ajout.articleAjoute'))
      }
      reinitialiser()
    } catch (erreur) {
      setMessageErreur(erreur instanceof Error ? erreur.message : t('erreur.inconnue'))
    }
  }

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>{t('ajout.titre')}</h2>

        <label>
          {t('ajout.ou')}
          <select value={destination} onChange={(e) => setDestination(e.target.value as Destination)}>
            {DESTINATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {t(d.cle)}
              </option>
            ))}
          </select>
        </label>

        <hr className="separateur" />

        {destination === 'inventaire' && (
          <label>
            {t('colonne.reference')}
            <input value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
        )}

        {(destination === 'facture' || destination === 'devis') && (
          <>
            <label>
              {t('colonne.client')}
              <ClientSelecteur clientId={clientId} onChange={setClientId} />
            </label>
            <p className="valeur-calculee">
              {t('ajout.aideDocument')}
            </p>
          </>
        )}

        {destination !== 'facture' && destination !== 'devis' && (
          <label>
            {destination === 'journal'
              ? t('journal.description')
              : destination === 'client'
                ? t('ajout.nomClient')
                : t('colonne.designation')}
            <input value={libelle} onChange={(e) => setLibelle(e.target.value)} />
          </label>
        )}

        {destination === 'client' && (
          <>
            <label>
              {t('client.adresse')}
              <textarea value={adresseClient} onChange={(e) => setAdresseClient(e.target.value)} />
            </label>
            <div className="ligne-formulaire">
              <label>
                {t('client.email')}
                <input type="email" value={emailClient} onChange={(e) => setEmailClient(e.target.value)} />
              </label>
              <label>
                {t('client.telephone')}
                <input value={telephoneClient} onChange={(e) => setTelephoneClient(e.target.value)} />
              </label>
            </div>
          </>
        )}

        {destination === 'journal' && (
          <div className="ligne-formulaire">
            <label>
              {t('colonne.date')}
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              {t('journal.type')}
              <select value={type} onChange={(e) => setType(e.target.value as TypeMouvement)}>
                {TYPES_MOUVEMENT.map((mouvement) => (
                  <option key={mouvement.valeur} value={mouvement.valeur}>
                    {t(mouvement.cle)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('journal.categorie')}
              <select
                value={categorieId}
                onChange={(e) => setCategorieId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.libelle}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Montant ({symboleDevise()})
              <input type="number" step="0.05" value={montant} onChange={(e) => setMontant(Number(e.target.value))} />
            </label>
            <label>
              {t('journal.tvaPct')}
              <input
                type="number"
                step="0.1"
                value={tvaPct}
                onChange={(e) => setTvaPct(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </label>
            <label>
              {t('journal.numeroFactureLiee')}
              <input value={numeroFacture} onChange={(e) => setNumeroFacture(e.target.value)} />
            </label>
          </div>
        )}

        {destination === 'tarifProduit' && (
          <div className="ligne-formulaire">
            <label>
              {t('ajout.prixAchatDevise', { devise: symboleDevise() })}
              <input type="number" step="0.05" value={prixAchat} onChange={(e) => setPrixAchat(Number(e.target.value))} />
            </label>
            <label>
              {t('ajout.marge')}{' '}
              {suggestions &&
                t('ajout.margeSuggeree', { marge: (suggestions.margeSuggeree * 100).toFixed(1) })}
              <input
                type="number"
                step="1"
                value={margePct}
                onChange={(e) => setMargePct(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </label>
          </div>
        )}

        {destination === 'tarifMainOeuvre' && (
          <div className="ligne-formulaire">
            <label>
              {t('tarif.heures')}
              <input type="number" step="0.25" value={heures} onChange={(e) => setHeures(Number(e.target.value))} />
            </label>
            <label>
              {t('ajout.tauxHoraire')}{' '}
              {suggestions &&
                t('ajout.tauxSuggere', {
                  taux: suggestions.tauxHoraireSuggere.toFixed(2),
                  devise: symboleDevise()
                })}
              <input
                type="number"
                step="1"
                value={tauxHoraire}
                onChange={(e) => setTauxHoraire(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </label>
          </div>
        )}

        {destination === 'tarifDeplacement' && (
          <div className="ligne-formulaire">
            <label>
              {t('tarif.distanceKm')}
              <input type="number" step="1" value={distanceKm} onChange={(e) => setDistanceKm(Number(e.target.value))} />
            </label>
            <label>
              {t('ajout.prixKm')}{' '}
              {suggestions &&
                t('ajout.prixKmSuggere', {
                  prix: suggestions.prixVenteKmSuggere.toFixed(2),
                  devise: symboleDevise()
                })}
              <input
                type="number"
                step="0.05"
                value={prixKm}
                onChange={(e) => setPrixKm(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </label>
          </div>
        )}

        {destination === 'inventaire' && (
          <div className="ligne-formulaire">
            <label>
              {t('ajout.quantiteStock')}
              <input type="number" step="1" value={quantiteStock} onChange={(e) => setQuantiteStock(Number(e.target.value))} />
            </label>
            <label>
              {t('inventaire.seuilAlerte')}
              <input type="number" step="1" value={seuilAlerte} onChange={(e) => setSeuilAlerte(Number(e.target.value))} />
            </label>
            <label>
              {t('ajout.prixAchatUnitaire')}
              <input type="number" step="0.05" value={prixAchat} onChange={(e) => setPrixAchat(Number(e.target.value))} />
            </label>
            <label>
              {t('ajout.prixVenteUnitaire')}
              <input type="number" step="0.05" value={prixVente} onChange={(e) => setPrixVente(Number(e.target.value))} />
            </label>
            <label>
              {t('inventaire.fournisseur')}
              <input value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} />
            </label>
            <label>
              {t('inventaire.emplacement')}
              <input value={emplacement} onChange={(e) => setEmplacement(e.target.value)} />
            </label>
          </div>
        )}

        {destination === 'journal' && (
          <label>
            {t('journal.notes')}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        )}

        <button className="action-ecriture" onClick={enregistrer}>
          {destination === 'facture'
            ? t('ajout.creerBrouillonFacture')
            : destination === 'devis'
              ? t('ajout.creerBrouillonDevis')
              : t('action.enregistrer')}
        </button>

        {messageErreur && <p className="erreur">{messageErreur}</p>}
        {messageSucces && <p className="succes">{messageSucces}</p>}
      </div>
    </div>
  )
}
