import { useEffect, useState } from 'react'
import type { Justificatif } from '../../../shared/types'
import Modale from './Modale'

interface Props {
  journalId: number
  description: string
  onFermer: () => void
  onChangement: () => void
}

export default function Justificatifs({
  journalId,
  description,
  onFermer,
  onChangement
}: Props): React.JSX.Element {
  const [fichiers, setFichiers] = useState<Justificatif[]>([])
  const [apercus, setApercus] = useState<Record<string, string | null>>({})
  const [messageErreur, setMessageErreur] = useState<string | null>(null)

  async function recharger(): Promise<void> {
    const liste = await window.api.justificatifs.lister(journalId)
    setFichiers(liste)

    // Les aperçus sont chargés à la demande : une image par justificatif.
    const nouveauxApercus: Record<string, string | null> = {}
    for (const fichier of liste) {
      nouveauxApercus[fichier.nomFichier] = await window.api.justificatifs.lireDataUrl(fichier.nomFichier)
    }
    setApercus(nouveauxApercus)
  }

  useEffect(() => {
    recharger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalId])

  async function ajouter(): Promise<void> {
    setMessageErreur(null)
    try {
      await window.api.justificatifs.ajouter(journalId)
      await recharger()
      onChangement()
    } catch (erreur) {
      setMessageErreur(erreur instanceof Error ? erreur.message : 'Erreur inconnue.')
    }
  }

  async function supprimer(id: number): Promise<void> {
    if (!window.confirm('Supprimer ce justificatif ? Le fichier sera effacé du disque.')) return
    await window.api.justificatifs.supprimer(id)
    await recharger()
    onChangement()
  }

  return (
    <Modale titre={`Justificatifs — ${description || 'écriture du Journal'}`} onFermer={onFermer}>
      <p>
        Photos de tickets, scans de factures d'achat ou PDF. Les fichiers sont copiés dans le dossier
        de données de l'app, donc inclus dans les sauvegardes.
      </p>

      {fichiers.length === 0 ? (
        <p className="graphique-vide">Aucun justificatif pour cette écriture.</p>
      ) : (
        <div className="grille-justificatifs">
          {fichiers.map((fichier) => {
            const apercu = apercus[fichier.nomFichier]
            const estPdf = fichier.nomFichier.toLowerCase().endsWith('.pdf')
            return (
              <div className="justificatif" key={fichier.id}>
                <button
                  className="justificatif-apercu"
                  title="Ouvrir le fichier"
                  onClick={() => window.api.justificatifs.ouvrir(fichier.nomFichier)}
                >
                  {estPdf || !apercu ? (
                    <span className="justificatif-icone">{estPdf ? 'PDF' : '?'}</span>
                  ) : (
                    <img src={apercu} alt="" />
                  )}
                </button>
                <button className="bouton-danger" onClick={() => supprimer(fichier.id)}>
                  Supprimer
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="barre-boutons">
        <button onClick={ajouter}>Ajouter un justificatif…</button>
      </div>

      {messageErreur && <p className="erreur">{messageErreur}</p>}
    </Modale>
  )
}
