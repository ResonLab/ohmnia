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
import { definirLangue, LANGUES, t, type Langue } from '../../../shared/i18n'
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
  return d.toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })
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
      afficherSucces('Paramètres enregistrés.')
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function choisirDossier(): Promise<void> {
    try {
      const dossier = await window.api.parametresApp.choisirDossierDocuments()
      if (!dossier) return
      await rechargerTout()
      afficherSucces(`Les PDF seront rangés dans : ${dossier}`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function reinitialiserDossier(): Promise<void> {
    const chemin = await window.api.parametresApp.reinitialiserDossierDocuments()
    await rechargerTout()
    afficherSucces(`Dossier par défaut rétabli : ${chemin}`)
  }

  async function sauvegarderMaintenant(): Promise<void> {
    try {
      const chemin = await window.api.sauvegardes.creer()
      await rechargerTout()
      afficherSucces(`Sauvegarde créée : ${chemin}`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function restaurer(nom: string): Promise<void> {
    const confirme = window.confirm(
      `Restaurer la sauvegarde « ${nom} » ?\n\n` +
        'Les données actuelles seront remplacées. Une sauvegarde de sécurité de l\'état actuel ' +
        'est créée automatiquement avant la restauration.'
    )
    if (!confirme) return
    try {
      await window.api.sauvegardes.restaurer(nom)
      await rechargerTout()
      afficherSucces('Sauvegarde restaurée. Change de module puis reviens pour voir les données reprises.')
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function choisirDossierExterne(): Promise<void> {
    try {
      const dossier = await window.api.sauvegardeExterne.choisirDossier()
      if (!dossier) return
      setDossierExterne(dossier)
      afficherSucces(`Dossier de sauvegarde externe : ${dossier}`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function sauvegarderExterne(): Promise<void> {
    try {
      const chemin = await window.api.sauvegardeExterne.sauvegarder(motDePasseExterne)
      afficherSucces(`Sauvegarde chiffrée créée : ${chemin}`)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function restaurerExterne(): Promise<void> {
    const confirme = window.confirm(
      'Restaurer depuis une sauvegarde chiffrée ?\n\n' +
        "Les données actuelles seront remplacées. Une sauvegarde locale de l'état actuel est créée " +
        'automatiquement avant la restauration.'
    )
    if (!confirme) return

    try {
      const chemin = await window.api.sauvegardeExterne.restaurer(motDePasseExterne)
      if (!chemin) return
      await rechargerTout()
      afficherSucces(
        `Sauvegarde restaurée depuis ${chemin}. Change de module puis reviens pour voir les données reprises.`
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
        source
          ? `Source des mises à jour enregistrée : ${source}`
          : 'Mises à jour désactivées : aucun accès réseau.'
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
    if (!window.confirm("Installer la mise à jour ? L'application va se fermer et redémarrer.")) return
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
        afficherSucces('Base de données saine : aucune anomalie détectée.')
      } else {
        setMessageSucces(null)
        setMessageErreur(`Anomalie détectée dans la base : ${resultat}`)
      }
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function exporterTout(): Promise<void> {
    try {
      const chemin = await window.api.donnees.exporterTout()
      if (chemin) afficherSucces(`Export terminé : ${chemin}`)
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

  if (chargement || !params || !infos) return <p>Chargement…</p>

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
              <option value="sombre">Sombre</option>
              <option value="clair">Clair</option>
              <option value="auto">Automatique (suit Windows)</option>
            </select>
          </label>
          <label>
            Couleur d'accent
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
          L'aperçu est immédiat. Clique sur <strong>Enregistrer</strong> en bas pour le conserver.
        </p>
      </div>

      <div className="carte">
        <h2>Dossiers</h2>
        <label>
          Dossier des PDF (Factures / Devis)
          <input readOnly value={infos.dossierDocumentsEffectif} />
        </label>
        <div className="barre-boutons">
          <button onClick={choisirDossier}>Changer de dossier…</button>
          <button className="bouton-secondaire" onClick={reinitialiserDossier}>
            Remettre par défaut
          </button>
          <button className="bouton-secondaire" onClick={() => window.api.parametresApp.ouvrirDossier('documents')}>
            Ouvrir
          </button>
        </div>

        <label style={{ marginTop: '1.4rem' }}>
          Dossier des données (base SQLite)
          <input readOnly value={infos.dossierDonnees} />
        </label>
        <div className="barre-boutons">
          <button className="bouton-secondaire" onClick={() => window.api.parametresApp.ouvrirDossier('donnees')}>
            Ouvrir le dossier des données
          </button>
          <button className="bouton-secondaire" onClick={() => window.api.parametresApp.ouvrirDossier('sauvegardes')}>
            Ouvrir les sauvegardes
          </button>
        </div>
      </div>

      <div className="carte">
        <h2>Sauvegardes</h2>
        <label>
          Nombre de sauvegardes conservées
          <input
            type="number"
            min="1"
            max="500"
            value={params.nbSauvegardes}
            onChange={(e) => setParams({ ...params, nbSauvegardes: Number(e.target.value) })}
          />
        </label>
        <p className="valeur-calculee">
          Une sauvegarde est créée automatiquement à chaque démarrage et avant chaque export PDF.
          Actuellement : <strong>{infos.nbSauvegardes}</strong> sauvegarde(s).
        </p>
        <div className="barre-boutons">
          <button onClick={sauvegarderMaintenant}>Sauvegarder maintenant</button>
        </div>

        {sauvegardes.length > 0 && (
          <table className="table-editable" style={{ marginTop: '1.2rem' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Taille</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sauvegardes.slice(0, 12).map((s) => (
                <tr key={s.nom}>
                  <td>{formaterDate(s.dateIso)}</td>
                  <td>{formaterTaille(s.tailleOctets)}</td>
                  <td>
                    <button onClick={() => restaurer(s.nom)}>Restaurer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="carte">
        <h2>Sauvegarde externe chiffrée</h2>
        <p className="valeur-calculee">
          Copie chiffrée de la base vers une clé USB ou un disque externe (AES-256-GCM, mot de passe
          jamais enregistré). Indispensable en cas de panne ou de vol de l'ordinateur.
        </p>
        <label>
          Dossier externe
          <input readOnly value={dossierExterne ?? 'Aucun dossier choisi'} />
        </label>
        <div className="barre-boutons">
          <button onClick={choisirDossierExterne}>Choisir le dossier…</button>
        </div>

        <label style={{ marginTop: '1.2rem' }}>
          Mot de passe de chiffrement (8 caractères minimum)
          <input
            type="password"
            autoComplete="new-password"
            value={motDePasseExterne}
            onChange={(e) => setMotDePasseExterne(e.target.value)}
          />
        </label>
        <p className="valeur-calculee texte-alerte">
          Note ce mot de passe ailleurs : sans lui, la sauvegarde est définitivement illisible. Il
          n'est stocké nulle part dans l'application.
        </p>
        <div className="barre-boutons">
          <button onClick={sauvegarderExterne}>Sauvegarder maintenant (chiffré)</button>
          <button className="bouton-secondaire" onClick={restaurerExterne}>
            Restaurer depuis un fichier chiffré…
          </button>
        </div>
      </div>

      <div className="carte">
        <h2>Valeurs par défaut</h2>
        <div className="ligne-formulaire">
          <label>
            Délai de paiement des factures (jours)
            <input
              type="number"
              min="0"
              max="365"
              value={params.delaiPaiementDefaut}
              onChange={(e) => setParams({ ...params, delaiPaiementDefaut: Number(e.target.value) })}
            />
          </label>
          <label>
            Validité des devis (jours)
            <input
              type="number"
              min="0"
              max="365"
              value={params.validiteDevisDefaut}
              onChange={(e) => setParams({ ...params, validiteDevisDefaut: Number(e.target.value) })}
            />
          </label>
          <label>
            Alerte « facture en attente » après (jours)
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
        <h2>Catégories du Journal</h2>
        <table className="table-editable">
          <thead>
            <tr>
              <th>Libellé</th>
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
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="client-ajout-rapide">
          <input
            placeholder="Nouvelle catégorie"
            value={nouvelleCategorie}
            onChange={(e) => setNouvelleCategorie(e.target.value)}
          />
          <button onClick={ajouterCategorie}>Ajouter</button>
        </div>
      </div>

      <div className="carte">
        <h2>Mises à jour</h2>
        <p className="valeur-calculee">
          Permet de diffuser une nouvelle version à tous les postes qui utilisent Ohmnia. Laisse
          l'adresse vide pour désactiver complètement : dans ce cas l'application ne fait aucun accès
          réseau.
        </p>
        <label>
          Source des mises à jour
          <select
            value={configMaj.source}
            onChange={(e) =>
              setConfigMaj({ ...configMaj, source: e.target.value as ConfigurationMaj['source'] })
            }
          >
            <option value="github">Dépôt GitHub (recommandé, diffusion publique)</option>
            <option value="url">Dossier ou serveur HTTP (réseau local)</option>
          </select>
        </label>

        {configMaj.source === 'github' ? (
          <>
            <label>
              Dépôt GitHub
              <input
                placeholder="proprietaire/depot (vide = désactivé)"
                value={configMaj.depot}
                onChange={(e) => setConfigMaj({ ...configMaj, depot: e.target.value })}
              />
            </label>
            <p className="valeur-calculee">
              L'application lira la dernière <em>release</em> publiée sur ce dépôt. Le dépôt doit être
              public, ou les fichiers de version accessibles sans authentification.
            </p>
          </>
        ) : (
          <label>
            Adresse de publication
            <input
              placeholder="http://192.168.1.20/ohmnia (vide = désactivé)"
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
          Vérifier automatiquement au démarrage
        </label>
        <div className="barre-boutons">
          <button onClick={enregistrerConfigurationMaj}>Enregistrer l'adresse</button>
          <button className="bouton-secondaire" onClick={verifierMaj}>
            Vérifier maintenant
          </button>
        </div>

        <div className="resultats-calcules">
          <p>
            Version installée : <strong>{etatMaj?.versionActuelle ?? infos.version}</strong>
          </p>
          {etatMaj?.statut === 'verification' && <p>Vérification en cours…</p>}
          {etatMaj?.statut === 'aJour' && <p>Cette version est à jour.</p>}
          {etatMaj?.statut === 'disponible' && (
            <>
              <p>
                Nouvelle version disponible : <strong>{etatMaj.versionDisponible}</strong>
              </p>
              <div className="barre-boutons">
                <button onClick={telechargerMaj}>Télécharger</button>
              </div>
            </>
          )}
          {etatMaj?.statut === 'telechargement' && (
            <>
              <p>Téléchargement… {etatMaj.pourcentage ?? 0} %</p>
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
                Version <strong>{etatMaj.versionDisponible}</strong> téléchargée et prête à installer.
                L'application va redémarrer.
              </p>
              <div className="barre-boutons">
                <button onClick={installerMaj}>Installer et redémarrer</button>
              </div>
            </>
          )}
          {etatMaj?.statut === 'erreur' && <p className="texte-alerte">{etatMaj.message}</p>}
        </div>
      </div>

      <div className="carte">
        <h2>Informations & maintenance</h2>
        <table className="table-infos">
          <tbody>
            <tr>
              <th>Version d'Ohmnia</th>
              <td>{infos.version}</td>
            </tr>
            <tr>
              <th>Electron / Node</th>
              <td>
                {infos.versionElectron} / {infos.versionNode}
              </td>
            </tr>
            <tr>
              <th>Base de données</th>
              <td>
                {infos.cheminBase} ({formaterTaille(infos.tailleBaseOctets)})
              </td>
            </tr>
          </tbody>
        </table>
        <div className="barre-boutons">
          <button onClick={verifierIntegrite}>Vérifier l'intégrité de la base</button>
          <button className="bouton-secondaire" onClick={exporterTout}>
            Exporter toutes les données (JSON)
          </button>
        </div>
      </div>

      <div className="carte">
        <h2>Conditions d'utilisation</h2>
        <p className="valeur-calculee">
          Conditions de l'application elle-même — à ne pas confondre avec vos conditions générales
          de vente, qui se saisissent dans « Mon entreprise » et s'impriment sur vos factures.
        </p>
        {etatConditions && (
          <table className="table-infos">
            <tbody>
              <tr>
                <th>Version acceptée</th>
                <td>
                  {etatConditions.versionAcceptee || '—'}
                  {etatConditions.versionAcceptee &&
                    etatConditions.versionAcceptee !== etatConditions.versionCourante &&
                    ` (version actuelle : ${etatConditions.versionCourante})`}
                </td>
              </tr>
              <tr>
                <th>Acceptées le</th>
                <td>{etatConditions.accepteeLe || '—'}</td>
              </tr>
            </tbody>
          </table>
        )}
        <div className="barre-boutons">
          <button onClick={() => setConditionsOuvertes(true)}>Relire les conditions</button>
          <button className="bouton-secondaire" onClick={() => window.api.conditions.ouvrirPage()}>
            Ouvrir la page en ligne
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
          <button onClick={enregistrer}>Enregistrer les paramètres</button>
        </div>
        {messageErreur && <p className="erreur">{messageErreur}</p>}
        {messageSucces && <p className="succes">{messageSucces}</p>}
      </div>
    </div>
  )
}
