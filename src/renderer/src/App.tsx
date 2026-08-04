import { useCallback, useEffect, useState } from 'react'
import LogoOhmnia from './components/LogoOhmnia'
import RechercheGlobale from './components/RechercheGlobale'
import ConditionsUtilisation from './components/ConditionsUtilisation'
import ParametresAppPage from './pages/ParametresApp'
import { appliquerTheme } from './lib/theme'
import { definirPaysCourant } from './lib/devise'
import { definirLangue, t, type Langue } from '../../shared/i18n'
import type { Theme } from '../../shared/types'
import Accueil from './pages/Accueil'
import AjoutRapide from './pages/AjoutRapide'
import Parametres from './pages/Parametres'
import Tarifs from './pages/Tarifs'
import ChargesMarge from './pages/ChargesMarge'
import Journal from './pages/Journal'
import Clients from './pages/Clients'
import Facturation from './pages/Facturation'
import DevisPage from './pages/DevisPage'
import Inventaire from './pages/Inventaire'
import Modeles from './pages/Modeles'
import SuiviTemps from './pages/SuiviTemps'
import Comptabilite from './pages/Comptabilite'
import Audit from './pages/Audit'
import ResumeAnnuelPage from './pages/ResumeAnnuelPage'

const MODULES = [
  { id: 'accueil', cle: 'menu.accueil', icone: '🏠' },
  { id: 'ajoutRapide', cle: 'menu.ajoutRapide', icone: '⚡' },
  { id: 'clients', cle: 'menu.clients', icone: '👤' },
  { id: 'facturation', cle: 'menu.facturation', icone: '🧾' },
  { id: 'devis', cle: 'menu.devis', icone: '📄' },
  { id: 'suiviTemps', cle: 'menu.suiviTemps', icone: '⏱️' },
  { id: 'journal', cle: 'menu.journal', icone: '📊' },
  { id: 'inventaire', cle: 'menu.inventaire', icone: '📦' },
  { id: 'modeles', cle: 'menu.modeles', icone: '🧩' },
  { id: 'tarifs', cle: 'menu.tarifs', icone: '🏷️' },
  { id: 'charges', cle: 'menu.charges', icone: '⚙️' },
  { id: 'resume', cle: 'menu.resume', icone: '📈' },
  { id: 'comptabilite', cle: 'menu.comptabilite', icone: '🔄' },
  { id: 'audit', cle: 'menu.audit', icone: '🔒' },
  { id: 'parametres', cle: 'menu.parametres', icone: '🏢' },
  { id: 'parametresApp', cle: 'menu.parametresApp', icone: '🔧' }
] as const

type ModuleId = (typeof MODULES)[number]['id']

