import { useEffect, useState } from 'react'
import type {
  CategorieJournal,
  ConfigurationMaj,
  EtatConditions,
  EtatMaj,
  InfosSysteme,
  ParametresApp as ParametresAppType,
  SauvegardeFichier,
  Theme
} from '../../../shared/types'
import { appliquerTheme } from '../lib/theme'
import { definirLangue, LANGUES, locale, t, type Langue } from '../../../shared/i18n'
import { CONDITIONS_UTILISATION } from '../../../shared/conditions'
import ReglageMultipostes from '../components/ReglageMultipostes'
import Modale from '../components/Modale'

const COULEURS_PROPOSEES = ['#1be7b6', '#5b9cf8', '#c084fc', '#fbbf24', '#fb7185', '#34d399']

function formaterTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(2)} Mo`
}

function formaterDate(dateIso: string): string {
  const d = new Date(dateIso)
  return d.toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' })
}

interface Props {
  onThemeChange: (theme: Theme, couleurAccent: string) => void
  onLangueChange: (langue: Langue) => void
}

export default function ParametresApp({ onThemeChange, onLangueChange }: Props): React.JSX.Element {
  const [params, setParams] = useState<ParametresAppType | null>(null)
  const [infos, setInfos] = useState<InfosSysteme | null>(null)
  const [sauvegardes, setSauvegardes] = useState<SauvegardeFichier[]>([])
  const [categories, setCategories] = useState<CategorieJournal[]>([])
  const [nouvelleCategorie, setNouvelleCategorie] = useState('')
  const [dossierExterne, setDossierExterne] = useState<string | null>(null)
  const [motDePasseExterne, setMotDePasseExterne] = useState('')
  const [configMaj, setConfigMaj] = useState<ConfigurationMaj>({
    source: 'github',
    depot: '',
    url: null,
    auto: false
  })
  const [etatMaj, setEtatMaj] = useState<EtatMaj | null>(null)
  const [etatConditions, setEtatConditions] = useState<EtatConditions | null>(null)
  const [conditionsOuvertes, setConditionsOuvertes] = useState(false)
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)

  async function rechargerTout(): Promise<void> {
    const [p, i, s, c, dossier] = await Promise.all([
      window.api.parametresApp.lire(),
      window.api.parametresApp.infosSysteme(),
      window.api.sauvegardes.lister(),
      window.api.categoriesJournal.lister(),
      window.api.sauvegardeExterne.lireDossier()
    ])
    setParams(p)
    setInfos(i)
    setSauvegardes(s)
    setCategories(c)
    setDossierExterne(dossier)
  }

  useEffect(() => {
    rechargerTout().finally(() => setChargement(false))
  }, [])

  // État des mises à jour : lecture initiale puis suivi des événements du main process.
  useEffect(() => {
    window.api.maj.lireConfiguration().then(setConfigMaj)
    window.api.conditions.etat().then(setEtatConditions)
    window.api.maj.etat().then(setEtatMaj)
    return window.api.maj.surChangement(setEtatMaj)
  }, [])

  function afficherErreur(erreur: unknown): void {
    setMessageSucces(null)
    setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
  }

  function afficherSucces(message: string): void {
    setMessageErreur(null)
    setMessageSucces(message)
    setTimeout(() => setMessageSucces(null), 4000)
  }

  /**
   * La langue s'applique immédiatement à l'interface et est enregistrée aussitôt :
   * un changement de langue non conservé serait déroutant.
   */
  async function changerLangue(nouvelleLangue: Langue): Promise<void> {
    if (!params) return
    const misAJour = { ...params, langue: nouvelleLangue }
    setParams(misAJour)
    definirLangue(nouvelleLangue)
    try {
      await window.api.parametresApp.enregistrer(misAJour)
      onLangueChange(nouvelleLangue)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  /** Applique immédiatement l'apparence pour un aperçu direct, sans attendre l'enregistrement. */
  function modifierApparence(champs: Partial<ParametresAppType>): void {
    if (!params) return
    const misAJour = { ...params, ...champs }
    setParams(misAJour)
    appliquerTheme(misAJour.theme, misAJour.couleurAccent)
  }

  async function enregistrer(): Promise<void> {
    if (!params) return
    try {
      const misAJour = await window.api.parametresApp.enregistrer(params)
      setParams(misAJour)
      onThemeChange(misAJour.theme, misAJour.couleurAccent)
      await rechargerTout()
      afficherSucces(t('papp.enregistres'))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function choisirDossier(): Promise<void> {
    try {
      const dossier = await window.api.parametresApp.choisirDossierDocuments()
      if (!dossier) return
      await rechargerTout()
      afficherSucces(t('papp.pdfRangesDans', { dossier }))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function reinitialiserDossier(): Promise<void> {
    const chemin = await window.api.parametresApp.reinitialiserDossierDocuments()
    await rechargerTout()
    afficherSucces(t('papp.dossierRetabli', { chemin }))
  }

  async function sauvegarderMaintenant(): Promise<void> {
    try {
      const chemin = await window.api.sauvegardes.creer()
      await rechargerTout()
      afficherSucces(t('papp.sauvegardeCreee', { chemin }))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function restaurer(nom: string): Promise<void> {
    const confirme = window.confirm(t('papp.confirmerRestauration', { nom }))
    if (!confirme) return
    try {
      await window.api.sauvegardes.restaurer(nom)
      await rechargerTout()
      afficherSucces(t('papp.sauvegardeRestauree'))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function choisirDossierExterne(): Promise<void> {
    try {
      const dossier = await window.api.sauvegardeExterne.choisirDossier()
      if (!dossier) return
      setDossierExterne(dossier)
      afficherSucces(t('papp.dossierExterneDefini', { dossier }))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function sauvegarderExterne(): Promise<void> {
    try {
      const chemin = await window.api.sauvegardeExterne.sauvegarder(motDePasseExterne)
      afficherSucces(t('papp.sauvegardeChiffreeCreee', { chemin }))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function restaurerExterne(): Promise<void> {
    const confirme = window.confirm(t('papp.confirmerRestaurationChiffree'))
    if (!confirme) return

    try {
      const chemin = await window.api.sauvegardeExterne.restaurer(motDePasseExterne)
      if (!chemin) return
      await rechargerTout()
      afficherSucces(
        t('papp.restaureeDepuis', { chemin })
      )
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function enregistrerConfigurationMaj(): Promise<void> {
    try {
      const config = await window.api.maj.enregistrerConfiguration(configMaj)
      setConfigMaj(config)
      const source = config.source === 'github' ? config.depot : config.url
      afficherSucces(
        source ? t('papp.sourceEnregistree', { source }) : t('papp.majDesactivees')
      )
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function verifierMaj(): Promise<void> {
    try {
      await window.api.maj.verifier()
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function telechargerMaj(): Promise<void> {
    try {
      await window.api.maj.telecharger()
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function installerMaj(): Promise<void> {
    if (!window.confirm(t('papp.confirmerInstallation'))) return
    try {
      await window.api.maj.installer()
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function verifierIntegrite(): Promise<void> {
    try {
      const resultat = await window.api.parametresApp.verifierIntegrite()
      if (resultat === 'ok') {
        afficherSucces(t('papp.baseSaine'))
      } else {
        setMessageSucces(null)
        setMessageErreur(t('papp.anomalie', { detail: resultat }))
      }
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function exporterTout(): Promise<void> {
    try {
      const chemin = await window.api.donnees.exporterTout()
      if (chemin) afficherSucces(t('compta.exportTermine', { chemin }))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function ajouterCategorie(): Promise<void> {
    try {
      await window.api.categoriesJournal.ajouter(nouvelleCategorie)
      setNouvelleCategorie('')
      await rechargerTout()
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function renommerCategorie(id: number, libelle: string): Promise<void> {
    setCategories((precedent) => precedent.map((c) => (c.id === id ? { ...c, libelle } : c)))
    try {
      await window.api.categoriesJournal.renommer(id, libelle)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function supprimerCategorie(id: number): Promise<void> {
    try {
      await window.api.categoriesJournal.supprimer(id)
      await rechargerTout()
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  if (chargement || !params || !infos) return <p>{t('etat.chargement')}</p>

  return (
    <div className="pile-cartes">
      <ReglageMultipostes />

      <div className="carte">
        <h2>{t('param.apparence')}</h2>
        <label>
          {t('param.langue')}
          <select value={params.langue} onChange={(e) => changerLangue(e.target.value as Langue)}>
            {LANGUES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nom}
              </option>
            ))}
          </select>
        </label>
        <p className="valeur-calculee">{t('param.langueAide')}</p>

        <div className="ligne-formulaire">
          <label>
            {t('param.theme')}
            <select value={params.theme} onChange={(e) => modifierApparence({ theme: e.target.value as Theme })}>
              <option value="sombre">{t('papp.themeSombre')}</option>
              <option value="clair">{t('papp.themeClair')}</option>
              <option value="auto">{t('papp.themeAuto')}</option>
            </select>
          </label>
          <label>
            {t('papp.couleurAccent')}
            <input
              type="color"
              value={params.couleurAccent}
              onChange={(e) => modifierApparence({ couleurAccent: e.target.value })}
            />
          </label>
        </div>
        <div className="palette-couleurs">
          {COULEURS_PROPOSEES.map((couleur) => (
            <button
              key={couleur}
              type="button"
              className={`pastille-couleur ${params.couleurAccent === couleur ? 'actif' : ''}`}
              style={{ background: couleur }}
              title={couleur}
              onClick={() => modifierApparence({ couleurAccent: couleur })}
            />
          ))}
        </div>
        <p className="valeur-calculee">
          {t('papp.apercuImmediat', { bouton: t('action.enregistrer') })}
        </p>
      </div>

      <div className="carte">
        <h2>{t('papp.dossiers')}</h2>
        <label>
          {t('papp.dossierPdf')}
          <input readOnly value={infos.dossierDocumentsEffectif} />
        </label>
        <div className="barre-boutons">
          <button onClick={choisirDossier}>{t('papp.changerDossier')}</button>
          <button className="bouton-secondaire" onClick={reinitialiserDossier}>
            {t('papp.remettreDefaut')}
          </button>
          <button className="bouton-secondaire" onClick={() => window.api.parametresApp.ouvrirDossier('documents')}>
            {t('papp.ouvrir')}
          </button>
        </div>

        <label style={{ marginTop: '1.4rem' }}>
          {t('papp.dossierDonnees')}
          <input readOnly value={infos.dossierDonnees} />
        </label>
        <div className="barre-boutons">
          <button className="bouton-secondaire" onClick={() => window.api.parametresApp.ouvrirDossier('donnees')}>
            {t('papp.ouvrirDossierDonnees')}
          </button>
          <button className="bouton-secondaire" onClick={() => window.api.parametresApp.ouvrirDossier('sauvegardes')}>
            {t('papp.ouvrirSauvegardes')}
          </button>
        </div>
      </div>

      <div className="carte">
        <h2>{t('papp.sauvegardes')}</h2>
        <label>
          {t('papp.nombreConservees')}
          <input
            type="number"
            min="1"
            max="500"
            value={params.nbSauvegardes}
            onChange={(e) => setParams({ ...params, nbSauvegardes: Number(e.target.value) })}
          />
        </label>
        <p className="valeur-calculee">
          {t('papp.sauvegardeAuto')}{' '}
          {t('papp.nbSauvegardes', { nombre: infos.nbSauvegardes })}
        </p>
        <div className="barre-boutons">
          <button onClick={sauvegarderMaintenant}>{t('papp.sauvegarderMaintenant')}</button>
        </div>

        {sauvegardes.length > 0 && (
          <table className="table-editable" style={{ marginTop: '1.2rem' }}>
            <thead>
              <tr>
                <th>{t('colonne.date')}</th>
                <th>{t('papp.taille')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sauvegardes.slice(0, 12).map((s) => (
                <tr key={s.nom}>
                  <td>{formaterDate(s.dateIso)}</td>
                  <td>{formaterTaille(s.tailleOctets)}</td>
                  <td>
                    <button onClick={() => restaurer(s.nom)}>{t('papp.restaurer')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="carte">
        <h2>{t('papp.sauvegardeExterne')}</h2>
        <p className="valeur-calculee">
          {t('papp.sauvegardeExterneAide')}
        </p>
        <label>
          {t('papp.dossierExterne')}
          <input readOnly value={dossierExterne ?? 'Aucun dossier choisi'} />
        </label>
        <div className="barre-boutons">
          <button onClick={choisirDossierExterne}>{t('papp.choisirDossier')}</button>
        </div>

        <label style={{ marginTop: '1.2rem' }}>
          {t('papp.motDePasse')}
          <input
            type="password"
            autoComplete="new-password"
            value={motDePasseExterne}
            onChange={(e) => setMotDePasseExterne(e.target.value)}
          />
        </label>
        <p className="valeur-calculee texte-alerte">
          {t('papp.avertissementMotDePasse')}
        </p>
        <div className="barre-boutons">
          <button onClick={sauvegarderExterne}>{t('papp.sauvegarderChiffre')}</button>
          <button className="bouton-secondaire" onClick={restaurerExterne}>
            {t('papp.restaurerChiffre')}
          </button>
        </div>
      </div>

      <div className="carte">
        <h2>{t('papp.valeursDefaut')}</h2>
        <div className="ligne-formulaire">
          <label>
            {t('papp.delaiFactures')}
            <input
              type="number"
              min="0"
              max="365"
              value={params.delaiPaiementDefaut}
              onChange={(e) => setParams({ ...params, delaiPaiementDefaut: Number(e.target.value) })}
            />
          </label>
          <label>
            {t('papp.validiteDevis')}
            <input
              type="number"
              min="0"
              max="365"
              value={params.validiteDevisDefaut}
              onChange={(e) => setParams({ ...params, validiteDevisDefaut: Number(e.target.value) })}
            />
          </label>
          <label>
            {t('papp.alerteFacture')}
            <input
              type="number"
              min="1"
              max="365"
              value={params.seuilAlerteFactureJours}
              onChange={(e) => setParams({ ...params, seuilAlerteFactureJours: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>

      <div className="carte">
        <h2>{t('papp.categoriesJournal')}</h2>
        <table className="table-editable">
          <thead>
            <tr>
              <th>{t('charge.libelle')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>
                  <input value={c.libelle} onChange={(e) => renommerCategorie(c.id, e.target.value)} />
                </td>
                <td>
                  <button className="bouton-danger" onClick={() => supprimerCategorie(c.id)}>
                    {t('action.supprimer')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="client-ajout-rapide">
          <input
            placeholder={t('papp.nouvelleCategorie')}
            value={nouvelleCategorie}
            onChange={(e) => setNouvelleCategorie(e.target.value)}
          />
          <button onClick={ajouterCategorie}>{t('papp.ajouter')}</button>
        </div>
      </div>

      <div className="carte">
        <h2>{t('papp.misesAJour')}</h2>
        <p className="valeur-calculee">
          {t('papp.majAide')}
        </p>
        <label>
          {t('papp.sourceMaj')}
          <select
            value={configMaj.source}
            onChange={(e) =>
              setConfigMaj({ ...configMaj, source: e.target.value as ConfigurationMaj['source'] })
            }
          >
            <option value="github">{t('papp.sourceGithub')}</option>
            <option value="url">{t('papp.sourceUrl')}</option>
          </select>
        </label>

        {configMaj.source === 'github' ? (
          <>
            <label>
              {t('papp.depotGithub')}
              <input
                placeholder={t('papp.depotExemple')}
                value={configMaj.depot}
                onChange={(e) => setConfigMaj({ ...configMaj, depot: e.target.value })}
              />
            </label>
            <p className="valeur-calculee">
              {t('papp.depotAide', { release: 'release' })}
            </p>
          </>
        ) : (
          <label>
            {t('papp.adressePublication')}
            <input
              placeholder={t('papp.adresseExemple')}
              value={configMaj.url ?? ''}
              onChange={(e) => setConfigMaj({ ...configMaj, url: e.target.value })}
            />
          </label>
        )}

        <label className="case-a-cocher">
          <input
            type="checkbox"
            checked={configMaj.auto}
            onChange={(e) => setConfigMaj({ ...configMaj, auto: e.target.checked })}
          />
          {t('papp.verifierDemarrage')}
        </label>
        <div className="barre-boutons">
          <button onClick={enregistrerConfigurationMaj}>{t('papp.enregistrerAdresse')}</button>
          <button className="bouton-secondaire" onClick={verifierMaj}>
            {t('papp.verifierMaintenant')}
          </button>
        </div>

        <div className="resultats-calcules">
          <p>
            {t('papp.versionInstallee')}{' '}
            <strong>{etatMaj?.versionActuelle ?? infos.version}</strong>
          </p>
          {etatMaj?.statut === 'verification' && <p>{t('papp.verificationEnCours')}</p>}
          {etatMaj?.statut === 'aJour' && <p>{t('papp.aJour')}</p>}
          {etatMaj?.statut === 'disponible' && (
            <>
              <p>
                {t('papp.nouvelleVersion')} <strong>{etatMaj.versionDisponible}</strong>
              </p>
              <div className="barre-boutons">
                <button onClick={telechargerMaj}>{t('papp.telecharger')}</button>
              </div>
            </>
          )}
          {etatMaj?.statut === 'telechargement' && (
            <>
              <p>{t('papp.telechargement', { pct: etatMaj.pourcentage ?? 0 })}</p>
              <div className="barre-progression">
                <div
                  className="barre-progression-remplissage"
                  style={{ width: `${etatMaj.pourcentage ?? 0}%` }}
                />
              </div>
            </>
          )}
          {etatMaj?.statut === 'telechargee' && (
            <>
              <p>
                <strong>{etatMaj.versionDisponible}</strong> {t('papp.prete')}
              </p>
              <div className="barre-boutons">
                <button onClick={installerMaj}>{t('papp.installerRedemarrer')}</button>
              </div>
            </>
          )}
          {etatMaj?.statut === 'erreur' && <p className="texte-alerte">{etatMaj.message}</p>}
        </div>
      </div>

      <div className="carte">
        <h2>{t('papp.infosTitre')}</h2>
        <table className="table-infos">
          <tbody>
            <tr>
              <th>{t('papp.versionOhmnia')}</th>
              <td>{infos.version}</td>
            </tr>
            <tr>
              <th>{t('papp.electronNode')}</th>
              <td>
                {infos.versionElectron} / {infos.versionNode}
              </td>
            </tr>
            <tr>
              <th>{t('papp.baseDeDonnees')}</th>
              <td>
                {infos.cheminBase} ({formaterTaille(infos.tailleBaseOctets)})
              </td>
            </tr>
          </tbody>
        </table>
        <div className="barre-boutons">
          <button onClick={verifierIntegrite}>{t('papp.verifierIntegrite')}</button>
          <button className="bouton-secondaire" onClick={exporterTout}>
            {t('papp.exporterTout')}
          </button>
        </div>
      </div>

      <div className="carte">
        <h2>{t('papp.conditionsTitre')}</h2>
        <p className="valeur-calculee">
          {t('papp.conditionsAide')}
        </p>
        {etatConditions && (
          <table className="table-infos">
            <tbody>
              <tr>
                <th>{t('papp.versionAcceptee')}</th>
                <td>
                  {etatConditions.versionAcceptee || '—'}
                  {etatConditions.versionAcceptee &&
                    etatConditions.versionAcceptee !== etatConditions.versionCourante &&
                    t('papp.versionActuelle', { version: etatConditions.versionCourante })}
                </td>
              </tr>
              <tr>
                <th>{t('papp.accepteesLe')}</th>
                <td>{etatConditions.accepteeLe || '—'}</td>
              </tr>
            </tbody>
          </table>
        )}
        <div className="barre-boutons">
          <button onClick={() => setConditionsOuvertes(true)}>{t('papp.relireConditions')}</button>
          <button className="bouton-secondaire" onClick={() => window.api.conditions.ouvrirPage()}>
            {t('papp.ouvrirPageEnLigne')}
          </button>
        </div>
      </div>

      {conditionsOuvertes && (
        <Modale titre="Conditions d'utilisation" onFermer={() => setConditionsOuvertes(false)}>
          <div className="conditions-texte conditions-texte-modale">
            {CONDITIONS_UTILISATION.map((section) => (
              <section key={section.titre}>
                <h2>{section.titre}</h2>
                {section.paragraphes.map((paragraphe, index) => (
                  <p key={index}>{paragraphe}</p>
                ))}
              </section>
            ))}
          </div>
        </Modale>
      )}

      <div className="carte">
        <div className="barre-boutons" style={{ marginTop: 0 }}>
          <button onClick={enregistrer}>{t('papp.enregistrerParametres')}</button>
        </div>
        {messageErreur && <p className="erreur">{messageErreur}</p>}
        {messageSucces && <p className="succes">{messageSucces}</p>}
      </div>
    </div>
  )
}
