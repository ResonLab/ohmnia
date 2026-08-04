import { useEffect, useState } from 'react'
import type { ResumeAnnuel } from '../../../shared/types'
import { diviserSansErreur } from '../../../shared/calculs'
import { formaterMontant, symboleDevise } from '../lib/devise'

export default function ResumeAnnuelPage(): React.JSX.Element {
  const [resumes, setResumes] = useState<ResumeAnnuel[]>([])
  const [anneeSelectionnee, setAnneeSelectionnee] = useState<number>(new Date().getFullYear())
  const [objectifCa, setObjectifCa] = useState(0)
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    window.api.resume
      .parAnnee()
      .then((liste) => {
        setResumes(liste)
        if (liste.length > 0 && !liste.some((r) => r.annee === anneeSelectionnee)) {
          setAnneeSelectionnee(liste[0].annee)
        }
      })
      .finally(() => setChargement(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    window.api.resume.lireObjectif(anneeSelectionnee).then(setObjectifCa)
  }, [anneeSelectionnee])

  async function enregistrerObjectif(): Promise<void> {
    setMessageErreur(null)
    try {
      await window.api.resume.enregistrerObjectif(anneeSelectionnee, objectifCa)
      setMessageSucces('Objectif enregistré.')
      setTimeout(() => setMessageSucces(null), 2500)
    } catch (erreur) {
      setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
    }
  }

  if (chargement) return <p>Chargement…</p>

  const resumeAnnee = resumes.find((r) => r.annee === anneeSelectionnee)
  const caRealise = resumeAnnee?.entrees ?? 0
  const progression = Math.min(diviserSansErreur(caRealise, objectifCa) * 100, 100)

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>Objectif de chiffre d'affaires</h2>
        <div className="ligne-formulaire">
          <label>
            Année
            <select value={anneeSelectionnee} onChange={(e) => setAnneeSelectionnee(Number(e.target.value))}>
              {resumes.length === 0 && <option value={anneeSelectionnee}>{anneeSelectionnee}</option>}
              {resumes.map((r) => (
                <option key={r.annee} value={r.annee}>
                  {r.annee}
                </option>
              ))}
            </select>
          </label>
          <label>
            Objectif CA annuel ({symboleDevise()})
            <input
              type="number"
              step="100"
              value={objectifCa}
              onChange={(e) => setObjectifCa(Number(e.target.value))}
            />
          </label>
        </div>
        <button onClick={enregistrerObjectif}>Enregistrer l'objectif</button>

        <div className="barre-progression-zone">
          <div className="barre-progression">
            <div className="barre-progression-remplissage" style={{ width: `${progression}%` }} />
          </div>
          <p className="valeur-calculee">
            {formaterMontant(caRealise)} réalisés sur {formaterMontant(objectifCa)} —{' '}
            <strong>{progression.toFixed(1)}%</strong>
            {objectifCa <= 0 && ' (saisissez un objectif pour voir la progression)'}
          </p>
        </div>
      </div>

      <div className="carte">
        <h2>Résumé par année</h2>
        {resumes.length === 0 ? (
          <p className="graphique-vide">Aucun mouvement enregistré dans le Journal pour l'instant.</p>
        ) : (
          <table className="table-editable">
            <thead>
              <tr>
                <th>Année</th>
                <th>Entrées</th>
                <th>Dépenses</th>
                <th>Bénéfice net</th>
                <th>TVA collectée</th>
                <th>TVA déductible</th>
                <th>TVA nette</th>
              </tr>
            </thead>
            <tbody>
              {resumes.map((r) => (
                <tr key={r.annee}>
                  <td>{r.annee}</td>
                  <td>{formaterMontant(r.entrees)}</td>
                  <td>{formaterMontant(r.depenses)}</td>
                  <td className={r.beneficeNet < 0 ? 'texte-alerte' : ''}>
                    {formaterMontant(r.beneficeNet)}
                  </td>
                  <td>{formaterMontant(r.tvaCollectee)}</td>
                  <td>{formaterMontant(r.tvaDeductible)}</td>
                  <td>
                    {formaterMontant(Math.abs(r.tvaNette))}{' '}
                    {r.tvaNette >= 0 ? '(à payer)' : '(à récupérer)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {messageErreur && <p className="erreur">{messageErreur}</p>}
      {messageSucces && <p className="succes">{messageSucces}</p>}
    </div>
  )
}
