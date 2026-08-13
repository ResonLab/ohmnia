import { useRef, useState } from 'react'
import LogoOhmnia from './LogoOhmnia'
import {
  CONDITIONS_UTILISATION,
  RESUME_CONDITIONS,
  VERSION_CONDITIONS
} from '../../../shared/conditions'
import { t } from '../../../shared/i18n'

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
      setMessageErreur(t('cond.cocher'))
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
            <h1>{t('cond.titre')}</h1>
            <p>{t('cond.sousTitre', { version: VERSION_CONDITIONS })}</p>
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
            {t('cond.acceptation')}
          </label>

          {!luJusquEnBas && (
            <p className="conditions-indication">{t('cond.defiler')}</p>
          )}

          {/* **Le texte accepté est le texte français, et il fait foi.**
              Un anglophone voit une interface anglaise et un texte juridique
              français : sans cette phrase, il accepte un document qu'il ne peut
              pas lire, sans savoir qu'une traduction existe ni qu'elle ne
              prévaut pas.

              La phrase est dite dans les deux langues. Un premier jet la
              réservait à l'anglais, avec une version française vide — ce que
              `tests/traductions.mjs` refuse, à juste titre : une chaîne vide
              sort à l'écran sans qu'on la voie. Et elle a sa valeur en
              français aussi, puisqu'elle dit lequel des deux textes prévaut. */}
          <p className="conditions-indication">{t('cond.texteFaitFoi')}</p>

          <div className="barre-boutons">
            <button onClick={accepter} disabled={!caseCochee}>
              {t('cond.accepter')}
            </button>
            <button className="bouton-secondaire" onClick={() => window.api.conditions.ouvrirPage()}>
              {t('cond.lireSurLeSite')}
            </button>
          </div>

          {messageErreur && <p className="erreur">{messageErreur}</p>}
        </div>
      </div>
    </div>
  )
}
