import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ImpressionDocument from './pages/ImpressionDocument'
import './styles.css'

const estVueImpression = window.location.hash.startsWith('#imprimer')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{estVueImpression ? <ImpressionDocument /> : <App />}</React.StrictMode>
)
