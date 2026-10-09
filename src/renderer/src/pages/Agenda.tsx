import { useEffect, useState } from 'react'
import type {
  ArticleInventaire,
  Client,
  ContenuAgenda,
  DisponibiliteArticle,
  EvenementAgenda,
  LocationAgenda,
  StatutLocation
} from '../../../shared/types'
import {
  grilleDuMois,
  nombreDeJours,
  periodesSeChevauchent,
  STATUT_LOCATION_ANNULEE,
  STATUT_LOCATION_RENDUE,
  STATUT_LOCATION_RESERVEE,
  totalLigneLocation,
  totalLocation
} from '../../../shared/agenda'
import { langue, t, type CleTraduction } from '../../../shared/i18n'
import { formaterMontant } from '../lib/devise'
import { peutQuitter, useGardeSortie } from '../gardeSortie'

/**
 * L'agenda de l'entreprise : une grille du mois, la liste du mois, et un
 * formulaire pour les événements et les locations de matériel.
 *
 * Les calculs (jours, totaux, grille) viennent de `shared/agenda.ts`, les mêmes
 * que ceux du main process : ce que l'écran annonce est ce qui sera enregistré.
 */

interface FormEvenement {
  type: 'evenement'
  id: number
  titre: string
  /** Format du champ `datetime-local` : `YYYY-MM-DDTHH:MM`. */
  debut: string
  fin: string
  lieu: string
  notes: string
}

interface LigneForm {
  reference: string
  quantite: string
  prix: string
}

interface FormLocation {
  type: 'location'
  id: number
  clientId: number
  dateDebut: string
  dateFin: string
  notes: string
  lignes: LigneForm[]
  statut: StatutLocation
  factureNumero: string | null
}

type Formulaire = FormEvenement | FormLocation

function cleStatut(statut: StatutLocation): CleTraduction {
  if (statut === STATUT_LOCATION_RENDUE) return 'agenda.statutRendue'
  if (statut === STATUT_LOCATION_ANNULEE) return 'agenda.statutAnnulee'
  return 'agenda.statutReservee'
}

const nombre = (texte: string): number => Number(texte.trim().replace(',', '.'))

