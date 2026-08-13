import { useEffect, useState } from 'react'
import type { EntreeAudit, ExerciceCloture, PointConformite } from '../../../shared/types'
import { locale, t, type CleTraduction } from '../../../shared/i18n'

function formaterHorodatage(iso: string): string {
  // SQLite stocke en UTC au format "YYYY-MM-DD HH:MM:SS".
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString(locale(), {
    dateStyle: 'short',
    timeStyle: 'medium'
  })
}

/**
 * Le libellé de chaque action tracée.
 *
 * **La clé de gauche est ce qui vit en base** — `creation`, `cloture`… — et ne
 * change jamais. Seul le libellé se traduit. Traduire la valeur enregistrée
 * rendrait un journal d'audit illisible pour qui change de langue, et un
 * journal qu'on ne peut plus relire ne trace plus rien.
 */
const LIBELLES_ACTION: Record<string, CleTraduction> = {
  creation: 'audit.actionCreation',
  duplication: 'audit.actionDuplication',
  conversion: 'audit.actionConversion',
  suppression: 'audit.actionSuppression',
  rappel: 'audit.actionRappel',
  export: 'audit.actionExport',
  import: 'audit.actionImport',
  ajout: 'audit.actionAjout',
  cloture: 'audit.actionCloture',
  reouverture: 'audit.actionReouverture',
  purge: 'audit.actionPurge',
  'facturation-temps': 'audit.actionFacturationTemps'
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
    setMessageErreur(erreur instanceof Error ? erreur.message : t('erreur.inconnue'))
  }

  function afficherSucces(message: string): void {
    setMessageErreur(null)
    setMessageSucces(message)
    setTimeout(() => setMessageSucces(null), 4000)
  }

  async function cloturer(): Promise<void> {
    if (anneeACloturer === '') {
      afficherErreur(new Error(t('audit.choisirAnnee')))
      return
    }
    const confirme = window.confirm(t('audit.confirmerCloture', { annee: anneeACloturer }))
    if (!confirme) return

    try {
      const nb = await window.api.exercices.cloturer(anneeACloturer)
      await recharger()
      afficherSucces(t('audit.exerciceCloture', { annee: anneeACloturer, nombre: nb }))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function reouvrir(annee: number): Promise<void> {
    if (!window.confirm(t('audit.confirmerReouverture', { annee }))) return
    try {
      await window.api.exercices.reouvrir(annee)
      await recharger()
      afficherSucces(t('audit.exerciceRouvert', { annee }))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function vider(): Promise<void> {
    const confirme = window.confirm(t('audit.confirmerVidage'))
    if (!confirme) return
    await window.api.audit.vider()
    await recharger()
    afficherSucces(t('audit.journalVide'))
  }

  if (chargement) return <p>{t('etat.chargement')}</p>

  const anneesCloturees = new Set(exercices.map((e) => e.annee))

  const ICONES_CONFORMITE: Record<PointConformite['statut'], string> = {
    ok: '✓',
    avertissement: '!',
    manquant: '✕'
  }

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>{t('audit.conformiteTitre')}</h2>
        <p className="valeur-calculee">
          {t('audit.conformiteAide')}{' '}
          <strong>{t('audit.conformiteReserve')}</strong>
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
        <h2>{t('audit.exercicesTitre')}</h2>
        <p className="valeur-calculee">
          {t('audit.exercicesAide')}
        </p>

        <div className="ligne-formulaire">
          <label>
            {t('audit.anneeACloturer')}
            <select
              value={anneeACloturer}
              onChange={(e) => setAnneeACloturer(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">{t('audit.choisir')}</option>
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
        <button onClick={cloturer}>{t('audit.cloturerExercice')}</button>

        {exercices.length > 0 && (
          <table className="table-editable" style={{ marginTop: '1.2rem' }}>
            <thead>
              <tr>
                <th>{t('resume.annee')}</th>
                <th>{t('audit.clotureeLe')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exercices.map((e) => (
                <tr key={e.annee}>
                  <td>{e.annee}</td>
                  <td className="colonne-etroite">{formaterHorodatage(e.clotureLe)}</td>
                  <td>
                    <button onClick={() => reouvrir(e.annee)}>{t('audit.rouvrir')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="carte">
        <h2>{t('audit.journalTitre')}</h2>
        <p className="valeur-calculee">
          {t('audit.journalAide', { nombre: entrees.length })}
        </p>

        {entrees.length === 0 ? (
          <p className="graphique-vide">{t('audit.aucuneOperation')}</p>
        ) : (
          <table className="table-editable">
            <thead>
              <tr>
                <th>{t('audit.dateEtHeure')}</th>
                <th>{t('audit.action')}</th>
                <th>{t('audit.objet')}</th>
                <th>{t('colonne.reference')}</th>
                <th>{t('audit.details')}</th>
              </tr>
            </thead>
            <tbody>
              {entrees.map((e) => (
                <tr key={e.id}>
                  <td className="colonne-etroite">{formaterHorodatage(e.horodatage)}</td>
                  <td>{LIBELLES_ACTION[e.action] ? t(LIBELLES_ACTION[e.action]) : e.action}</td>
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
            {t('audit.viderJournal')}
          </button>
        </div>
      </div>

      {messageErreur && <p className="erreur">{messageErreur}</p>}
      {messageSucces && <p className="succes">{messageSucces}</p>}
    </div>
  )
}
