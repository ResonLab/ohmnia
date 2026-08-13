import { formaterMontant } from '../lib/devise'
import { t } from '../../../shared/i18n'
const PALETTE = ['#2c6e49', '#2c3e50', '#c9963a', '#7b3f61', '#3a7ca5', '#b91c1c', '#5a7d5a', '#8a6d3b']

interface Props {
  donnees: { label: string; valeur: number }[]
}

function pointSurCercle(centre: number, rayon: number, angleDeg: number): [number, number] {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return [centre + rayon * Math.cos(angleRad), centre + rayon * Math.sin(angleRad)]
}

export default function Camembert({ donnees }: Props): React.JSX.Element {
  const total = donnees.reduce((s, d) => s + d.valeur, 0)

  if (total <= 0) {
    return <p className="graphique-vide">{t('graphique.aucuneSelection')}</p>
  }

  const centre = 90
  const rayon = 80
  let angleCourant = 0

  const segments = donnees
    .filter((d) => d.valeur > 0)
    .map((d, index) => {
      const proportion = d.valeur / total
      const angleDepart = angleCourant
      const angleFin = angleCourant + proportion * 360
      angleCourant = angleFin

      const [x1, y1] = pointSurCercle(centre, rayon, angleDepart)
      const [x2, y2] = pointSurCercle(centre, rayon, angleFin)
      const grandArc = angleFin - angleDepart > 180 ? 1 : 0

      const chemin =
        proportion >= 0.999
          ? `M ${centre - rayon} ${centre} A ${rayon} ${rayon} 0 1 1 ${centre + rayon} ${centre} A ${rayon} ${rayon} 0 1 1 ${centre - rayon} ${centre}`
          : `M ${centre} ${centre} L ${x1} ${y1} A ${rayon} ${rayon} 0 ${grandArc} 1 ${x2} ${y2} Z`

      return { chemin, couleur: PALETTE[index % PALETTE.length], label: d.label, valeur: d.valeur, proportion }
    })

  return (
    <div className="camembert">
      <svg viewBox="0 0 180 180" width="180" height="180">
        {segments.map((s) => (
          <path key={s.label} d={s.chemin} fill={s.couleur} stroke="#fff" strokeWidth="1" />
        ))}
      </svg>
      <ul className="legende">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="pastille" style={{ background: s.couleur }} />
            {s.label} — {(s.proportion * 100).toFixed(1)}% ({formaterMontant(s.valeur)})
          </li>
        ))}
      </ul>
    </div>
  )
}
