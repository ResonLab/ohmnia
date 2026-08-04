import { useEffect, useState } from 'react'
import type { TableauDeBord } from '../../../shared/types'
import { diviserSansErreur } from '../../../shared/calculs'
import { formaterMontant } from '../lib/devise'

function nomDuMois(moisIso: string): string {
  const [annee, mois] = moisIso.split('-')
  const date = new Date(Number(annee), Number(mois) - 1, 1)
  return date.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })
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

  if (chargement || !donnees) return <p>Chargement…</p>

  const progressionObjectif = Math.min(
    diviserSansErreur(donnees.caAnnee, donnees.objectifAnnee) * 100,
    100
  )

  return (
    <div className="pile-cartes">
      <div className="carte">
        <h2>Ce mois — {nomDuMois(donnees.moisCourant)}</h2>
        <div className="tuiles">
          <div className="tuile">
            <span className="tuile-valeur">{formaterMontant(donnees.caMois)}</span>
            <span className="tuile-libelle">Entrées</span>
          </div>
          <div className="tuile">
            <span className="tuile-valeur">{formaterMontant(donnees.depensesMois)}</span>
            <span className="tuile-libelle">Dépenses</span>
          </div>
          <div className="tuile">
            <span className={`tuile-valeur ${donnees.beneficeMois < 0 ? 'texte-alerte' : ''}`}>
              {formaterMontant(donnees.beneficeMois)}
            </span>
            <span className="tuile-libelle">Bénéfice</span>
          </div>
          <div className="tuile">
            <span className="tuile-valeur">{formaterMontant(donnees.valeurStock)}</span>
            <span className="tuile-libelle">Valeur du stock</span>
          </div>
        </div>
      </div>

      <div className="carte">
        <h2>Objectif annuel</h2>
        {donnees.objectifAnnee > 0 ? (
          <>
            <div className="barre-progression">
              <div className="barre-progression-remplissage" style={{ width: `${progressionObjectif}%` }} />
            </div>
            <p className="valeur-calculee">
              {formaterMontant(donnees.caAnnee)} réalisés sur {formaterMontant(donnees.objectifAnnee)} —{' '}
              <strong>{progressionObjectif.toFixed(1)}%</strong>
            </p>
          </>
        ) : (
          <p className="graphique-vide">
            Aucun objectif défini pour cette année. Tu peux le saisir dans « Résumé annuel ».
          </p>
        )}
      </div>

      <div className="carte">
        <h2>À suivre</h2>
        <div className="tuiles">
          <div
            className="tuile tuile-cliquable"
            onClick={() => onNaviguer('facturation')}
            role="button"
            tabIndex={0}
          >
            <span className="tuile-valeur">{donnees.nbFacturesEnAttente}</span>
            <span className="tuile-libelle">Factures en attente</span>
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
            <span className="tuile-libelle">Factures en retard</span>
            <span className="tuile-detail">{formaterMontant(donnees.montantEnRetard)}</span>
          </div>
          <div
            className="tuile tuile-cliquable"
            onClick={() => onNaviguer('devis')}
            role="button"
            tabIndex={0}
          >
            <span className="tuile-valeur">{donnees.nbDevisEnAttente}</span>
            <span className="tuile-libelle">Devis en attente</span>
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
            <span className="tuile-libelle">Articles sous le seuil</span>
          </div>
        </div>
      </div>

      <div className="carte">
        <h2>Prochaines échéances</h2>
        {donnees.prochainesEcheances.length === 0 ? (
          <p className="graphique-vide">Aucune facture en attente de paiement.</p>
        ) : (
          <table className="table-editable">
            <thead>
              <tr>
                <th>Facture</th>
                <th>Client</th>
                <th>Échéance</th>
                <th>Délai</th>
                <th>Montant</th>
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
                      ? `En retard de ${Math.abs(e.joursRestants)} j`
                      : `Dans ${e.joursRestants} j`}
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
          <h2>Stock à réapprovisionner</h2>
          <table className="table-editable">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Désignation</th>
                <th>En stock</th>
                <th>Seuil</th>
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
