import { useEffect, useState } from 'react'
import type {
  ArticleInventaire,
  DemandeVenteCaisse,
  Entreprise,
  TotauxCaisse,
  VenteCaisse
} from '../../../shared/types'
import {
  calculerReglement,
  calculerTotalCaisse,
  MODE_CARTE,
  STATUT_VENTE_ANNULEE,
  type Reglement
} from '../../../shared/caisse'
import { profilPays } from '../../../shared/pays'
import { t } from '../../../shared/i18n'
import { formaterMontant } from '../lib/devise'
import { useGardeSortie } from '../gardeSortie'

/**
 * La caisse : on vend des articles de l'inventaire, on encaisse en carte, en
 * espèces (avec change et rendu) ou en mixte, puis on imprime un ticket A4.
 *
 * Tous les calculs d'argent viennent de `shared/caisse.ts`, les mêmes que ceux
 * du main process : ce que l'écran annonce est ce qui sera enregistré.
 */

type Onglet = 'vente' | 'journal'
type ModeEncaissement = 'carte' | 'especes' | 'mixte'

interface LignePanier {
  reference: string
  designation: string
  prix: number
  stock: number
  quantite: number
}

const DEVISES = ['CHF', 'EUR', 'USD', 'GBP']

const nombre = (texte: string): number => Number(texte.trim().replace(',', '.'))

function aujourdhui(): string {
  const d = new Date()
  const deux = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
}

function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur)
}

/** Le dernier taux saisi pour une devise, pour ne pas le retaper à chaque vente. */
function lireTauxMemorise(devise: string): string {
  try {
    return window.localStorage.getItem(`caisse.taux.${devise}`) ?? ''
  } catch {
    return ''
  }
}

function memoriserTaux(devise: string, taux: number): void {
  try {
    window.localStorage.setItem(`caisse.taux.${devise}`, String(taux))
  } catch {
    // Stockage indisponible : le taux sera simplement à retaper.
  }
}

export default function Caisse(): React.JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>('vente')
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null)

  useEffect(() => {
    window.api.entreprise.lire().then(setEntreprise)
  }, [])

  if (!entreprise) return <p>{t('etat.chargement')}</p>

  return (
    <div className="pile-cartes">
      <div className="barre-boutons">
        <button className={onglet === 'vente' ? '' : 'bouton-secondaire'} onClick={() => setOnglet('vente')}>
          {t('caisse.ongletVente')}
        </button>
        <button className={onglet === 'journal' ? '' : 'bouton-secondaire'} onClick={() => setOnglet('journal')}>
          {t('caisse.ongletJournal')}
        </button>
      </div>
      {onglet === 'vente' ? <Vente entreprise={entreprise} /> : <JournalCaisse />}
    </div>
  )
}

