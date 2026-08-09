import { useEffect, useState } from 'react'
import type { HistoriqueFacture, Intervention } from '../../../shared/types'
import ClientSelecteur from '../components/ClientSelecteur'
import Modale from '../components/Modale'
import { chargerValeursSuggerees, type ValeursSuggerees } from '../lib/suggestions'
import { formaterMontant } from '../lib/devise'

function formaterDuree(secondes: number): string {
  const heures = Math.floor(secondes / 3600)
  const minutes = Math.floor((secondes % 3600) / 60)
  const reste = secondes % 60
  return `${String(heures).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(reste).padStart(2, '0')}`
}

function formaterDateHeure(iso: string): string {
  // SQLite renvoie "YYYY-MM-DD HH:MM:SS" en UTC.
  const date = new Date(iso.replace(' ', 'T') + 'Z')
  return date.toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })
}

export default function SuiviTemps(): React.JSX.Element {
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [enCours, setEnCours] = useState<Intervention | null>(null)
  const [secondesAffichees, setSecondesAffichees] = useState(0)
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<ValeursSuggerees | null>(null)
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [factures, setFactures] = useState<HistoriqueFacture[]>([])
  const [modaleFacturation, setModaleFacturation] = useState(false)
  const [factureCible, setFactureCible] = useState<number | ''>('')
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)

  async function recharger(): Promise<void> {
    const [liste, courante] = await Promise.all([
      window.api.suiviTemps.lister(),
      window.api.suiviTemps.enCours()
    ])
    setInterventions(liste)
    setEnCours(courante)
  }

  useEffect(() => {
    Promise.all([recharger(), chargerValeursSuggerees().then(setSuggestions)]).finally(() =>
      setChargement(false)
    )
  }, [])

  // Rafraîchit l'affichage du chrono chaque seconde tant qu'une intervention tourne.
  useEffect(() => {
    if (!enCours) {
      setSecondesAffichees(0)
      return
    }
    const debut = new Date(enCours.debut.replace(' ', 'T') + 'Z').getTime()
    const rafraichir = (): void => setSecondesAffichees(Math.floor((Date.now() - debut) / 1000))
    rafraichir()
    const minuteur = setInterval(rafraichir, 1000)
    return () => clearInterval(minuteur)
  }, [enCours])

  function afficherErreur(erreur: unknown): void {
    setMessageSucces(null)
    setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
  }

  function afficherSucces(message: string): void {
    setMessageErreur(null)
    setMessageSucces(message)
    setTimeout(() => setMessageSucces(null), 3000)
  }

  async function demarrer(): Promise<void> {
    try {
      await window.api.suiviTemps.demarrer(description, clientId)
      setDescription('')
      await recharger()
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function arreter(): Promise<void> {
    if (!enCours) return
    try {
      const terminee = await window.api.suiviTemps.arreter(enCours.id)
      await recharger()
      afficherSucces(`Intervention arrêtée : ${formaterDuree(terminee.secondesEcoulees)}.`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function modifier(intervention: Intervention): Promise<void> {
    setInterventions((precedent) =>
      precedent.map((i) => (i.id === intervention.id ? intervention : i))
    )
    try {
      await window.api.suiviTemps.modifier(intervention)
    } catch (erreur) {
      afficherErreur(erreur)
      await recharger()
    }
  }

  async function supprimer(id: number): Promise<void> {
    if (!window.confirm('Supprimer cette intervention ?')) return
    await window.api.suiviTemps.supprimer(id)
    await recharger()
  }

  function basculerSelection(id: number): void {
    setSelection((precedent) => {
      const copie = new Set(precedent)
      if (copie.has(id)) copie.delete(id)
      else copie.add(id)
      return copie
    })
  }

  async function ouvrirModaleFacturation(): Promise<void> {
    if (selection.size === 0) {
      afficherErreur(new Error('Sélectionne au moins une intervention à facturer.'))
      return
    }
    setFactures(await window.api.factures.historique())
    setModaleFacturation(true)
  }

  async function facturer(): Promise<void> {
    if (factureCible === '') {
      afficherErreur(new Error('Choisis la facture sur laquelle ajouter ces heures.'))
      return
    }
    try {
      const nb = await window.api.suiviTemps.facturer(
        Array.from(selection),
        factureCible,
        suggestions?.tauxHoraireSuggere ?? 0
      )
      setSelection(new Set())
      setModaleFacturation(false)
      await recharger()
      afficherSucces(`${nb} intervention(s) ajoutée(s) à la facture.`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  if (chargement) return <p>Chargement…</p>

  const tauxSuggere = suggestions?.tauxHoraireSuggere ?? 0
  const nonFacturees = interventions.filter((i) => i.fin && !i.factureId)
  const totalNonFacture = nonFacturees.reduce(
    (somme, i) => somme + (i.secondesEcoulees / 3600) * (i.tauxHoraire ?? tauxSuggere),
    0
  )

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>Chronomètre</h2>
        {enCours ? (
          <>
            <div className="chrono">
              <span className="chrono-valeur">{formaterDuree(secondesAffichees)}</span>
              <span className="chrono-detail">
                {enCours.description || 'Sans description'}
                {enCours.clientNom ? ` · ${enCours.clientNom}` : ''}
              </span>
              <span className="chrono-detail">Démarrée à {formaterDateHeure(enCours.debut)}</span>
            </div>
            <div className="barre-boutons">
              <button className="action-ecriture" onClick={arreter}>Arrêter l'intervention</button>
            </div>
          </>
        ) : (
          <>
            <label>
              Description de l'intervention
              <input
                placeholder="ex. Diagnostic ampli salon"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label>
              Client (optionnel)
              <ClientSelecteur clientId={clientId} onChange={setClientId} />
            </label>
            <button className="action-ecriture" onClick={demarrer}>Démarrer le chronomètre</button>
          </>
        )}
      </div>

      <div className="carte">
        <h2>Interventions</h2>
        <div className="tuiles" style={{ marginBottom: '1.2rem' }}>
          <div className="tuile">
            <span className="tuile-valeur">{nonFacturees.length}</span>
            <span className="tuile-libelle">Non facturées</span>
          </div>
          <div className="tuile">
            <span className="tuile-valeur">{formaterMontant(totalNonFacture)}</span>
            <span className="tuile-libelle">À facturer</span>
          </div>
        </div>

        <table className="table-editable">
          <thead>
            <tr>
              <th></th>
              <th>Début</th>
              <th>Description</th>
              <th>Client</th>
              <th>Durée (h)</th>
              <th>Taux (vide = {formaterMontant(tauxSuggere)})</th>
              <th>Montant</th>
              <th>Facturée</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {interventions.map((i) => {
              const heures = i.secondesEcoulees / 3600
              const taux = i.tauxHoraire ?? tauxSuggere
              const facturable = Boolean(i.fin) && !i.factureId
              return (
                <tr key={i.id}>
                  <td>
                    {facturable && (
                      <input
                        type="checkbox"
                        checked={selection.has(i.id)}
                        onChange={() => basculerSelection(i.id)}
                      />
                    )}
                  </td>
                  <td className="colonne-etroite">{formaterDateHeure(i.debut)}</td>
                  <td>
                    <input
                      value={i.description}
                      onChange={(e) => modifier({ ...i, description: e.target.value })}
                    />
                  </td>
                  <td className="colonne-etroite">{i.clientNom ?? '—'}</td>
                  <td>
                    {i.fin ? (
                      <input
                        type="number"
                        step="0.25"
                        value={Number(heures.toFixed(2))}
                        onChange={(e) =>
                          modifier({ ...i, secondesEcoulees: Number(e.target.value) * 3600 })
                        }
                      />
                    ) : (
                      <span className="colonne-etroite">en cours</span>
                    )}
                  </td>
                  <td>
                    <input
                      type="number"
                      step="1"
                      placeholder={tauxSuggere.toFixed(2)}
                      value={i.tauxHoraire ?? ''}
                      onChange={(e) =>
                        modifier({
                          ...i,
                          tauxHoraire: e.target.value === '' ? null : Number(e.target.value)
                        })
                      }
                    />
                  </td>
                  <td>{i.fin ? `${formaterMontant(heures * taux)}` : '—'}</td>
                  <td className="colonne-etroite">{i.factureId ? 'Oui' : 'Non'}</td>
                  <td>
                    <button className="action-ecriture bouton-danger" onClick={() => supprimer(i.id)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              )
            })}
            {interventions.length === 0 && (
              <tr>
                <td colSpan={9} className="colonne-etroite">
                  Aucune intervention enregistrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="barre-boutons">
          <button className="action-ecriture" onClick={ouvrirModaleFacturation}>
            Facturer la sélection ({selection.size})
          </button>
        </div>
      </div>

      {modaleFacturation && (
        <Modale
          titre="Facturer les interventions sélectionnées"
          onFermer={() => setModaleFacturation(false)}
          onValider={facturer}
          libelleValider="Ajouter à la facture"
        >
          <p>
            Chaque intervention devient une ligne de main d'œuvre (heures × taux) sur la facture
            choisie. Les interventions déjà facturées sont ignorées.
          </p>
          <label>
            Facture
            <select
              value={factureCible}
              onChange={(e) => setFactureCible(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">— Choisir —</option>
              {factures.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.numero} · {f.clientNom} · {f.statut}
                </option>
              ))}
            </select>
          </label>
        </Modale>
      )}

      {messageErreur && <p className="erreur">{messageErreur}</p>}
      {messageSucces && <p className="succes">{messageSucces}</p>}
    </div>
  )
}
