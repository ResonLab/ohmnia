import { useEffect, useState } from 'react'
import type { EtatMultipostes } from '../../../shared/types'

/**
 * Réglage du mode multi-postes, dans « Paramètres de l'app ».
 *
 * **Le mode local est le défaut et le reste** : c'est un principe de la maison.
 * Cet écran ne fait que proposer l'autre mode, jamais l'imposer, et dit
 * clairement ce que le changement implique.
 */
export default function ReglageMultipostes(): React.JSX.Element {
  const [etat, setEtat] = useState<EtatMultipostes | null>(null)
  const [adresse, setAdresse] = useState('')
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    window.api.multipostes.etat().then((e) => {
      setEtat(e)
      setAdresse(e.adresse)
    })
  }, [])

  if (!etat) return <div className="carte" />

  async function tester(): Promise<void> {
    setErreur('')
    setMessage('')
    setOccupe(true)
    try {
      const reponse = await window.api.multipostes.tester(adresse)
      setMessage(
        reponse.installe
          ? 'Serveur joignable, des comptes y existent déjà.'
          : 'Serveur joignable, mais aucun compte : vous créerez le premier administrateur en vous connectant.'
      )
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }

  async function basculer(mode: 'local' | 'serveur'): Promise<void> {
    setErreur('')
    setMessage('')
    setOccupe(true)
    try {
      await window.api.multipostes.definirMode(mode, adresse)
      // Le mode est décidé au démarrage, quand les canaux sont branchés sur la
      // base locale ou sur le serveur. Recharger évite un écran qui afficherait
      // encore les données de l'autre mode.
      window.location.reload()
    } catch (e) {
      setErreur((e as Error).message)
      setOccupe(false)
    }
  }

  const enServeur = etat.mode === 'serveur'

  return (
    <div className="carte">
      <h2>Mode multi-postes</h2>

      <p className="discret">
        Par défaut, Ohmnia travaille sur la base de <strong>cet ordinateur</strong>, hors ligne.
        Le mode multi-postes fait travailler plusieurs postes sur les mêmes données, servies par un
        serveur installé chez vous. Rien ne sort de votre réseau.
      </p>

      <p>
        Mode actuel : <strong>{enServeur ? `serveur (${etat.adresse})` : 'local'}</strong>
        {etat.session && (
          <>
            {' '}
            — connecté comme <strong>{etat.session.identifiant}</strong> ({etat.session.role})
          </>
        )}
      </p>

      <label>
        Adresse du serveur
        <input
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
          placeholder="http://192.168.1.20:8787"
          disabled={occupe}
        />
      </label>

      {message && <p className="succes">{message}</p>}
      {erreur && <p className="erreur">{erreur}</p>}

      <div className="ligne-boutons">
        <button onClick={tester} disabled={occupe || !adresse.trim()}>
          Tester la connexion
        </button>

        {enServeur ? (
          <button onClick={() => basculer('local')} disabled={occupe}>
            Revenir au mode local
          </button>
        ) : (
          <button
            className="principal"
            onClick={() => basculer('serveur')}
            disabled={occupe || !adresse.trim()}
          >
            Passer en mode multi-postes
          </button>
        )}
      </div>

      <p className="discret">
        Le changement de mode <strong>redémarre l’affichage</strong> : c’est au démarrage qu’Ohmnia
        décide s’il lit sa base locale ou celle du serveur. Vos données locales ne sont jamais
        effacées — revenir au mode local les retrouve telles quelles.
      </p>

      <p className="discret">
        En multi-postes, les sauvegardes, les justificatifs et le logo sont l’affaire du serveur :
        ces actions sont désactivées sur ce poste.
      </p>
    </div>
  )
}
