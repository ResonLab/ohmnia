import { useEffect, useState } from 'react'
import type { EtatMultipostes } from '../../../shared/types'
import { t } from '../../../shared/i18n'

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
          ? t('multi.joignableAvecComptes')
          : t('multi.joignableSansCompte')
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
      <h2>{t('multi.titre')}</h2>

      <p className="discret">
        {t('multi.presentation', { cet: t('multi.cetOrdinateur') })}
      </p>

      <p>
        {t('multi.modeActuel')}{' '}
        <strong>
          {enServeur ? t('multi.serveurAdresse', { adresse: etat.adresse }) : t('multi.local')}
        </strong>
        {etat.session && (
          <>
            {' '}
            — {t('multi.connecteComme')} <strong>{etat.session.identifiant}</strong>{' '}
            ({etat.session.role})
          </>
        )}
      </p>

      <label>
        {t('multi.adresseServeur')}
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
          {t('multi.testerConnexion')}
        </button>

        {enServeur ? (
          <button onClick={() => basculer('local')} disabled={occupe}>
            {t('multi.revenirLocal')}
          </button>
        ) : (
          <button
            className="principal"
            onClick={() => basculer('serveur')}
            disabled={occupe || !adresse.trim()}
          >
            {t('multi.passerServeur')}
          </button>
        )}
      </div>

      <p className="discret">
        {t('multi.redemarrage', { redemarre: t('multi.redemarreAffichage') })}
      </p>

      <p className="discret">
        {t('multi.sauvegardesServeur')}
      </p>

      <p className="discret">
        {t('multi.affichagePropre')}
      </p>

      <p className="discret">
        <strong>{t('multi.chiffrementObligatoire')}</strong>
        {t('multi.chiffrementSuite')}
      </p>
    </div>
  )
}
