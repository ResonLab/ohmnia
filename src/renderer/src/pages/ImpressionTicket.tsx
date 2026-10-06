import { useEffect, useState } from 'react'
import type { DonneesTicket } from '../../../shared/types'
import { formaterMontant } from '../../../shared/pays'
import { calculerTotalLigne } from '../../../shared/calculs'
import { MODE_CARTE, MODE_ESPECES, STATUT_VENTE_ANNULEE } from '../../../shared/caisse'
import { definirLangue, t, type Langue } from '../../../shared/i18n'

/**
 * Ticket de caisse au format A4, imprimé par `main/pdf.ts` (ancre `#ticket?id=`).
 * Réutilise le style des documents : clair, sobre, sans variable du thème sombre.
 *
 * Le nom de la taxe et la mention de non-assujettissement viennent du pays
 * (`donneesTicket`), jamais de `t()` : ils partent sur un document fiscal.
 */

function lireId(): number {
  const [, requete] = window.location.hash.slice(1).split('?')
  return Number(new URLSearchParams(requete ?? '').get('id'))
}

export default function ImpressionTicket(): React.JSX.Element {
  const [donnees, setDonnees] = useState<DonneesTicket | null>(null)

  useEffect(() => {
    window.api.caisse
      .donneesTicket(lireId())
      .then((d) => {
        // La langue doit être appliquée avant le rendu : le PDF est capté une seule fois.
        definirLangue(d.langue as Langue)
        setDonnees(d)
        requestAnimationFrame(() => requestAnimationFrame(() => window.api.pdf.signalerPret()))
      })
      .catch(() => window.api.pdf.signalerPret())
  }, [])

  if (!donnees) return <div />

  const { vente } = donnees
  const montant = (valeur: number): string => formaterMontant(valeur, donnees.pays)
  const especes = vente.paiements.find((p) => p.mode === MODE_ESPECES)
  const carte = vente.paiements.find((p) => p.mode === MODE_CARTE)

  return (
    <div className="document-impression">
      <header className="document-entete">
        {donnees.logo && <img src={donnees.logo} alt="" className="document-logo" />}
        <div className="document-entete-texte">
          <h1>{donnees.entrepriseNom}</h1>
          <p style={{ whiteSpace: 'pre-line' }}>{donnees.adresse}</p>
          {donnees.telephone && <p>{donnees.telephone}</p>}
          {donnees.numeroIde && <p>{donnees.numeroIde}</p>}
        </div>
      </header>

      <section className="document-meta">
        <div>
          <h2>{t('ticket.titre')}</h2>
          <p>
            {t('doc.numero')} {vente.numero}
          </p>
          <p>
            {t('doc.date')} : {vente.date.slice(0, 16)}
          </p>
        </div>
      </section>

      {vente.statut === STATUT_VENTE_ANNULEE && <p className="ticket-annule">{t('ticket.annule')}</p>}

      <table className="document-table">
        <thead>
          <tr>
            <th>{t('doc.designation')}</th>
            <th>{t('doc.quantite')}</th>
            <th>{t('doc.prixUnitaire')}</th>
            <th>{t('doc.total')}</th>
          </tr>
        </thead>
        <tbody>
          {vente.lignes.map((ligne, index) => (
            <tr key={index}>
              <td>{ligne.designation}</td>
              <td>{ligne.quantite}</td>
              <td>{montant(ligne.prixUnitaire)}</td>
              <td>{montant(calculerTotalLigne(ligne.quantite, ligne.prixUnitaire))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="document-totaux">
        {donnees.assujettiTva ? (
          <>
            <p>
              {t('ticket.totalHt')} : {montant(Math.round((vente.total - vente.montantTva) * 100) / 100)}
            </p>
            <p>
              {donnees.nomTaxe} ({vente.tvaPct}%) : {montant(vente.montantTva)}
            </p>
            <p className="document-total-final">
              {t('ticket.totalTtc')} : {montant(vente.total)}
            </p>
          </>
        ) : (
          <>
            <p className="document-total-final">
              {t('doc.total')} : {montant(vente.total)}
            </p>
            {donnees.mentionNonAssujetti && (
              <p className="document-mention-legale">{donnees.mentionNonAssujetti}</p>
            )}
          </>
        )}
      </section>

      <section className="ticket-paiements">
        {carte && (
          <p>
            {t('ticket.carte')} : {montant(carte.montant)}
          </p>
        )}
        {especes && (
          <>
            <p>
              {t('ticket.especes')} : {montant(especes.montant)}
            </p>
            {especes.arrondi !== 0 && (
              <p>
                {t('ticket.arrondi')} : {montant(especes.arrondi)}
              </p>
            )}
            {especes.deviseRecue !== donnees.devise ? (
              <>
                <p>
                  {t('ticket.recu')} : {especes.montantRecu.toFixed(2)} {especes.deviseRecue}
                </p>
                <p>
                  {t('ticket.taux')} : 1 {especes.deviseRecue} = {especes.taux} {donnees.devise}
                </p>
              </>
            ) : (
              <p>
                {t('ticket.recu')} : {montant(especes.montantRecu)}
              </p>
            )}
            {especes.rendu > 0 && (
              <p>
                {t('ticket.rendu')} : {montant(especes.rendu)}
              </p>
            )}
          </>
        )}
      </section>

      {vente.serviPar && (
        <p className="ticket-servi-par">{t('ticket.serviPar', { nom: vente.serviPar })}</p>
      )}
    </div>
  )
}