export default function App(): React.JSX.Element {
  const [moduleActif, setModuleActif] = useState<ModuleId>('accueil')
  const [theme, setTheme] = useState<Theme>('sombre')
  const [couleurAccent, setCouleurAccent] = useState('#1be7b6')
  const [rechercheOuverte, setRechercheOuverte] = useState(false)
  // null tant qu'on ne sait pas encore : évite d'afficher l'app puis de la masquer.
  const [conditionsAAccepter, setConditionsAAccepter] = useState<boolean | null>(null)
  // Sert uniquement à forcer un nouveau rendu quand la langue change.
  const [, setLangueActive] = useState<Langue>('fr')

  // Applique l'apparence et la langue enregistrées au démarrage.
  useEffect(() => {
    window.api.parametresApp.lire().then((p) => {
      setTheme(p.theme)
      setCouleurAccent(p.couleurAccent)
      appliquerTheme(p.theme, p.couleurAccent)
      definirLangue(p.langue as Langue)
      setLangueActive(p.langue as Langue)
    })
  }, [])

  // La devise de l'interface suit le pays de l'entreprise. Elle est relue à
  // chaque changement de module pour refléter un changement de pays immédiatement.
  useEffect(() => {
    window.api.entreprise.lire().then((e) => definirPaysCourant(e.pays))
  }, [moduleActif])

  // En mode automatique, suit les changements de thème de Windows.
  useEffect(() => {
    if (theme !== 'auto') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const reagir = (): void => appliquerTheme('auto', couleurAccent)
    media.addEventListener('change', reagir)
    return () => media.removeEventListener('change', reagir)
  }, [theme, couleurAccent])

  // Les conditions d'utilisation sont vérifiées avant tout affichage de l'application.
  useEffect(() => {
    window.api.conditions
      .etat()
      .then((etat) => setConditionsAAccepter(etat.doitAccepter))
      // En cas d'échec de lecture, on n'empêche pas l'utilisateur de travailler.
      .catch(() => setConditionsAAccepter(false))
  }, [])

  // Ctrl+K (ou Cmd+K) ouvre la recherche globale depuis n'importe quel module.
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent): void => {
      if ((evenement.ctrlKey || evenement.metaKey) && evenement.key.toLowerCase() === 'k') {
        evenement.preventDefault()
        setRechercheOuverte(true)
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [])

  const surChangementTheme = useCallback((nouveauTheme: Theme, nouvelleCouleur: string) => {
    setTheme(nouveauTheme)
    setCouleurAccent(nouvelleCouleur)
    appliquerTheme(nouveauTheme, nouvelleCouleur)
  }, [])

  // Écran neutre le temps de savoir si les conditions ont déjà été acceptées.
  if (conditionsAAccepter === null) return <div className="app" />

  if (conditionsAAccepter) {
    return <ConditionsUtilisation onAccepter={() => setConditionsAAccepter(false)} />
  }

  return (
    <div className="app">
      <aside className="menu">
        <div className="menu-entete">
          <LogoOhmnia taille={36} />
          <div className="menu-titre">
            <strong>Ohmnia</strong>
            <span>{t('menu.sousTitre')}</span>
          </div>
        </div>

        <nav>
          {MODULES.map((module) => (
            <button
              key={module.id}
              className={module.id === moduleActif ? 'actif' : ''}
              onClick={() => setModuleActif(module.id)}
            >
              <span className="menu-icone">{module.icone}</span>
              {t(module.cle)}
            </button>
          ))}
        </nav>

        <p className="menu-raccourci">
          <kbd>Ctrl</kbd> + <kbd>K</kbd> {t('menu.rechercher')}
        </p>
      </aside>

      <main className="contenu">
        {moduleActif === 'accueil' && (
          <Accueil onNaviguer={(module) => setModuleActif(module as ModuleId)} />
        )}
        {moduleActif === 'ajoutRapide' && <AjoutRapide />}
        {moduleActif === 'clients' && <Clients />}
        {moduleActif === 'facturation' && <Facturation />}
        {moduleActif === 'devis' && <DevisPage />}
        {moduleActif === 'suiviTemps' && <SuiviTemps />}
        {moduleActif === 'journal' && <Journal />}
        {moduleActif === 'inventaire' && <Inventaire />}
        {moduleActif === 'modeles' && <Modeles />}
        {moduleActif === 'tarifs' && <Tarifs />}
        {moduleActif === 'charges' && <ChargesMarge />}
        {moduleActif === 'resume' && <ResumeAnnuelPage />}
        {moduleActif === 'comptabilite' && <Comptabilite />}
        {moduleActif === 'audit' && <Audit />}
        {moduleActif === 'parametres' && <Parametres />}
        {moduleActif === 'parametresApp' && (
          <ParametresAppPage
            onThemeChange={surChangementTheme}
            onLangueChange={(langue) => setLangueActive(langue)}
          />
        )}
      </main>

      {rechercheOuverte && (
        <RechercheGlobale
          onFermer={() => setRechercheOuverte(false)}
          onNaviguer={(module) => setModuleActif(module as ModuleId)}
        />
      )}
    </div>
  )
}
