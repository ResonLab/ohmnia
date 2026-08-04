import { useEffect, useRef, useState } from 'react'
import type { ResultatRecherche, TypeResultatRecherche } from '../../../shared/types'

const ICONES: Record<TypeResultatRecherche, string> = {
  client: '👤',
  facture: '🧾',
  devis: '📄',
  article: '📦',
  ecriture: '📊',
  modele: '🧩'
}

interface Props {
  onFermer: () => void
  onNaviguer: (module: string) => void
}

export default function RechercheGlobale({ onFermer, onNaviguer }: Props): React.JSX.Element {
  const [terme, setTerme] = useState('')
  const [resultats, setResultats] = useState<ResultatRecherche[]>([])
  const [indexActif, setIndexActif] = useState(0)
  const champRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    champRef.current?.focus()
  }, [])

  // La recherche est différée : on n'interroge pas la base à chaque frappe.
  useEffect(() => {
    if (terme.trim().length < 2) {
      setResultats([])
      return
    }
    const minuteur = setTimeout(() => {
      window.api.recherche.globale(terme).then((liste) => {
        setResultats(liste)
        setIndexActif(0)
      })
    }, 150)
    return () => clearTimeout(minuteur)
  }, [terme])

  function ouvrir(resultat: ResultatRecherche): void {
    onNaviguer(resultat.module)
    onFermer()
  }

  function surTouche(evenement: React.KeyboardEvent): void {
    if (evenement.key === 'Escape') {
      onFermer()
    } else if (evenement.key === 'ArrowDown') {
      evenement.preventDefault()
      setIndexActif((i) => Math.min(i + 1, resultats.length - 1))
    } else if (evenement.key === 'ArrowUp') {
      evenement.preventDefault()
      setIndexActif((i) => Math.max(i - 1, 0))
    } else if (evenement.key === 'Enter' && resultats[indexActif]) {
      ouvrir(resultats[indexActif])
    }
  }

  return (
    <div className="modale-fond palette-fond" onClick={onFermer}>
      <div className="palette" onClick={(e) => e.stopPropagation()} onKeyDown={surTouche}>
        <input
          ref={champRef}
          className="palette-champ"
          placeholder="Rechercher un client, une facture, un article…"
          value={terme}
          onChange={(e) => setTerme(e.target.value)}
        />

        {terme.trim().length < 2 ? (
          <p className="palette-aide">
            Tape au moins 2 caractères. Flèches pour naviguer, Entrée pour ouvrir, Échap pour fermer.
          </p>
        ) : resultats.length === 0 ? (
          <p className="palette-aide">Aucun résultat pour « {terme} ».</p>
        ) : (
          <ul className="palette-resultats">
            {resultats.map((resultat, index) => (
              <li key={`${resultat.type}-${index}`}>
                <button
                  className={index === indexActif ? 'actif' : ''}
                  onMouseEnter={() => setIndexActif(index)}
                  onClick={() => ouvrir(resultat)}
                >
                  <span className="palette-icone">{ICONES[resultat.type]}</span>
                  <span className="palette-textes">
                    <span className="palette-titre">{resultat.titre}</span>
                    <span className="palette-soustitre">{resultat.sousTitre}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
