import { useEffect, useState } from 'react'
import type { TableauDeBord } from '../../../shared/types'
import { diviserSansErreur } from '../../../shared/calculs'
import { formaterMontant } from '../lib/devise'
import { locale, t } from '../../../shared/i18n'

/**
 * Le nom du mois suit la langue de l'interface, pas une locale figée.
 * Écrit « fr-CH » en dur, un anglophone lisait « août 2026 » au milieu d'un
 * écran anglais — le genre de détail qui trahit une traduction faite à moitié.
 * Le choix de la locale vit dans `i18n.ts` : il servait à quatre écrans.
 */
function nomDuMois(moisIso: string): string {
  const [annee, mois] = moisIso.split('-')
  const date = new Date(Number(annee), Number(mois) - 1, 1)
  return date.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })
}

interface Props {
  onNaviguer: (module: string) => void
}

export default function Accueil({ onNaviguer }: Props): React.JSX.Element {
  const [donnees, setDonnees] = useState<TableauDeBord | null>(null)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    window.api.tableauDeBord
      .charger()
      .then(setDonnees)
      .finally(() => setChargement(false))
  }, [])

  if (chargement || !donnees) return <p>{t('etat.chargement')}</p>

  const progressionObjectif = Math.min(
    diviserSansErreur(donnees.caAnnee, donnees.objectifAnnee) * 100,
    100
  )

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>
          {t('accueil.ceMois')} — {nomDuMois(donnees.moisCourant)}
        </h2>
        <div className="tuiles">
          <div className="tuile">
            <span className="tuile-valeur">{formaterMontant(donnees.caMois)}</span>
            <span className="tuile-libelle">{t('accueil.entrees')}</span>
          </div>
          <div className="tuile">
            <span className="tuile-valeur">{formaterMontant(donnees.depensesMois)}</span>
            <span className="tuile-libelle">{t('accueil.depenses')}</span>
          </div>
          <div className="tuile">
            <span className={`tuile-valeur ${donnees.beneficeMois < 0 ? 'texte-alerte' : ''}`}>
              {formaterMontant(donnees.beneficeMois)}
            </span>
            <span className="tuile-libelle">{t('accueil.benefice')}</span>
          </div>
          <div className="tuile">
            <span className="tuile-valeur">{formaterMontant(donnees.valeurStock)}</span>
            <span className="tuile-libelle">{t('accueil.valeurStock')}</span>
          </div>
        </div>
      </div>

      <div className="carte">
        <h2>{t('accueil.objectifAnnuel')}</h2>
        {donnees.objectifAnnee > 0 ? (
          <>
            <div className="barre-progression">
              <div className="barre-progression-remplissage" style={{ width: `${progressionObjectif}%` }} />
            </div>
            <p className="valeur-calculee">
              {t('accueil.objectifProgression', {
                fait: formaterMontant(donnees.caAnnee),
                objectif: formaterMontant(donnees.objectifAnnee)
              })}{' '}
              <strong>{progressionObjectif.toFixed(1)}%</strong>
            </p>
          </>
        ) : (
          <p className="graphique-vide">{t('accueil.objectifAbsent')}</p>
        )}
      </div>

      <div className="carte">
        <h2>{t('accueil.aSuivre')}</h2>
        <div className="tuiles">
          <div
            className="tuile tuile-cliquable"
            onClick={() => onNaviguer('facturation')}
            role="button"
            tabIndex={0}
          >
            <span className="tuile-valeur">{donnees.nbFacturesEnAttente}</span>
            <span className="tuile-libelle">{t('accueil.facturesEnAttente')}</span>
            <span className="tuile-detail">{formaterMontant(donnees.montantEnAttente)}</span>
          </div>
          <div
            className="tuile tuile-cliquable"
            onClick={() => onNaviguer('facturation')}
            role="button"
            tabIndex={0}
          >
            <span className={`tuile-valeur ${donnees.nbFacturesEnRetard > 0 ? 'texte-alerte' : ''}`}>
              {donnees.nbFacturesEnRetard}
            </span>
            <span className="tuile-libelle">{t('accueil.facturesEnRetard')}</span>
            <span className="tuile-detail">{formaterMontant(donnees.montantEnRetard)}</span>
          </div>
          <div
            className="tuile tuile-cliquable"
            onClick={() => onNaviguer('devis')}
            role="button"
            tabIndex={0}
          >
            <span className="tuile-valeur">{donnees.nbDevisEnAttente}</span>
            <span className="tuile-libelle">{t('accueil.devisEnAttente')}</span>
          </div>
          <div
            className="tuile tuile-cliquable"
            onClick={() => onNaviguer('inventaire')}
            role="button"
            tabIndex={0}
          >
            <span className={`tuile-valeur ${donnees.articlesSousSeuil.length > 0 ? 'texte-alerte' : ''}`}>
              {donnees.articlesSousSeuil.length}
            </span>
            <span className="tuile-libelle">{t('accueil.articlesSousSeuil')}</span>
          </div>
        </div>
      </div>

      <div className="carte">
        <h2>{t('accueil.prochainesEcheances')}</h2>
        {donnees.prochainesEcheances.length === 0 ? (
          <p className="graphique-vide">{t('accueil.aucuneEcheance')}</p>
        ) : (
          <table className="table-editable">
            <thead>
              <tr>
                <th>{t('colonne.facture')}</th>
                <th>{t('colonne.client')}</th>
                <th>{t('colonne.echeance')}</th>
                <th>{t('accueil.delai')}</th>
                <th>{t('colonne.montant')}</th>
              </tr>
            </thead>
            <tbody>
              {donnees.prochainesEcheances.map((e) => (
                <tr key={e.id} className={e.joursRestants < 0 ? 'alerte' : ''}>
                  <td>{e.numero}</td>
                  <td>{e.clientNom}</td>
                  <td>{e.dateEcheance}</td>
                  <td>
                    {e.joursRestants < 0
                      ? t('accueil.enRetardDe', { jours: Math.abs(e.joursRestants) })
                      : t('accueil.dansJours', { jours: e.joursRestants })}
                  </td>
                  <td>{e.montant === null ? '—' : `${formaterMontant(e.montant)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {donnees.articlesSousSeuil.length > 0 && (
        <div className="carte">
          <h2>{t('accueil.stockAReapprovisionner')}</h2>
          <table className="table-editable">
            <thead>
              <tr>
                <th>{t('colonne.reference')}</th>
                <th>{t('colonne.designation')}</th>
                <th>{t('accueil.enStock')}</th>
                <th>{t('accueil.seuil')}</th>
              </tr>
            </thead>
            <tbody>
              {donnees.articlesSousSeuil.map((a) => (
                <tr key={a.reference} className="alerte">
                  <td>{a.reference}</td>
                  <td>{a.designation}</td>
                  <td>{a.quantiteStock}</td>
                  <td>{a.seuilAlerte}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
