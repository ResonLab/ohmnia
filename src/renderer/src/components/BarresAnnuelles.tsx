import type { EvolutionAnnuelle } from '../../../shared/types'
import { formaterMontant } from '../lib/devise'

interface Props {
  donnees: EvolutionAnnuelle[]
}

export default function BarresAnnuelles({ donnees }: Props): React.JSX.Element {
  if (donnees.length === 0) {
    return <p className="graphique-vide">Aucune donnée disponible.</p>
  }

  const maxValeur = Math.max(...donnees.map((d) => Math.max(d.entrees, d.depenses)), 1)
  const hauteurZone = 160

  return (
    <div className="barres-annuelles">
      <div className="barres-legende">
        <span>
          <span className="pastille" style={{ background: '#2c6e49' }} /> Entrées
        </span>
        <span>
          <span className="pastille" style={{ background: '#b91c1c' }} /> Dépenses
        </span>
      </div>
      <div className="barres-zone" style={{ height: hauteurZone }}>
        {donnees.map((d) => (
          <div className="barre-groupe" key={d.annee}>
            <div className="barre-paire">
              <div
                className="barre entrees"
                style={{ height: `${(d.entrees / maxValeur) * hauteurZone}px` }}
                title={`Entrées ${formaterMontant(d.entrees)}`}
              />
              <div
                className="barre depenses"
                style={{ height: `${(d.depenses / maxValeur) * hauteurZone}px` }}
                title={`Dépenses ${formaterMontant(d.depenses)}`}
              />
            </div>
            <span className="barre-annee">{d.annee}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
