import { useEffect, useState } from 'react'
import type { CategorieJournal, TypeMouvement } from '../../../shared/types'
import { chargerValeursSuggerees, type ValeursSuggerees } from '../lib/suggestions'
import ClientSelecteur from '../components/ClientSelecteur'
import { symboleDevise } from '../lib/devise'

type Destination =
  | 'journal'
  | 'facture'
  | 'devis'
  | 'client'
  | 'tarifProduit'
  | 'tarifMainOeuvre'
  | 'tarifDeplacement'
  | 'inventaire'

const DESTINATIONS: { id: Destination; titre: string }[] = [
  { id: 'journal', titre: 'Journal — entrée / dépense' },
  { id: 'facture', titre: 'Facture — nouveau brouillon' },
  { id: 'devis', titre: 'Devis — nouveau brouillon' },
  { id: 'client', titre: 'Client — nouvelle fiche' },
  { id: 'tarifProduit', titre: 'Tarifs — produit / prestation' },
  { id: 'tarifMainOeuvre', titre: "Tarifs — heures / main d'œuvre" },
  { id: 'tarifDeplacement', titre: 'Tarifs — déplacement' },
  { id: 'inventaire', titre: 'Inventaire — nouvel article' }
]

export default function AjoutRapide(): React.JSX.Element {
  const [destination, setDestination] = useState<Destination>('journal')
  const [categories, setCategories] = useState<CategorieJournal[]>([])
  const [suggestions, setSuggestions] = useState<ValeursSuggerees | null>(null)
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)

  // Champs (seuls les pertinents pour la destination choisie sont affichés).
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [type, setType] = useState<TypeMouvement>('Dépense')
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
        afficherSucces('Écriture ajoutée au Journal.')
      } else if (destination === 'tarifProduit') {
        await window.api.tarifsProduits.ajouter({
          designation: libelle,
          prixAchat,
          margePct: margePct === '' ? null : margePct,
          referenceInventaire: null
        })
        afficherSucces('Produit ajouté aux tarifs.')
      } else if (destination === 'tarifMainOeuvre') {
        await window.api.tarifsMainOeuvre.ajouter({
          description: libelle,
          heures,
          tauxHoraire: tauxHoraire === '' ? null : tauxHoraire
        })
        afficherSucces('Ligne de main d\'œuvre ajoutée aux tarifs.')
      } else if (destination === 'tarifDeplacement') {
        await window.api.tarifsDeplacement.ajouter({
          description: libelle,
          distanceKm,
          prixKm: prixKm === '' ? null : prixKm
        })
        afficherSucces('Déplacement ajouté aux tarifs.')
      } else if (destination === 'facture') {
        if (!clientId) throw new Error('Choisissez un client pour créer la facture.')
        const facture = await window.api.factures.creerBrouillon(clientId)
        afficherSucces(
          `Brouillon de facture ${facture.numero} créé. Ouvre le module Facturation pour ajouter les lignes.`
        )
      } else if (destination === 'devis') {
        if (!clientId) throw new Error('Choisissez un client pour créer le devis.')
        const devis = await window.api.devis.creerBrouillon(clientId)
        afficherSucces(
          `Brouillon de devis ${devis.numero} créé. Ouvre le module Devis pour ajouter les lignes.`
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
        afficherSucces(`Client « ${client.nom} » créé.`)
      } else {
        await window.api.inventaire.ajouter({
          reference,
          designation: libelle,
          categorie: 'Divers',
          quantiteStock,
          seuilAlerte,
          prixAchatUnitaire: prixAchat,
          prixVenteUnitaire: prixVente,
          fournisseur,
          emplacement,
          derniereMaj: ''
        })
        afficherSucces('Article ajouté à l\'inventaire.')
      }
      reinitialiser()
    } catch (erreur) {
      setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
    }
  }

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>Ajout rapide</h2>

        <label>
          Où voulez-vous enregistrer cette saisie ?
          <select value={destination} onChange={(e) => setDestination(e.target.value as Destination)}>
            {DESTINATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.titre}
              </option>
            ))}
          </select>
        </label>

        <hr className="separateur" />

        {destination === 'inventaire' && (
          <label>
            Référence
            <input value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
        )}

        {(destination === 'facture' || destination === 'devis') && (
          <>
            <label>
              Client
              <ClientSelecteur clientId={clientId} onChange={setClientId} />
            </label>
            <p className="valeur-calculee">
              Le numéro, la date, le délai et la TVA sont remplis automatiquement depuis tes
              paramètres. Tu ajoutes les lignes ensuite dans le module dédié.
            </p>
          </>
        )}

        {destination !== 'facture' && destination !== 'devis' && (
          <label>
            {destination === 'journal'
              ? 'Description'
              : destination === 'client'
                ? 'Nom du client'
                : 'Désignation'}
            <input value={libelle} onChange={(e) => setLibelle(e.target.value)} />
          </label>
        )}

        {destination === 'client' && (
          <>
            <label>
              Adresse
              <textarea value={adresseClient} onChange={(e) => setAdresseClient(e.target.value)} />
            </label>
            <div className="ligne-formulaire">
              <label>
                Email
                <input type="email" value={emailClient} onChange={(e) => setEmailClient(e.target.value)} />
              </label>
              <label>
                Téléphone
                <input value={telephoneClient} onChange={(e) => setTelephoneClient(e.target.value)} />
              </label>
            </div>
          </>
        )}

        {destination === 'journal' && (
          <div className="ligne-formulaire">
            <label>
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              Type
              <select value={type} onChange={(e) => setType(e.target.value as TypeMouvement)}>
                <option value="Entrée">Entrée</option>
                <option value="Dépense">Dépense</option>
              </select>
            </label>
            <label>
              Catégorie
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
              TVA %
              <input
                type="number"
                step="0.1"
                value={tvaPct}
                onChange={(e) => setTvaPct(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </label>
            <label>
              N° facture liée
              <input value={numeroFacture} onChange={(e) => setNumeroFacture(e.target.value)} />
            </label>
          </div>
        )}

        {destination === 'tarifProduit' && (
          <div className="ligne-formulaire">
            <label>
              Prix d'achat ({symboleDevise()})
              <input type="number" step="0.05" value={prixAchat} onChange={(e) => setPrixAchat(Number(e.target.value))} />
            </label>
            <label>
              Marge %{' '}
              {suggestions && `(vide = suggérée ${(suggestions.margeSuggeree * 100).toFixed(1)}%)`}
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
              Heures
              <input type="number" step="0.25" value={heures} onChange={(e) => setHeures(Number(e.target.value))} />
            </label>
            <label>
              Taux horaire{' '}
              {suggestions && `(vide = suggéré ${suggestions.tauxHoraireSuggere.toFixed(2)} ${symboleDevise()}/h)`}
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
              Distance (km)
              <input type="number" step="1" value={distanceKm} onChange={(e) => setDistanceKm(Number(e.target.value))} />
            </label>
            <label>
              Prix/km{' '}
              {suggestions && `(vide = suggéré ${suggestions.prixVenteKmSuggere.toFixed(2)} ${symboleDevise()}/km)`}
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
              Quantité en stock
              <input type="number" step="1" value={quantiteStock} onChange={(e) => setQuantiteStock(Number(e.target.value))} />
            </label>
            <label>
              Seuil d'alerte
              <input type="number" step="1" value={seuilAlerte} onChange={(e) => setSeuilAlerte(Number(e.target.value))} />
            </label>
            <label>
              Prix d'achat unitaire
              <input type="number" step="0.05" value={prixAchat} onChange={(e) => setPrixAchat(Number(e.target.value))} />
            </label>
            <label>
              Prix de vente unitaire
              <input type="number" step="0.05" value={prixVente} onChange={(e) => setPrixVente(Number(e.target.value))} />
            </label>
            <label>
              Fournisseur
              <input value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} />
            </label>
            <label>
              Emplacement
              <input value={emplacement} onChange={(e) => setEmplacement(e.target.value)} />
            </label>
          </div>
        )}

        {destination === 'journal' && (
          <label>
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        )}

        <button className="action-ecriture" onClick={enregistrer}>
          {destination === 'facture'
            ? 'Créer le brouillon de facture'
            : destination === 'devis'
              ? 'Créer le brouillon de devis'
              : 'Enregistrer'}
        </button>

        {messageErreur && <p className="erreur">{messageErreur}</p>}
        {messageSucces && <p className="succes">{messageSucces}</p>}
      </div>
    </div>
  )
}
