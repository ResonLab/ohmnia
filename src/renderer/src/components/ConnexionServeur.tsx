import { useEffect, useState } from 'react'
import LogoOhmnia from './LogoOhmnia'
import type { EtatMultipostes, SessionMultipostes } from '../../../shared/types'

/**
 * Écran de connexion au serveur multi-postes.
 *
 * Il s'affiche avant l'application quand ce poste est réglé en mode serveur et
 * qu'aucune session n'est ouverte — au démarrage, et de nouveau si la session
 * expire en cours de route.
 *
 * **Le retour au mode local est toujours proposé.** Si le serveur est éteint ou
 * le réseau coupé, l'utilisateur ne doit pas se retrouver enfermé devant un
 * écran de connexion sans issue : il peut repasser sur sa base locale.
 */
export default function ConnexionServeur({
  etat,
  onConnecte,
  onRetourLocal
}: {
  etat: EtatMultipostes
  onConnecte: (session: SessionMultipostes) => void
  onRetourLocal: () => void
}): React.JSX.Element {
  const [identifiant, setIdentifiant] = useState(etat.dernierIdentifiant)
  const [motDePasse, setMotDePasse] = useState('')
  const [nomAffiche, setNomAffiche] = useState('')
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  // null : on ne sait pas encore si le serveur a déjà un compte.
  const [installe, setInstalle] = useState<boolean | null>(null)

  // Savoir si le serveur est neuf décide de ce qu'on propose : une connexion,
  // ou la création du tout premier administrateur.
  useEffect(() => {
    window.api.multipostes
      .tester(etat.adresse)
      .then((reponse) => setInstalle(reponse.installe))
      .catch((e: Error) => {
        setErreur(e.message)
        setInstalle(null)
      })
  }, [etat.adresse])

  const premiereInstallation = installe === false

  async function valider(evenement: React.FormEvent): Promise<void> {
    evenement.preventDefault()
    setErreur('')
    setOccupe(true)
    try {
      const session = premiereInstallation
        ? await window.api.multipostes.creerPremierAdministrateur(
            identifiant,
            motDePasse,
            nomAffiche
          )
        : await window.api.multipostes.connecter(identifiant, motDePasse)
      onConnecte(session)
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setOccupe(false)
      setMotDePasse('')
    }
  }

  return (
    <div className="app app-connexion">
      <form className="carte carte-connexion" onSubmit={valider}>
        <div className="connexion-entete">
          <LogoOhmnia taille={48} />
          <div>
            <h1>Ohmnia — mode multi-postes</h1>
            <p className="discret">{etat.adresse}</p>
          </div>
        </div>

        {premiereInstallation && (
          <p className="encadre-info">
            Ce serveur est neuf : aucun compte n’existe encore. Le compte que vous créez ici sera
            <strong> administrateur</strong> et pourra ensuite créer ceux de vos collègues.
          </p>
        )}

        <label>
          Identifiant
          <input
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </label>

        {premiereInstallation && (
          <label>
            Nom affiché (facultatif)
            <input value={nomAffiche} onChange={(e) => setNomAffiche(e.target.value)} />
          </label>
        )}

        <label>
          Mot de passe
          <input
            type="password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {premiereInstallation && (
          <p className="discret">Au moins 10 caractères, avec une lettre et un chiffre.</p>
        )}

        {erreur && <p className="erreur">{erreur}</p>}

        <div className="connexion-actions">
          <button type="submit" className="principal" disabled={occupe}>
            {occupe
              ? 'Connexion…'
              : premiereInstallation
                ? 'Créer le compte administrateur'
                : 'Se connecter'}
          </button>
          <button type="button" onClick={onRetourLocal} disabled={occupe}>
            Revenir au mode local
          </button>
        </div>

        <p className="discret">
          Le mot de passe n’est jamais enregistré sur ce poste : il est redemandé à chaque
          ouverture.
        </p>
      </form>
    </div>
  )
}
