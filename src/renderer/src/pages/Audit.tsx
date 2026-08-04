import { useEffect, useState } from 'react'
import type { EntreeAudit, ExerciceCloture, PointConformite } from '../../../shared/types'

function formaterHorodatage(iso: string): string {
  // SQLite stocke en UTC au format "YYYY-MM-DD HH:MM:SS".
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('fr-CH', {
    dateStyle: 'short',
    timeStyle: 'medium'
  })
}

const LIBELLES_ACTION: Record<string, string> = {
  creation: 'Création',
  duplication: 'Duplication',
  conversion: 'Conversion',
  suppression: 'Suppression',
  rappel: 'Rappel de paiement',
  export: 'Export',
  import: 'Import',
  ajout: 'Ajout',
  cloture: "Clôture d'exercice",
  reouverture: "Réouverture d'exercice",
  purge: 'Purge',
  'facturation-temps': 'Facturation du temps'
}

export default function Audit(): React.JSX.Element {
  const [entrees, setEntrees] = useState<EntreeAudit[]>([])
  const [exercices, setExercices] = useState<ExerciceCloture[]>([])
  const [annees, setAnnees] = useState<number[]>([])
  const [conformite, setConformite] = useState<PointConformite[]>([])
  const [anneeACloturer, setAnneeACloturer] = useState<number | ''>('')
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)

  async function recharger(): Promise<void> {
    const [a, e, evolution, c] = await Promise.all([
      window.api.audit.lister(300),
      window.api.exercices.lister(),
      window.api.journal.evolutionAnnuelle(),
      window.api.conformite.verifier()
    ])
    setEntrees(a)
    setExercices(e)
    setAnnees(evolution.map((x) => x.annee).sort((x, y) => y - x))
    setConformite(c)
  }

  useEffect(() => {
    recharger().finally(() => setChargement(false))
  }, [])

  function afficherErreur(erreur: unknown): void {
    setMessageSucces(null)
    setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
  }

  function afficherSucces(message: string): void {
    setMessageErreur(null)
    setMessageSucces(message)
    setTimeout(() => setMessageSucces(null), 4000)
  }

  async function cloturer(): Promise<void> {
    if (anneeACloturer === '') {
      afficherErreur(new Error('Choisis une année à clôturer.'))
      return
    }
    const confirme = window.confirm(
      `Clôturer l'exercice ${anneeACloturer} ?\n\n` +
        'Plus aucune écriture de cette année ne pourra être ajoutée, modifiée ou supprimée. ' +
        'Tu pourras rouvrir l\'exercice si nécessaire.'
    )
    if (!confirme) return

    try {
      const nb = await window.api.exercices.cloturer(anneeACloturer)
      await recharger()
      afficherSucces(`Exercice ${anneeACloturer} clôturé : ${nb} écriture(s) verrouillée(s).`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function reouvrir(annee: number): Promise<void> {
    if (!window.confirm(`Rouvrir l'exercice ${annee} ? Les écritures redeviendront modifiables.`)) return
    try {
      await window.api.exercices.reouvrir(annee)
      await recharger()
      afficherSucces(`Exercice ${annee} rouvert.`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function vider(): Promise<void> {
    const confirme = window.confirm(
      "Vider le journal d'audit ?\n\nL'historique des modifications sera perdu (la purge elle-même reste tracée)."
    )
    if (!confirme) return
    await window.api.audit.vider()
    await recharger()
    afficherSucces("Journal d'audit vidé.")
  }

  if (chargement) return <p>Chargement…</p>

  const anneesCloturees = new Set(exercices.map((e) => e.annee))

  const ICONES_CONFORMITE: Record<PointConformite['statut'], string> = {
    ok: '✓',
    avertissement: '!',
    manquant: '✕'
  }

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>Conformité de la facturation</h2>
        <p className="valeur-calculee">
          Contrôles automatiques des mentions et de la numérotation.{' '}
          <strong>
            Cette liste ne certifie rien et ne remplace pas l'avis de votre fiduciaire.
          </strong>
        </p>

        <ul className="liste-conformite">
          {conformite.map((point) => (
            <li key={point.cle} className={`conformite-${point.statut}`}>
              <span className="conformite-icone">{ICONES_CONFORMITE[point.statut]}</span>
              <span className="conformite-textes">
                <span className="conformite-libelle">{point.libelle}</span>
                <span className="conformite-explication">{point.explication}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="carte">
        <h2>Exercices comptables</h2>
        <p className="valeur-calculee">
          Clôturer une année la verrouille : plus aucune écriture du Journal ne peut y être ajoutée,
          modifiée ou supprimée. Utile une fois la déclaration faite, pour éviter toute modification
          accidentelle d'un exercice passé.
        </p>

        <div className="ligne-formulaire">
          <label>
            Année à clôturer
            <select
              value={anneeACloturer}
              onChange={(e) => setAnneeACloturer(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">— Choisir —</option>
              {annees
                .filter((a) => !anneesCloturees.has(a))
                .map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <button onClick={cloturer}>Clôturer l'exercice</button>

        {exercices.length > 0 && (
          <table className="table-editable" style={{ marginTop: '1.2rem' }}>
            <thead>
              <tr>
                <th>Année</th>
                <th>Clôturée le</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exercices.map((e) => (
                <tr key={e.annee}>
                  <td>{e.annee}</td>
                  <td className="colonne-etroite">{formaterHorodatage(e.clotureLe)}</td>
                  <td>
                    <button onClick={() => reouvrir(e.annee)}>Rouvrir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="carte">
        <h2>Journal d'audit</h2>
        <p className="valeur-calculee">
          Trace des opérations sensibles : créations, duplications, conversions, suppressions,
          rappels, imports/exports et clôtures. {entrees.length} entrée(s) affichée(s).
        </p>

        {entrees.length === 0 ? (
          <p className="graphique-vide">Aucune opération enregistrée pour l'instant.</p>
        ) : (
          <table className="table-editable">
            <thead>
              <tr>
                <th>Date et heure</th>
                <th>Action</th>
                <th>Objet</th>
                <th>Référence</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              {entrees.map((e) => (
                <tr key={e.id}>
                  <td className="colonne-etroite">{formaterHorodatage(e.horodatage)}</td>
                  <td>{LIBELLES_ACTION[e.action] ?? e.action}</td>
                  <td>{e.entite}</td>
                  <td>{e.reference || '—'}</td>
                  <td>{e.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="barre-boutons">
          <button className="bouton-danger" onClick={vider}>
            Vider le journal d'audit
          </button>
        </div>
      </div>

      {messageErreur && <p className="erreur">{messageErreur}</p>}
      {messageSucces && <p className="succes">{messageSucces}</p>}
    </div>
  )
}
