import { useCallback, useEffect, useState } from 'react'
import LogoOhmnia from './components/LogoOhmnia'
import RechercheGlobale from './components/RechercheGlobale'
import ConditionsUtilisation from './components/ConditionsUtilisation'
import ConnexionServeur from './components/ConnexionServeur'
import ParametresAppPage from './pages/ParametresApp'
import { appliquerTheme } from './lib/theme'
import { FournisseurRole } from './lib/role'
import { definirPaysCourant } from './lib/devise'
import { definirLangue, t, type Langue } from '../../shared/i18n'
import type { EtatMultipostes, RoleMultipostes, Theme } from '../../shared/types'
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
  // null tant que le mode n'est pas connu : sans cela, l'application
  // s'afficherait une fraction de seconde avant l'écran de connexion.
  const [multipostes, setMultipostes] = useState<EtatMultipostes | null>(null)

  // Le mode est lu avant tout le reste : en multi-postes non connecté, aucun
  // autre appel ne peut aboutir, ils échoueraient tous sur « session absente ».
  useEffect(() => {
    window.api.multipostes
      .etat()
      .then(setMultipostes)
      .catch(() => setMultipostes({
        mode: 'local',
        adresse: '',
        dernierIdentifiant: '',
        connecte: false,
        session: null
      }))
  }, [])

  // Session expirée en cours de travail : on repasse par l'écran de connexion.
  // L'écran en cours n'est pas détruit — se reconnecter y ramène directement.
  useEffect(() => {
    return window.api.multipostes.surSessionPerdue(() => {
      setMultipostes((precedent) =>
        precedent ? { ...precedent, connecte: false, session: null } : precedent
      )
    })
  }, [])

  const enAttenteDeConnexion =
    multipostes !== null && multipostes.mode === 'serveur' && !multipostes.connecte

  // Applique l'apparence et la langue enregistrées au démarrage.
  useEffect(() => {
    if (enAttenteDeConnexion || multipostes === null) return
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
    if (enAttenteDeConnexion || multipostes === null) return
    window.api.entreprise.lire().then((e) => definirPaysCourant(e.pays))
  }, [moduleActif, enAttenteDeConnexion, multipostes])

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
    if (enAttenteDeConnexion || multipostes === null) return
    window.api.conditions
      .etat()
      .then((etat) => setConditionsAAccepter(etat.doitAccepter))
      // En cas d'échec de lecture, on n'empêche pas l'utilisateur de travailler.
      .catch(() => setConditionsAAccepter(false))
  }, [enAttenteDeConnexion, multipostes])

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

  // Écran neutre le temps de connaître le mode, puis l'état des conditions.
  if (multipostes === null) return <div className="app" />

  if (enAttenteDeConnexion) {
    return (
      <ConnexionServeur
        etat={multipostes}
        onConnecte={(session) => setMultipostes({ ...multipostes, connecte: true, session })}
        onRetourLocal={async () => {
          await window.api.multipostes.definirMode('local', '')
          // Le mode est choisi au démarrage : sans redémarrage, les canaux
          // métier continueraient de pointer vers le serveur injoignable.
          window.location.reload()
        }}
      />
    )
  }

  if (conditionsAAccepter === null) return <div className="app" />

  if (conditionsAAccepter) {
    return <ConditionsUtilisation onAccepter={() => setConditionsAAccepter(false)} />
  }

  const role: RoleMultipostes | null = multipostes.session?.role ?? null
  const lectureSeule = role === 'lecture'

  // Un menu qui mène à un écran dont chaque bouton sera refusé n'aide personne :
  // les modules réservés à l'administration disparaissent pour les autres rôles.
  const modulesVisibles = MODULES.filter((module) => {
    if (role === null || role === 'administration') return true
    return module.id !== 'audit' && module.id !== 'parametres'
  })

  return (
    <FournisseurRole value={role}>
    {/*
      Les actions d'écriture portent une classe ; ces deux attributs décident
      si elles s'affichent. Le vrai garde-fou reste le serveur, qui refuse
      l'opération de toute façon : ici on évite seulement d'offrir un bouton
      qui ne peut qu'échouer.
    */}
    <div
      className="app"
      data-peut-ecrire={role === null || role !== 'lecture' ? 'oui' : 'non'}
      data-peut-administrer={role === null || role === 'administration' ? 'oui' : 'non'}
    >
      <aside className="menu">
        <div className="menu-entete">
          <LogoOhmnia taille={36} />
          <div className="menu-titre">
            <strong>Ohmnia</strong>
            <span>{t('menu.sousTitre')}</span>
          </div>
        </div>

        <nav>
          {modulesVisibles.map((module) => (
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

        {multipostes.session && (
          <p className="menu-session">
            <span className="pastille-serveur">Serveur</span>
            {multipostes.session.nomAffiche || multipostes.session.identifiant}
            <em>{multipostes.session.role}</em>
          </p>
        )}

        <p className="menu-raccourci">
          <kbd>Ctrl</kbd> + <kbd>K</kbd> {t('menu.rechercher')}
        </p>
      </aside>

      <main className="contenu">
        {lectureSeule && (
          <p className="bandeau-lecture-seule">
            Vous êtes connecté en <strong>lecture seule</strong> : la consultation est libre, mais
            toute modification sera refusée par le serveur.
          </p>
        )}
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
    </FournisseurRole>
  )
}
