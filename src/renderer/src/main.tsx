import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ImpressionDocument from './pages/ImpressionDocument'
import './styles.css'

/**
 * Après une boîte de dialogue native, la saisie ne repart pas toujours sous
 * Windows (voir `main/ipc/fenetre.ts`). On enveloppe `confirm` et `alert` une
 * fois pour toutes, plutôt que de s'en souvenir à chacun des appels.
 */
function redonnerLeClavier(): void {
  void window.api.fenetre.refocaliser()
}
const confirmNatif = window.confirm.bind(window)
window.confirm = (message?: string): boolean => {
  const reponse = confirmNatif(message)
  redonnerLeClavier()
  return reponse
}
const alertNatif = window.alert.bind(window)
window.alert = (message?: unknown): void => {
  alertNatif(message)
  redonnerLeClavier()
}

const estVueImpression = window.location.hash.startsWith('#imprimer')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{estVueImpression ? <ImpressionDocument /> : <App />}</React.StrictMode>
)