function jourLocal(date: Date): string {
  const deux = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`
}

function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur)
}

function versFormEvenement(e: EvenementAgenda): FormEvenement {
  return {
    type: 'evenement',
    id: e.id,
    titre: e.titre,
    debut: e.debut.replace(' ', 'T'),
    fin: e.fin.replace(' ', 'T'),
    lieu: e.lieu,
    notes: e.notes
  }
}

function versFormLocation(l: LocationAgenda): FormLocation {
  return {
    type: 'location',
    id: l.id,
    clientId: l.clientId,
    dateDebut: l.dateDebut,
    dateFin: l.dateFin,
    notes: l.notes,
    lignes: l.lignes.map((ligne) => ({
      reference: ligne.referenceInventaire,
      quantite: String(ligne.quantite),
      prix: String(ligne.prixParJour)
    })),
    statut: l.statut,
    factureNumero: l.factureNumero
  }
}

export default function Agenda({ ouvrirFacturation }: { ouvrirFacturation: () => void }): React.JSX.Element {
  const aujourdhui = jourLocal(new Date())
  const [vue, setVue] = useState(() => {
    const d = new Date()
    return { annee: d.getFullYear(), mois: d.getMonth() + 1 }
  })
  const [contenu, setContenu] = useState<ContenuAgenda>({ evenements: [], locations: [] })
  const [clients, setClients] = useState<Client[]>([])
  const [articles, setArticles] = useState<ArticleInventaire[]>([])
  const [edition, setEdition] = useState<Formulaire | null>(null)
  const [instantane, setInstantane] = useState<string | null>(null)
  const [dispos, setDispos] = useState<Record<string, DisponibiliteArticle>>({})
  const [erreur, setErreur] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [avertissements, setAvertissements] = useState<string[]>([])

  // Un formulaire modifié et non enregistré est un brouillon : on ne le perd pas en silence.
  const modifie = edition !== null && JSON.stringify(edition) !== instantane
  useGardeSortie(modifie)

  const grille = grilleDuMois(vue.annee, vue.mois)
  const premierJour = grille[0]
  const dernierJour = grille[41]
  const prefixeMois = `${vue.annee}-${String(vue.mois).padStart(2, '0')}`
  const locale = langue() === 'en' ? 'en-GB' : 'fr-CH'

  async function recharger(): Promise<void> {
    setContenu(await window.api.agenda.lister(premierJour, dernierJour))
  }

  useEffect(() => {
    window.api.agenda.lister(premierJour, dernierJour).then(setContenu)
  }, [premierJour, dernierJour])

  useEffect(() => {
    window.api.clients.lister().then(setClients)
    window.api.inventaire.lister().then(setArticles)
  }, [])

  // Disponibilité de chaque article du formulaire de location, sur ses dates.
  const cleDispo =
    edition?.type === 'location'
      ? JSON.stringify({
          id: edition.id,
          debut: edition.dateDebut,
          fin: edition.dateFin,
          references: edition.lignes.map((l) => l.reference).filter(Boolean)
        })
      : ''
  useEffect(() => {
    let annule = false
    const demande = cleDispo ? (JSON.parse(cleDispo) as { id: number; debut: string; fin: string; references: string[] }) : null
    if (demande) {
      Promise.all(
        demande.references.map((reference) =>
          window.api.agenda.disponibilite(reference, demande.debut, demande.fin, demande.id)
        )
      )
        .then((resultats) => {
          if (annule) return
          const parReference: Record<string, DisponibiliteArticle> = {}
          for (const r of resultats) parReference[r.reference] = r
          setDispos(parReference)
        })
        .catch(() => {
          if (!annule) setDispos({})
        })
    }
    return () => {
      annule = true
    }
  }, [cleDispo])

  function ouvrir(formulaire: Formulaire): void {
    if (!peutQuitter()) return
    setErreur(null)
    setInfo(null)
    setAvertissements([])
    setEdition(formulaire)
    setInstantane(JSON.stringify(formulaire))
  }

  function fermer(): void {
    if (!peutQuitter()) return
    setEdition(null)
    setInstantane(null)
  }

  function nouvelEvenement(): void {
    ouvrir({ type: 'evenement', id: 0, titre: '', debut: `${aujourdhui}T09:00`, fin: `${aujourdhui}T10:00`, lieu: '', notes: '' })
  }

  function nouvelleLocation(): void {
    ouvrir({
      type: 'location',
      id: 0,
      clientId: clients[0]?.id ?? 0,
      dateDebut: aujourdhui,
      dateFin: aujourdhui,
      notes: '',
      lignes: [{ reference: '', quantite: '1', prix: '0' }],
      statut: STATUT_LOCATION_RESERVEE,
      factureNumero: null
    })
  }

  function changerMois(decalage: number): void {
    const date = new Date(vue.annee, vue.mois - 1 + decalage, 1)
    setVue({ annee: date.getFullYear(), mois: date.getMonth() + 1 })
  }

  function retournerAujourdhui(): void {
    const d = new Date()
    setVue({ annee: d.getFullYear(), mois: d.getMonth() + 1 })
  }

  function mettreAJour(changements: Partial<FormEvenement> | Partial<FormLocation>): void {
    setEdition((precedent) => (precedent ? ({ ...precedent, ...changements } as Formulaire) : precedent))
  }

  function modifierLigne(index: number, changements: Partial<LigneForm>): void {
    setEdition((precedent) =>
      precedent && precedent.type === 'location'
        ? { ...precedent, lignes: precedent.lignes.map((l, i) => (i === index ? { ...l, ...changements } : l)) }
        : precedent
    )
  }

  function ajouterLigne(): void {
    setEdition((precedent) =>
      precedent && precedent.type === 'location'
        ? { ...precedent, lignes: [...precedent.lignes, { reference: '', quantite: '1', prix: '0' }] }
        : precedent
    )
  }

  function retirerLigne(index: number): void {
    setEdition((precedent) =>
      precedent && precedent.type === 'location'
        ? { ...precedent, lignes: precedent.lignes.filter((_, i) => i !== index) }
        : precedent
    )
  }

  async function enregistrer(): Promise<void> {
    if (!edition) return
    setErreur(null)
    setInfo(null)
    setAvertissements([])
    try {
      if (edition.type === 'evenement') {
        const enregistre = await window.api.agenda.enregistrerEvenement({
          id: edition.id,
          titre: edition.titre,
          debut: edition.debut.replace('T', ' '),
          fin: edition.fin.replace('T', ' '),
          lieu: edition.lieu,
          notes: edition.notes
        })
        const formulaire = versFormEvenement(enregistre)
        setEdition(formulaire)
        setInstantane(JSON.stringify(formulaire))
      } else {
        const resultat = await window.api.agenda.enregistrerLocation({
          id: edition.id,
          clientId: edition.clientId,
          dateDebut: edition.dateDebut,
          dateFin: edition.dateFin,
          notes: edition.notes,
          lignes: edition.lignes
            .filter((l) => l.reference !== '')
            .map((l) => ({ referenceInventaire: l.reference, quantite: nombre(l.quantite), prixParJour: nombre(l.prix) }))
        })
        const formulaire = versFormLocation(resultat.location)
        setEdition(formulaire)
        setInstantane(JSON.stringify(formulaire))
        setAvertissements(resultat.avertissements)
      }
      await recharger()
    } catch (e) {
      setErreur(messageDe(e))
    }
  }

  async function supprimerEvenement(): Promise<void> {
    if (!edition || edition.type !== 'evenement' || edition.id === 0) return
    if (!window.confirm(t('agenda.confirmerSuppression', { titre: edition.titre }))) return
    try {
      await window.api.agenda.supprimerEvenement(edition.id)
      setEdition(null)
      setInstantane(null)
      await recharger()
    } catch (e) {
      setErreur(messageDe(e))
    }
  }

  async function changerStatut(statut: StatutLocation): Promise<void> {
    if (!edition || edition.type !== 'location' || edition.id === 0) return
    setErreur(null)
    try {
      const location = await window.api.agenda.changerStatutLocation(edition.id, statut)
      // Seul le statut change : ce qui est en cours de saisie dans le formulaire reste.
      setEdition({ ...edition, statut: location.statut })
      setInstantane((precedent) =>
        precedent ? JSON.stringify({ ...(JSON.parse(precedent) as FormLocation), statut: location.statut }) : precedent
      )
      await recharger()
    } catch (e) {
      setErreur(messageDe(e))
    }
  }

  async function creerFacture(): Promise<void> {
    if (!edition || edition.type !== 'location' || edition.id === 0) return
    setErreur(null)
    try {
      const facture = await window.api.agenda.creerFacture(edition.id)
      setEdition({ ...edition, factureNumero: facture.numero })
      setInstantane((precedent) =>
        precedent
          ? JSON.stringify({ ...(JSON.parse(precedent) as FormLocation), factureNumero: facture.numero })
          : precedent
      )
      setInfo(t('agenda.factureCreee', { numero: facture.numero }))
      await recharger()
    } catch (e) {
      setErreur(messageDe(e))
    }
  }

  // --- Ce que contient chaque jour de la grille ---
  const evenementsDuJour = (jour: string): EvenementAgenda[] =>
    contenu.evenements.filter((e) =>
      periodesSeChevauchent({ debut: jour, fin: jour }, { debut: e.debut.slice(0, 10), fin: e.fin.slice(0, 10) })
    )
  const locationsDuJour = (jour: string): LocationAgenda[] =>
    contenu.locations.filter((l) => periodesSeChevauchent({ debut: jour, fin: jour }, { debut: l.dateDebut, fin: l.dateFin }))

  const titreMois = new Date(Date.UTC(vue.annee, vue.mois - 1, 1)).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  })
  const enTetes = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    new Date(Date.UTC(2026, 9, 5 + i)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })
  )

  const libelleLocation = (l: LocationAgenda): string =>
    `${l.clientNom} — ${t('agenda.nbArticles', { n: l.lignes.length })}`

  // La liste du mois : événements et locations mêlés, par ordre de début.
  const elementsDuMois = [
    ...contenu.evenements
      .filter((e) => e.debut.slice(0, 7) === prefixeMois || e.fin.slice(0, 7) === prefixeMois)
      .map((e) => ({
        cle: `e${e.id}`,
        debut: e.debut,
        texte: `${e.debut.slice(5, 16)} — ${e.titre}`,
        annule: false,
        ouvrir: () => ouvrir(versFormEvenement(e))
      })),
    ...contenu.locations
      .filter((l) => l.dateDebut.slice(0, 7) === prefixeMois || l.dateFin.slice(0, 7) === prefixeMois)
      .map((l) => ({
        cle: `l${l.id}`,
        debut: l.dateDebut,
        texte: `${l.dateDebut.slice(5)} → ${l.dateFin.slice(5)} — ${libelleLocation(l)} — ${formaterMontant(l.total)}`,
        annule: l.statut === STATUT_LOCATION_ANNULEE,
        ouvrir: () => ouvrir(versFormLocation(l))
      }))
  ].sort((a, b) => (a.debut < b.debut ? -1 : a.debut > b.debut ? 1 : 0))

  // --- Totaux du formulaire de location ---
  let joursLocation = 0
  let totalFormulaire = 0
  let erreurDates: string | null = null
  if (edition?.type === 'location') {
    try {
      joursLocation = nombreDeJours(edition.dateDebut, edition.dateFin)
      totalFormulaire = totalLocation(
        edition.lignes.map((l) => ({ quantite: nombre(l.quantite) || 0, prixParJour: nombre(l.prix) || 0 })),
        joursLocation
      )
    } catch (e) {
      erreurDates = messageDe(e)
    }
  }
  const quantiteParReference = new Map<string, number>()
  if (edition?.type === 'location') {
    for (const l of edition.lignes) {
      if (l.reference) quantiteParReference.set(l.reference, (quantiteParReference.get(l.reference) ?? 0) + (nombre(l.quantite) || 0))
    }
  }

  return (
    <div className="pile-cartes">
      <div className="carte">
        <div className="barre-boutons">
          <button className="bouton-secondaire" onClick={() => changerMois(-1)} aria-label={t('agenda.moisPrecedent')}>
            ◀
          </button>
          <h2 style={{ margin: 0, flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>{titreMois}</h2>
          <button className="bouton-secondaire" onClick={() => changerMois(1)} aria-label={t('agenda.moisSuivant')}>
            ▶
          </button>
          <button className="bouton-secondaire" onClick={retournerAujourdhui}>
            {t('agenda.aujourdhui')}
          </button>
        </div>

        <div className="agenda-grille">
          {enTetes.map((nom) => (
            <div key={nom} className="agenda-entete">
              {nom}
            </div>
          ))}
          {grille.map((jour) => {
            const duMois = jour.slice(0, 7) === prefixeMois
            const aujourdhuiIci = jour === aujourdhui
            return (
              // Les classes sont écrites en entier dans l'attribut : tests/atteignable.mjs les y cherche.
              <div
                key={jour}
                className={
                  duMois
                    ? aujourdhuiIci
                      ? 'agenda-jour agenda-jour-aujourdhui'
                      : 'agenda-jour'
                    : aujourdhuiIci
                      ? 'agenda-jour agenda-jour-autre-mois agenda-jour-aujourdhui'
                      : 'agenda-jour agenda-jour-autre-mois'
                }
              >
                <div className="agenda-numero">{Number(jour.slice(8))}</div>
                {evenementsDuJour(jour).map((e) => (
                  <button key={`e${e.id}`} className="agenda-pastille" onClick={() => ouvrir(versFormEvenement(e))}>
                    {e.debut.slice(0, 10) === jour ? `${e.debut.slice(11, 16)} ${e.titre}` : e.titre}
                  </button>
                ))}
                {locationsDuJour(jour).map((l) => (
                  <button
                    key={`l${l.id}`}
                    className={l.statut === STATUT_LOCATION_ANNULEE ? 'agenda-location agenda-annulee' : 'agenda-location'}
                    onClick={() => ouvrir(versFormLocation(l))}
                  >
                    {libelleLocation(l)}
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        <div className="barre-boutons">
          <button className="action-ecriture" onClick={nouvelEvenement}>
            {t('agenda.ajouterEvenement')}
          </button>
          <button className="action-ecriture" onClick={nouvelleLocation}>
            {t('agenda.ajouterLocation')}
          </button>
        </div>
      </div>

      <div className="carte">
        <h2>{t('agenda.listeDuMois')}</h2>
        {elementsDuMois.length === 0 ? (
          <p>{t('agenda.rienCeMois')}</p>
        ) : (
          <table className="table-editable">
            <tbody>
              {elementsDuMois.map((element) => (
                <tr key={element.cle}>
                  <td className={element.annule ? 'agenda-annulee' : ''}>{element.texte}</td>
                  <td>
                    <button className="bouton-secondaire" onClick={element.ouvrir}>
                      {t('agenda.ouvrir')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edition && edition.type === 'evenement' && (
        <div className="carte">
          <h2>{t('agenda.typeEvenement')}</h2>
          <label>
            {t('agenda.titre')}
            <input value={edition.titre} onChange={(e) => mettreAJour({ titre: e.target.value })} />
          </label>
          <label>
            {t('agenda.debut')}
            <input type="datetime-local" value={edition.debut} onChange={(e) => mettreAJour({ debut: e.target.value })} />
          </label>
          <label>
            {t('agenda.fin')}
            <input type="datetime-local" value={edition.fin} onChange={(e) => mettreAJour({ fin: e.target.value })} />
          </label>
          <label>
            {t('agenda.lieu')}
            <input value={edition.lieu} onChange={(e) => mettreAJour({ lieu: e.target.value })} />
          </label>
          <label>
            {t('agenda.notes')}
            <textarea rows={3} value={edition.notes} onChange={(e) => mettreAJour({ notes: e.target.value })} />
          </label>
          {erreur && <p className="erreur">{erreur}</p>}
          <div className="barre-boutons">
            <button className="action-ecriture" onClick={enregistrer}>
              {t('action.enregistrer')}
            </button>
            {edition.id !== 0 && (
              <button className="action-ecriture bouton-danger" onClick={supprimerEvenement}>
                {t('action.supprimer')}
              </button>
            )}
            <button className="bouton-secondaire" onClick={fermer}>
              {t('agenda.fermer')}
            </button>
          </div>
        </div>
      )}

      {edition && edition.type === 'location' && (
        <div className="carte">
          <h2>{t('agenda.typeLocation')}</h2>
          <label>
            {t('agenda.client')}
            <select value={edition.clientId} onChange={(e) => mettreAJour({ clientId: Number(e.target.value) })}>
              <option value={0}>{t('agenda.choisirClient')}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.nom}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('agenda.dateDebut')}
            <input type="date" value={edition.dateDebut} onChange={(e) => mettreAJour({ dateDebut: e.target.value })} />
          </label>
          <label>
            {t('agenda.dateFin')}
            <input type="date" value={edition.dateFin} onChange={(e) => mettreAJour({ dateFin: e.target.value })} />
          </label>
          {erreurDates ? (
            <p className="erreur">{erreurDates}</p>
          ) : (
            <p>{t('agenda.duree', { jours: joursLocation })}</p>
          )}

          <h3>{t('agenda.lignes')}</h3>
          <table className="table-editable">
            <thead>
              <tr>
                <th>{t('agenda.article')}</th>
                <th>{t('agenda.quantite')}</th>
                <th>{t('agenda.prixParJour')}</th>
                <th>{t('doc.total')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {edition.lignes.map((ligne, index) => {
                const dispo = ligne.reference ? dispos[ligne.reference] : undefined
                const demandee = ligne.reference ? (quantiteParReference.get(ligne.reference) ?? 0) : 0
                return (
                  <tr key={index}>
                    <td>
                      <select value={ligne.reference} onChange={(e) => modifierLigne(index, { reference: e.target.value })}>
                        <option value="">{t('agenda.choisirArticle')}</option>
                        {articles.map((article) => (
                          <option key={article.reference} value={article.reference}>
                            {article.reference} — {article.designation}
                          </option>
                        ))}
                      </select>
                      {dispo && (
                        <div className={demandee > dispo.disponible ? 'texte-alerte' : ''}>
                          {t('agenda.disponible', { n: dispo.disponible })}
                        </div>
                      )}
                    </td>
                    <td>
                      <input value={ligne.quantite} onChange={(e) => modifierLigne(index, { quantite: e.target.value })} />
                    </td>
                    <td>
                      <input value={ligne.prix} onChange={(e) => modifierLigne(index, { prix: e.target.value })} />
                    </td>
                    <td>
                      {formaterMontant(
                        totalLigneLocation({ quantite: nombre(ligne.quantite) || 0, prixParJour: nombre(ligne.prix) || 0 }, joursLocation)
                      )}
                    </td>
                    <td>
                      <button className="bouton-secondaire" onClick={() => retirerLigne(index)}>
                        {t('agenda.retirerLigne')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="barre-boutons">
            <button className="bouton-secondaire" onClick={ajouterLigne}>
              {t('agenda.ajouterLigne')}
            </button>
          </div>

          <div className="resultats-calcules">
            <p>
              {t('agenda.totalLocation')} : <strong>{formaterMontant(totalFormulaire)}</strong>
            </p>
          </div>

          <label>
            {t('agenda.notes')}
            <textarea rows={3} value={edition.notes} onChange={(e) => mettreAJour({ notes: e.target.value })} />
          </label>

          {avertissements.map((avertissement) => (
            <p key={avertissement} className="texte-alerte">
              {avertissement}
            </p>
          ))}
          {erreur && <p className="erreur">{erreur}</p>}
          {info && <p className="succes">{info}</p>}

          <div className="barre-boutons">
            <button className="action-ecriture" onClick={enregistrer}>
              {t('action.enregistrer')}
            </button>
            <button className="bouton-secondaire" onClick={fermer}>
              {t('agenda.fermer')}
            </button>
          </div>

          {edition.id !== 0 && (
            <>
              <h3>{t('agenda.statut')}</h3>
              <div className="barre-boutons">
                {([STATUT_LOCATION_RESERVEE, STATUT_LOCATION_RENDUE, STATUT_LOCATION_ANNULEE] as StatutLocation[]).map((statut) => (
                  <button
                    key={statut}
                    className={edition.statut === statut ? '' : 'bouton-secondaire'}
                    onClick={() => changerStatut(statut)}
                  >
                    {t(cleStatut(statut))}
                  </button>
                ))}
              </div>

              <h3>{t('agenda.facture')}</h3>
              {edition.factureNumero ? (
                <>
                  <p>{t('agenda.factureNumero', { numero: edition.factureNumero })}</p>
                  {edition.statut === STATUT_LOCATION_ANNULEE && <p className="texte-alerte">{t('agenda.annuleeFacturee')}</p>}
                  <div className="barre-boutons">
                    <button className="bouton-secondaire" onClick={ouvrirFacturation}>
                      {t('agenda.ouvrirFacturation')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {modifie && <p>{t('agenda.enregistrerAvantFacture')}</p>}
                  <div className="barre-boutons">
                    <button
                      className="action-ecriture"
                      disabled={modifie || edition.statut === STATUT_LOCATION_ANNULEE || totalFormulaire <= 0}
                      onClick={creerFacture}
                    >
                      {t('agenda.creerFacture')}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
