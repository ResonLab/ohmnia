import { useEffect, useState } from 'react'
import type { EtatMaj } from '../../../shared/types'
import { t } from '../../../shared/i18n'

interface Props {
  /** Ouvre l'écran où l'on télécharge et installe la nouvelle version. */
  onOuvrirReglages: () => void
}

/**
 * La version installée, et le moyen de vérifier qu'elle est la dernière.
 *
 * **Pourquoi ce bloc existe.** L'application savait se mettre à jour, mais
 * seulement depuis un réglage enfoui, et un dépôt à renseigner à la main : en
 * pratique personne ne trouvait comment faire, et la seule voie restait de
 * retélécharger l'installeur sur GitHub. Ici, la version et le bouton sont
 * toujours sous les yeux. **Rien ne part sur le réseau tant qu'on ne clique pas.**
 */
export default function PiedMiseAJour({ onOuvrirReglages }: Props): React.JSX.Element {
  const [etat, setEtat] = useState<EtatMaj | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    window.api.maj.etat().then(setEtat)
    return window.api.maj.surChangement(setEtat)
  }, [])

  async function verifier(): Promise<void> {
    setMessage(null)
    try {
      await window.api.maj.verifier()
    } catch (erreur) {
      const brut = erreur instanceof Error ? erreur.message : ''
      setMessage(brut.replace(/^Error invoking remote method '[^']*': (Error: )?/, ''))
    }
  }

  const enCours = etat?.statut === 'verification'

  return (
    <div className="menu-version">
      <span>{t('maj.version', { version: etat?.versionActuelle ?? '' })}</span>

      {etat?.statut === 'disponible' || etat?.statut === 'telechargement' || etat?.statut === 'telechargee' ? (
        <button onClick={onOuvrirReglages}>
          {t('maj.disponible', { version: etat.versionDisponible ?? '' })}
        </button>
      ) : (
        <button className="discret" onClick={verifier} disabled={enCours}>
          {enCours ? t('maj.verification') : t('maj.verifier')}
        </button>
      )}

      {etat?.statut === 'aJour' && <span className="discret">{t('maj.aJour')}</span>}
      {(message || etat?.statut === 'erreur') && (
        <span className="erreur">{message ?? etat?.message}</span>
      )}
    </div>
  )
}
