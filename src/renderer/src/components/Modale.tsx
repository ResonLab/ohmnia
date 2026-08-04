import { useEffect } from 'react'

interface Props {
  titre: string
  children: React.ReactNode
  onFermer: () => void
  onValider?: () => void
  libelleValider?: string
}

/**
 * Fenêtre modale interne.
 * Electron ne supporte pas window.prompt(), donc toute saisie ponctuelle
 * (frais de rappel, etc.) passe par ce composant.
 */
export default function Modale({
  titre,
  children,
  onFermer,
  onValider,
  libelleValider = 'Valider'
}: Props): React.JSX.Element {
  // Échap ferme la modale, comme attendu d'une boîte de dialogue.
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent): void => {
      if (evenement.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [onFermer])

  return (
    <div className="modale-fond" onClick={onFermer}>
      <div className="modale" onClick={(e) => e.stopPropagation()}>
        <h2>{titre}</h2>
        <div className="modale-contenu">{children}</div>
        <div className="barre-boutons">
          {onValider && <button onClick={onValider}>{libelleValider}</button>}
          <button className="bouton-secondaire" onClick={onFermer}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
