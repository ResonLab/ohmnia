import { useEffect, useState } from 'react'
import type { DocumentImpression } from '../../../shared/types'
import { formaterMontant } from '../../../shared/pays'
import { definirLangue, ordinal, t, type CleTraduction, type Langue } from '../../../shared/i18n'

function lireParametresHash(): {
  type: 'facture' | 'devis' | 'rappel'
  id: number
  rappelId?: number
} {
  const apresDiese = window.location.hash.slice(1) // "imprimer?type=facture&id=3"
  const [, requete] = apresDiese.split('?')
  const params = new URLSearchParams(requete ?? '')
  const rappelId = params.get('rappelId')
  return {
    type: (params.get('type') as 'facture' | 'devis' | 'rappel') ?? 'facture',
    id: Number(params.get('id')),
    rappelId: rappelId === null ? undefined : Number(rappelId)
  }
}

const CLES_TITRE = {
  facture: 'doc.facture',
  devis: 'doc.devis',
  rappel: 'doc.rappel'
} as const

export default function ImpressionDocument(): React.JSX.Element {
  const [donnees, setDonnees] = useState<DocumentImpression | null>(null)

  useEffect(() => {
    const { type, id, rappelId } = lireParametresHash()
    // La langue doit être appliquée avant le rendu : le PDF est capté une seule fois.
    window.api.parametresApp
      .lire()
      .then((p) => definirLangue(p.langue as Langue))
      .then(() => window.api.pdf.obtenirDonnees(type, id, rappelId))
      .then((d) => {
        setDonnees(d)
        // Laisse le temps au navigateur de peindre avant de signaler au main process
        // que le PDF peut être généré (sinon printToPDF capture une page vide).
        requestAnimationFrame(() => requestAnimationFrame(() => window.api.pdf.signalerPret()))
      })
  }, [])

  if (!donnees) return <div />

  return (
    <div className="document-impression">
      <header className="document-entete">
        {donnees.logoDataUrl && <img src={donnees.logoDataUrl} alt="" className="document-logo" />}
        <div className="document-entete-texte">
          <h1>{donnees.entrepriseNom}</h1>
          <p style={{ whiteSpace: 'pre-line' }}>{donnees.entrepriseAdresse}</p>
          <p>
            {donnees.entrepriseEmail} · {donnees.entrepriseTelephone}
          </p>
          {donnees.numeroIde && (
            <p>
              {donnees.libelleIdentifiant} : {donnees.numeroIde}
            </p>
          )}
        </div>
      </header>

      <section className="document-meta">
        <div>
          <h2>{t(CLES_TITRE[donnees.typeDocument])}</h2>
          {donnees.typeDocument === 'rappel' && donnees.rappelNiveau !== undefined && (
            <p>
              <strong>{ordinal(donnees.rappelNiveau)} {t('doc.rappelNiveau')}</strong>
            </p>
          )}
          <p>
            {t('doc.numero')} {donnees.numero}
          </p>
          <p>
            {t('doc.date')} : {donnees.date}
          </p>
          <p>
            {t(donnees.labelEcheance as CleTraduction)} : {donnees.dateEcheance}
          </p>
        </div>
        <div className="document-client">
          <h3>{t('doc.client')}</h3>
          <p>{donnees.clientNom}</p>
          <p style={{ whiteSpace: 'pre-line' }}>{donnees.clientAdresse}</p>
        </div>
      </section>

      {donnees.typeDocument === 'rappel' && (
        <section className="document-avis">
          <p>
            {t('doc.rappelTexte1')}
            {donnees.joursDeRetard !== undefined && donnees.joursDeRetard > 0
              ? ` ${t('doc.rappelDepuis')} ${donnees.joursDeRetard} ${t('doc.rappelJours')}`
              : ''}
            . {t('doc.rappelTexte2')}
          </p>
          <p>{t('doc.rappelTexte3')}</p>
        </section>
      )}

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
          {donnees.lignes.map((ligne, index) => (
            <tr key={index}>
              <td>{ligne.designation}</td>
              <td>{ligne.quantite}</td>
              <td>{formaterMontant(ligne.prixUnitaire, donnees.pays)}</td>
              <td>{formaterMontant(ligne.total, donnees.pays)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="document-totaux">
        <p>
          {t('doc.sousTotal')} : {formaterMontant(donnees.sousTotal, donnees.pays)}
        </p>
        {donnees.remisePct > 0 && (
          <p>
            {t('doc.remise')} : {donnees.remisePct}%
          </p>
        )}
        {/* La ligne de taxe n'apparaît que si l'entreprise y est assujettie. */}
        {donnees.assujettiTva && (
          <p>
            {donnees.nomTaxe} ({donnees.tvaPct}%) :{' '}
            {formaterMontant(donnees.montantTva, donnees.pays)}
          </p>
        )}
        <p className="document-total-final">
          {t(donnees.labelTotal as CleTraduction)} : {formaterMontant(donnees.total, donnees.pays)}
        </p>
        {donnees.mentionNonAssujetti && (
          <p className="document-mention-legale">{donnees.mentionNonAssujetti}</p>
        )}
      </section>

      {donnees.typeDocument !== 'devis' && (
        <section className="document-paiement">
          <p>IBAN : {donnees.iban}</p>
          <p>
            {t('doc.titulaire')} : {donnees.titulaireCompte}
          </p>
        </section>
      )}

      {donnees.conditionsGenerales.trim() && (
        <section className="document-conditions">
          <h3>{t('doc.conditionsGenerales')}</h3>
          <p style={{ whiteSpace: 'pre-line' }}>{donnees.conditionsGenerales}</p>
        </section>
      )}

      <footer className="document-pied">
        {donnees.mentionsPied.trim() && (
          <p style={{ whiteSpace: 'pre-line' }}>{donnees.mentionsPied}</p>
        )}
        <p>
          {t('doc.codeVerification')} : {donnees.codeVerification}
        </p>
      </footer>
    </div>
  )
}
