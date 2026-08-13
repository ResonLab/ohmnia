import { useEffect, useState } from 'react'
import type { Client } from '../../../shared/types'
import { t } from '../../../shared/i18n'

interface Props {
  clientId: number | null
  onChange: (clientId: number) => void
}

export default function ClientSelecteur({ clientId, onChange }: Props): React.JSX.Element {
  const [clients, setClients] = useState<Client[]>([])
  const [modeAjout, setModeAjout] = useState(false)
  const [nouveauNom, setNouveauNom] = useState('')
  const [nouvelleAdresse, setNouvelleAdresse] = useState('')
  const [nouvelEmail, setNouvelEmail] = useState('')
  const [nouveauTelephone, setNouveauTelephone] = useState('')
  const [messageErreur, setMessageErreur] = useState<string | null>(null)

  useEffect(() => {
    window.api.clients.lister().then(setClients)
  }, [])

  async function ajouterClient(): Promise<void> {
    setMessageErreur(null)
    try {
      const client = await window.api.clients.ajouter({
        nom: nouveauNom,
        adresse: nouvelleAdresse,
        email: nouvelEmail,
        telephone: nouveauTelephone
      })
      setClients((precedent) => [...precedent, client])
      onChange(client.id)
      setModeAjout(false)
      setNouveauNom('')
      setNouvelleAdresse('')
      setNouvelEmail('')
      setNouveauTelephone('')
    } catch (erreur) {
      setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
    }
  }

  if (modeAjout) {
    return (
      <div className="client-ajout-rapide">
        <input placeholder="Nom du client" value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} />
        <input
          placeholder="Adresse"
          value={nouvelleAdresse}
          onChange={(e) => setNouvelleAdresse(e.target.value)}
        />
        <input placeholder="Email" value={nouvelEmail} onChange={(e) => setNouvelEmail(e.target.value)} />
        <input
          placeholder={t('client.telephone')}
          value={nouveauTelephone}
          onChange={(e) => setNouveauTelephone(e.target.value)}
        />
        <button onClick={ajouterClient}>{t('selecteur.ajouter')}</button>
        <button className="bouton-secondaire" onClick={() => setModeAjout(false)}>
          Annuler
        </button>
        {messageErreur && <p className="erreur">{messageErreur}</p>}
      </div>
    )
  }

  return (
    <div className="client-selecteur">
      <select value={clientId ?? ''} onChange={(e) => onChange(Number(e.target.value))}>
        <option value="">{t('selecteur.choisirClient')}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nom}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => setModeAjout(true)}>
        + Nouveau client
      </button>
    </div>
  )
}
