import { useRef, useState } from 'react'
import LogoOhmnia from './LogoOhmnia'
import {
  CONDITIONS_UTILISATION,
  RESUME_CONDITIONS,
  VERSION_CONDITIONS
} from '../../../shared/conditions'

interface Props {
  onAccepter: () => void
}

/**
 * Écran d'acceptation affiché au premier lancement, et à nouveau si le texte
 * des conditions change. Bloque l'accès à l'application tant qu'il n'est pas validé.
 */
export default function ConditionsUtilisation({ onAccepter }: Props): React.JSX.Element {
  const [luJusquEnBas, setLuJusquEnBas] = useState(false)
  const [caseCochee, setCaseCochee] = useState(false)
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const zoneTexte = useRef<HTMLDivElement>(null)

  /** On n'active la case qu'une fois le texte réellement parcouru. */
  function surDefilement(): void {
    const zone = zoneTexte.current
    if (!zone) return
    const enBas = zone.scrollTop + zone.clientHeight >= zone.scrollHeight - 24
    if (enBas) setLuJusquEnBas(true)
  }

  async function accepter(): Promise<void> {
    if (!caseCochee) {
      setMessageErreur('Cochez la case pour confirmer que vous avez lu et accepté les conditions.')
      return
    }
    try {
      await window.api.conditions.accepter()
      onAccepter()
    } catch (erreur) {
      setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
    }
  }

  return (
    <div className="conditions-plein-ecran">
      <div className="conditions-fenetre">
        <header className="conditions-entete">
          <LogoOhmnia taille={40} />
          <div>
            <h1>Conditions d'utilisation</h1>
            <p>Version {VERSION_CONDITIONS} — à lire avant la première utilisation</p>
          </div>
        </header>

        <div className="conditions-texte" ref={zoneTexte} onScroll={surDefilement}>
          {CONDITIONS_UTILISATION.map((section) => (
            <section key={section.titre}>
              <h2>{section.titre}</h2>
              {section.paragraphes.map((paragraphe, index) => (
                <p key={index}>{paragraphe}</p>
              ))}
            </section>
          ))}
        </div>

        <p className="conditions-resume">{RESUME_CONDITIONS}</p>

        <div className="conditions-pied">
          <label className={`case-a-cocher ${luJusquEnBas ? '' : 'desactive'}`}>
            <input
              type="checkbox"
              disabled={!luJusquEnBas}
              checked={caseCochee}
              onChange={(e) => {
                setCaseCochee(e.target.checked)
                setMessageErreur(null)
              }}
            />
            J'ai lu et j'accepte ces conditions. Je comprends que la conformité légale et fiscale de
            mon activité reste ma responsabilité.
          </label>

          {!luJusquEnBas && (
            <p className="conditions-indication">Faites défiler le texte jusqu'en bas pour continuer.</p>
          )}

          <div className="barre-boutons">
            <button onClick={accepter} disabled={!caseCochee}>
              Accepter et démarrer
            </button>
            <button className="bouton-secondaire" onClick={() => window.api.conditions.ouvrirPage()}>
              Lire sur le site
            </button>
          </div>

          {messageErreur && <p className="erreur">{messageErreur}</p>}
        </div>
      </div>
    </div>
  )
}
