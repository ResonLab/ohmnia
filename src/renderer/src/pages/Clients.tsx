import { useEffect, useState } from 'react'
import type { Client, ClientDetail } from '../../../shared/types'
import { t } from '../../../shared/i18n'
import { formaterMontant } from '../lib/devise'
import { SiAutorise } from '../lib/role'

const CLIENT_VIDE: Omit<Client, 'id'> = { nom: '', adresse: '', email: '', telephone: '' }

export default function Clients(): React.JSX.Element {
  const [clients, setClients] = useState<Client[]>([])
  const [detail, setDetail] = useState<ClientDetail | null>(null)
  const [brouillon, setBrouillon] = useState<Client | null>(null)
  const [nouveau, setNouveau] = useState<Omit<Client, 'id'> | null>(null)
  const [recherche, setRecherche] = useState('')
  const [messageErreur, setMessageErreur] = useState<string | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [seuilAlerteJours, setSeuilAlerteJours] = useState(30)

  async function rechargerListe(): Promise<void> {
    setClients(await window.api.clients.lister())
  }

  useEffect(() => {
    window.api.parametresApp.lire().then((p) => setSeuilAlerteJours(p.seuilAlerteFactureJours))
    rechargerListe().finally(() => setChargement(false))
  }, [])

  function afficherErreur(erreur: unknown): void {
    setMessageSucces(null)
    setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
  }

  function afficherSucces(message: string): void {
    setMessageErreur(null)
    setMessageSucces(message)
    setTimeout(() => setMessageSucces(null), 2500)
  }

  async function selectionner(id: number): Promise<void> {
    setMessageErreur(null)
    try {
      const d = await window.api.clients.obtenirDetail(id)
      setDetail(d)
      setBrouillon({ id: d.id, nom: d.nom, adresse: d.adresse, email: d.email, telephone: d.telephone })
      setNouveau(null)
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function enregistrerModification(): Promise<void> {
    if (!brouillon) return
    try {
      await window.api.clients.modifier(brouillon)
      await rechargerListe()
      await selectionner(brouillon.id)
      afficherSucces(t('client.misAJour'))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function creerClient(): Promise<void> {
    if (!nouveau) return
    try {
      const cree = await window.api.clients.ajouter(nouveau)
      setNouveau(null)
      await rechargerListe()
      await selectionner(cree.id)
      afficherSucces(t('client.cree'))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  async function supprimerClient(id: number): Promise<void> {
    if (!window.confirm(t('client.confirmerSuppression'))) return
    try {
      await window.api.clients.supprimer(id)
      setDetail(null)
      setBrouillon(null)
      await rechargerListe()
      afficherSucces(t('client.supprime'))
    } catch (erreur) {
      afficherErreur(erreur)
    }
  }

  if (chargement) return <p>{t('etat.chargement')}</p>

  const clientsFiltres = clients.filter((c) =>
    c.nom.toLowerCase().includes(recherche.trim().toLowerCase())
  )

  return (
    <div className="clients-layout">
      <aside className="carte clients-liste">
        <h2>{t('client.titre')}</h2>
        <input
          className="champ-recherche"
          placeholder={t('client.rechercher')}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <ul className="liste-clients">
          {clientsFiltres.map((c) => (
            <li key={c.id}>
              <button
                className={detail?.id === c.id ? 'actif' : ''}
                onClick={() => selectionner(c.id)}
              >
                <span className="liste-clients-nom">{c.nom}</span>
                {c.email && <span className="liste-clients-meta">{c.email}</span>}
              </button>
            </li>
          ))}
          {clientsFiltres.length === 0 && <li className="liste-vide">{t('client.aucunTrouve')}</li>}
        </ul>
        <SiAutorise>
          <button
            onClick={() => {
              setNouveau({ ...CLIENT_VIDE })
              setDetail(null)
              setBrouillon(null)
            }}
          >
            {t('client.nouveau')}
          </button>
        </SiAutorise>
      </aside>

      <section className="clients-detail">
        {nouveau && (
          <div className="carte">
            <h2>{t('client.titreNouveau')}</h2>
            <label>
              {t('client.nom')}
              <input value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} />
            </label>
            <label>
              {t('client.adresse')}
              <textarea
                value={nouveau.adresse}
                onChange={(e) => setNouveau({ ...nouveau, adresse: e.target.value })}
              />
            </label>
            <div className="ligne-formulaire">
              <label>
                {t('client.email')}
                <input
                  type="email"
                  value={nouveau.email}
                  onChange={(e) => setNouveau({ ...nouveau, email: e.target.value })}
                />
              </label>
              <label>
                {t('client.telephone')}
                <input
                  value={nouveau.telephone}
                  onChange={(e) => setNouveau({ ...nouveau, telephone: e.target.value })}
                />
              </label>
            </div>
            <div className="barre-boutons">
              <button onClick={creerClient}>{t('client.creer')}</button>
              <button className="bouton-secondaire" onClick={() => setNouveau(null)}>
                {t('action.annuler')}
              </button>
            </div>
          </div>
        )}

        {detail && brouillon && (
          <>
            <div className="carte">
              <h2>{t('client.fiche')}</h2>
              <label>
                {t('client.nom')}
                <input
                  value={brouillon.nom}
                  onChange={(e) => setBrouillon({ ...brouillon, nom: e.target.value })}
                />
              </label>
              <label>
                {t('client.adresse')}
                <textarea
                  value={brouillon.adresse}
                  onChange={(e) => setBrouillon({ ...brouillon, adresse: e.target.value })}
                />
              </label>
              <div className="ligne-formulaire">
                <label>
                  {t('client.email')}
                  <input
                    type="email"
                    value={brouillon.email}
                    onChange={(e) => setBrouillon({ ...brouillon, email: e.target.value })}
                  />
                </label>
                <label>
                  {t('client.telephone')}
                  <input
                    value={brouillon.telephone}
                    onChange={(e) => setBrouillon({ ...brouillon, telephone: e.target.value })}
                  />
                </label>
              </div>
              <SiAutorise>
                <div className="barre-boutons">
                  <button onClick={enregistrerModification}>{t('action.enregistrer')}</button>
                  <button className="bouton-danger" onClick={() => supprimerClient(brouillon.id)}>
                    {t('action.supprimer')}
                  </button>
                </div>
              </SiAutorise>
            </div>

            <div className="carte">
              <h2>{t('client.chiffres')}</h2>
              <div className="tuiles">
                <div className="tuile">
                  <span className="tuile-valeur">{formaterMontant(detail.totalFacture)}</span>
                  <span className="tuile-libelle">{t('client.totalFacture')}</span>
                </div>
                <div className="tuile">
                  <span className={`tuile-valeur ${detail.totalEnAttente > 0 ? 'texte-alerte' : ''}`}>
                    {formaterMontant(detail.totalEnAttente)}
                  </span>
                  <span className="tuile-libelle">{t('client.enAttentePaiement')}</span>
                </div>
                <div className="tuile">
                  <span className="tuile-valeur">{detail.factures.length}</span>
                  <span className="tuile-libelle">{t('client.factures')}</span>
                </div>
                <div className="tuile">
                  <span className="tuile-valeur">{detail.devis.length}</span>
                  <span className="tuile-libelle">{t('client.devis')}</span>
                </div>
              </div>
            </div>

            <div className="carte">
              <h2>{t('client.facturesDuClient')}</h2>
              {detail.factures.length === 0 ? (
                <p className="graphique-vide">{t('client.aucuneFacture')}</p>
              ) : (
                <table className="table-editable">
                  <thead>
                    <tr>
                      <th>{t('colonne.numero')}</th>
                      <th>{t('colonne.date')}</th>
                      <th>{t('colonne.statut')}</th>
                      <th>{t('colonne.montant')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.factures.map((f) => {
                      const enRetard = f.joursEnAttente !== null && f.joursEnAttente > seuilAlerteJours
                      return (
                        <tr key={f.id} className={enRetard ? 'alerte' : ''}>
                          <td>{f.numero}</td>
                          <td>{f.date}</td>
                          <td>
                            {f.statut}
                            {enRetard && (
                              <span className="badge-alerte">
                                {t('client.enAttenteDepuis', { jours: f.joursEnAttente ?? 0 })}
                              </span>
                            )}
                          </td>
                          <td>{f.montant === null ? '—' : `${formaterMontant(f.montant)}`}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="carte">
              <h2>{t('client.devisDuClient')}</h2>
              {detail.devis.length === 0 ? (
                <p className="graphique-vide">{t('client.aucunDevis')}</p>
              ) : (
                <table className="table-editable">
                  <thead>
                    <tr>
                      <th>{t('colonne.numero')}</th>
                      <th>{t('colonne.date')}</th>
                      <th>{t('colonne.statut')}</th>
                      <th>{t('colonne.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.devis.map((d) => (
                      <tr key={d.id}>
                        <td>{d.numero}</td>
                        <td>{d.date}</td>
                        <td>{d.statut}</td>
                        <td>{formaterMontant(d.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {!detail && !nouveau && (
          <div className="carte etat-vide">
            <p>{t('client.riendSelectionne')}</p>
          </div>
        )}

        {messageErreur && <p className="erreur">{messageErreur}</p>}
        {messageSucces && <p className="succes">{messageSucces}</p>}
      </section>
    </div>
  )
}