function Vente({ entreprise }: { entreprise: Entreprise }): React.JSX.Element {
  const deviseEntreprise = profilPays(entreprise.pays).devise
  const devises = [deviseEntreprise, ...DEVISES.filter((d) => d !== deviseEntreprise)]

  const [articles, setArticles] = useState<ArticleInventaire[]>([])
  const [recherche, setRecherche] = useState('')
  const [panier, setPanier] = useState<LignePanier[]>([])
  const [mode, setMode] = useState<ModeEncaissement>('carte')
  const [partCarteTexte, setPartCarteTexte] = useState('')
  const [devise, setDevise] = useState(deviseEntreprise)
  const [tauxTexte, setTauxTexte] = useState('1')
  const [recuTexte, setRecuTexte] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [derniere, setDerniere] = useState<VenteCaisse | null>(null)
  const [cheminTicket, setCheminTicket] = useState<string | null>(null)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)

  // Un panier rempli et non encaissé est un brouillon : on ne le perd pas en silence.
  useGardeSortie(panier.length > 0)

  useEffect(() => {
    window.api.inventaire.lister().then(setArticles)
  }, [])

  const termes = recherche.trim().toLowerCase()
  const articlesAffiches = articles.filter(
    (a) => !termes || a.reference.toLowerCase().includes(termes) || a.designation.toLowerCase().includes(termes)
  )

  function ajouter(article: ArticleInventaire): void {
    setDerniere(null)
    setPanier((precedent) => {
      const present = precedent.find((l) => l.reference === article.reference)
      if (present) {
        return precedent.map((l) => (l.reference === article.reference ? { ...l, quantite: l.quantite + 1 } : l))
      }
      return [
        ...precedent,
        {
          reference: article.reference,
          designation: article.designation,
          prix: article.prixVenteUnitaire,
          stock: article.quantiteStock,
          quantite: 1
        }
      ]
    })
  }

  function changerQuantite(reference: string, texte: string): void {
    const valeur = nombre(texte)
    if (!Number.isFinite(valeur) || valeur <= 0) return
    setPanier((precedent) => precedent.map((l) => (l.reference === reference ? { ...l, quantite: valeur } : l)))
  }

  function retirer(reference: string): void {
    setPanier((precedent) => precedent.filter((l) => l.reference !== reference))
  }

  function changerDevise(nouvelle: string): void {
    setDevise(nouvelle)
    setTauxTexte(nouvelle === deviseEntreprise ? '1' : lireTauxMemorise(nouvelle))
  }

  // --- Ce que l'écran annonce : le même calcul que celui qui sera enregistré. ---
  const tvaPct = entreprise.assujettiTva ? entreprise.tvaDefautPct : 0
  const totaux = calculerTotalCaisse(
    panier.map((l) => ({ quantite: l.quantite, prixUnitaire: l.prix })),
    entreprise.assujettiTva,
    tvaPct
  )
  const etranger = devise !== deviseEntreprise
  const taux = etranger ? nombre(tauxTexte) : 1
  const partCarte =
    mode === 'carte' ? totaux.total : mode === 'mixte' ? nombre(partCarteTexte === '' ? '0' : partCarteTexte) : 0

  let reglement: Reglement | null = null
  let montantRecu = 0
  let erreurReglement: string | null = null
  if (panier.length > 0) {
    try {
      if (!Number.isFinite(partCarte) || (etranger && !Number.isFinite(taux))) {
        throw new Error(t('caisse.montantInvalide'))
      }
      const base = {
        total: totaux.total,
        partCarte,
        devise,
        deviseEntreprise,
        taux,
        montantRecuEspeces: Number.MAX_SAFE_INTEGER,
        arrondiSuisse: deviseEntreprise === 'CHF'
      }
      // Espèces remises laissées vides : on suppose le montant exact.
      const exact = calculerReglement(base)
      montantRecu = recuTexte.trim() === '' ? exact.aEncaisserDeviseRecue : nombre(recuTexte)
      reglement = calculerReglement({ ...base, montantRecuEspeces: montantRecu })
    } catch (e) {
      erreurReglement = messageDe(e)
    }
  }
  const aDesEspeces = reglement !== null && reglement.especes > 0

  async function encaisser(): Promise<void> {
    if (!reglement) return
    setErreur(null)
    setEnvoiEnCours(true)
    const demande: DemandeVenteCaisse = {
      lignes: panier.map((l) => ({ referenceInventaire: l.reference, quantite: l.quantite })),
      partCarte: reglement.carte,
      deviseRecue: aDesEspeces ? devise : deviseEntreprise,
      taux: aDesEspeces && etranger ? taux : 1,
      montantRecuEspeces: aDesEspeces ? montantRecu : 0
    }
    try {
      const vente = await window.api.caisse.vendre(demande)
      if (aDesEspeces && etranger) memoriserTaux(devise, taux)
      setDerniere(vente)
      setCheminTicket(null)
      setPanier([])
      setPartCarteTexte('')
      setRecuTexte('')
      setArticles(await window.api.inventaire.lister())
    } catch (e) {
      setErreur(messageDe(e))
    } finally {
      setEnvoiEnCours(false)
    }
  }

  async function imprimerTicket(): Promise<void> {
    if (!derniere) return
    try {
      setCheminTicket(await window.api.pdf.genererTicket(derniere.id))
    } catch (e) {
      setErreur(messageDe(e))
    }
  }

  return (
    <div className="caisse-grille">
      <div className="carte">
        <h2>{t('caisse.articles')}</h2>
        <input
          placeholder={t('caisse.rechercher')}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <table className="table-editable">
          <thead>
            <tr>
              <th>{t('colonne.reference')}</th>
              <th>{t('colonne.designation')}</th>
              <th>{t('inventaire.stock')}</th>
              <th>{t('inventaire.prixVente')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {articlesAffiches.map((article) => (
              <tr key={article.reference}>
                <td>{article.reference}</td>
                <td>{article.designation}</td>
                <td className={article.quantiteStock <= 0 ? 'texte-alerte' : ''}>{article.quantiteStock}</td>
                <td>{formaterMontant(article.prixVenteUnitaire)}</td>
                <td>
                  <button className="action-ecriture bouton-secondaire" onClick={() => ajouter(article)}>
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {articlesAffiches.length === 0 && <p>{t('caisse.aucunArticle')}</p>}
      </div>

      <div className="carte">
        <h2>{t('caisse.panier')}</h2>

        {derniere && (
          <div className="caisse-confirmation">
            <p className="succes">{t('caisse.venteEnregistree', { numero: derniere.numero })}</p>
            {derniere.avertissements.map((avertissement) => (
              <p key={avertissement} className="texte-alerte">
                {avertissement}
              </p>
            ))}
            <div className="barre-boutons">
              <button onClick={imprimerTicket}>{t('caisse.imprimerTicket')}</button>
              <button className="bouton-secondaire" onClick={() => setDerniere(null)}>
                {t('caisse.nouvelleVente')}
              </button>
            </div>
            {cheminTicket && <p>{t('caisse.ticketEnregistre', { chemin: cheminTicket })}</p>}
          </div>
        )}

        {panier.length === 0 && !derniere && <p>{t('caisse.panierVide')}</p>}

        {panier.length > 0 && (
          <>
            <table className="table-editable">
              <thead>
                <tr>
                  <th>{t('colonne.designation')}</th>
                  <th>{t('doc.quantite')}</th>
                  <th>{t('doc.total')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {panier.map((ligne) => (
                  <tr key={ligne.reference}>
                    <td>
                      {ligne.designation}
                      {ligne.stock < ligne.quantite && (
                        <span className="texte-alerte"> {t('caisse.stockInsuffisant', { stock: ligne.stock })}</span>
                      )}
                    </td>
                    <td>
                      <input
                        defaultValue={ligne.quantite}
                        key={`${ligne.reference}-${ligne.quantite}`}
                        onChange={(e) => changerQuantite(ligne.reference, e.target.value)}
                      />
                    </td>
                    <td>{formaterMontant(ligne.quantite * ligne.prix)}</td>
                    <td>
                      <button className="bouton-secondaire" onClick={() => retirer(ligne.reference)}>
                        {t('caisse.retirer')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="resultats-calcules">
              {entreprise.assujettiTva && (
                <>
                  <p>
                    {t('doc.sousTotal')} : <strong>{formaterMontant(totaux.sousTotal)}</strong>
                  </p>
                  <p>
                    {profilPays(entreprise.pays).nomTaxe} ({tvaPct}%) :{' '}
                    <strong>{formaterMontant(totaux.montantTva)}</strong>
                  </p>
                </>
              )}
              <p>
                {t('doc.total')} : <strong>{formaterMontant(totaux.total)}</strong>
              </p>
            </div>

            <div className="barre-boutons">
              {(['carte', 'especes', 'mixte'] as const).map((m) => (
                <button key={m} className={mode === m ? '' : 'bouton-secondaire'} onClick={() => setMode(m)}>
                  {t(m === 'carte' ? 'caisse.modeCarte' : m === 'especes' ? 'caisse.modeEspeces' : 'caisse.modeMixte')}
                </button>
              ))}
            </div>

            {mode === 'mixte' && (
              <label>
                {t('caisse.partCarte')}
                <input value={partCarteTexte} onChange={(e) => setPartCarteTexte(e.target.value)} />
              </label>
            )}

            {mode !== 'carte' && (
              <>
                <label>
                  {t('caisse.devise')}
                  <select value={devise} onChange={(e) => changerDevise(e.target.value)}>
                    {devises.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                {etranger && (
                  <label>
                    {t('caisse.taux', { devise, monnaie: deviseEntreprise })}
                    <input value={tauxTexte} onChange={(e) => setTauxTexte(e.target.value)} />
                  </label>
                )}
                <label>
                  {t('caisse.montantRecu')} ({devise})
                  <input
                    placeholder={t('caisse.montantRecuAide')}
                    value={recuTexte}
                    onChange={(e) => setRecuTexte(e.target.value)}
                  />
                </label>
              </>
            )}

            {reglement && aDesEspeces && (
              <div className="resultats-calcules">
                {reglement.arrondi !== 0 && (
                  <p>
                    {t('caisse.arrondi')} : <strong>{formaterMontant(reglement.arrondi)}</strong>
                  </p>
                )}
                <p>
                  {t('caisse.aEncaisser')} :{' '}
                  <strong>
                    {etranger
                      ? `${reglement.aEncaisserDeviseRecue.toFixed(2)} ${devise}`
                      : formaterMontant(reglement.especes)}
                  </strong>
                </p>
                <p>
                  {t('caisse.rendu')} : <strong>{formaterMontant(reglement.rendu)}</strong>
                </p>
              </div>
            )}

            {erreurReglement && <p className="erreur">{erreurReglement}</p>}
            {erreur && <p className="erreur">{erreur}</p>}

            <div className="barre-boutons">
              <button
                className="action-ecriture"
                disabled={!reglement || envoiEnCours}
                onClick={encaisser}
              >
                {t('caisse.encaisser')}
              </button>
            </div>
          </>
        )}
        {panier.length === 0 && erreur && <p className="erreur">{erreur}</p>}
      </div>
    </div>
  )
}

function JournalCaisse(): React.JSX.Element {
  const [date, setDate] = useState(aujourdhui())
  const [ventes, setVentes] = useState<VenteCaisse[]>([])
  const [totaux, setTotaux] = useState<TotauxCaisse | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    Promise.all([window.api.caisse.lister(date), window.api.caisse.totaux(date)])
      .then(([liste, resume]) => {
        setVentes(liste)
        setTotaux(resume)
      })
      .catch((e) => setErreur(messageDe(e)))
  }, [date, version])

  async function annuler(vente: VenteCaisse): Promise<void> {
    if (!window.confirm(t('caisse.confirmerAnnulation', { numero: vente.numero }))) return
    setErreur(null)
    try {
      await window.api.caisse.annuler(vente.id)
      setVersion((v) => v + 1)
    } catch (e) {
      setErreur(messageDe(e))
    }
  }

  async function ticket(vente: VenteCaisse): Promise<void> {
    setErreur(null)
    try {
      const chemin = await window.api.pdf.genererTicket(vente.id)
      setMessage(t('caisse.ticketEnregistre', { chemin }))
    } catch (e) {
      setErreur(messageDe(e))
    }
  }

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>{t('caisse.ongletJournal')}</h2>
        <label>
          {t('doc.date')}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {totaux && (
          <div className="resultats-calcules">
            <p>
              {t('caisse.totalEspeces')} : <strong>{formaterMontant(totaux.especes)}</strong>
            </p>
            <p>
              {t('caisse.totalCarte')} : <strong>{formaterMontant(totaux.carte)}</strong>
            </p>
            <p>
              {t('caisse.totalJour')} : <strong>{formaterMontant(totaux.total)}</strong> ({totaux.nbVentes})
            </p>
          </div>
        )}
      </div>

      <div className="carte">
        {ventes.length === 0 ? (
          <p>{t('caisse.aucuneVente')}</p>
        ) : (
          <table className="table-editable">
            <thead>
              <tr>
                <th>{t('caisse.colNumero')}</th>
                <th>{t('caisse.colHeure')}</th>
                <th>{t('doc.total')}</th>
                <th>{t('caisse.colPaiement')}</th>
                <th>{t('caisse.colStatut')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ventes.map((vente) => {
                const annulee = vente.statut === STATUT_VENTE_ANNULEE
                return (
                  <tr key={vente.id} className={annulee ? 'caisse-annulee' : ''}>
                    <td>{vente.numero}</td>
                    <td>{vente.date.slice(11, 16)}</td>
                    <td>{formaterMontant(vente.total)}</td>
                    <td>
                      {vente.paiements
                        .map((p) => (p.mode === MODE_CARTE ? t('caisse.modeCarte') : t('caisse.modeEspeces')))
                        .join(' + ')}
                    </td>
                    <td>{annulee ? t('caisse.statutAnnulee') : t('caisse.statutValidee')}</td>
                    <td>
                      <div className="barre-boutons">
                        <button className="bouton-secondaire" onClick={() => ticket(vente)}>
                          {t('caisse.ticketPdf')}
                        </button>
                        {!annulee && (
                          <button className="action-ecriture bouton-danger" onClick={() => annuler(vente)}>
                            {t('caisse.annulerVente')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {message && <p className="succes">{message}</p>}
        {erreur && <p className="erreur">{erreur}</p>}
      </div>
    </div>
  )
}
