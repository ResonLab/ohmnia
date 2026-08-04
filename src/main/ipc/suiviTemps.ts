import { ipcMain } from 'electron'
import { dansUneTransaction, getDb } from '../db/database'
import { tracerAudit } from '../db/audit'
import type { Intervention } from '../../shared/types'

interface LigneIntervention {
  id: number
  description: string
  client_id: number | null
  client_nom: string | null
  debut: string
  fin: string | null
  secondes_ecoulees: number
  facture_id: number | null
  taux_horaire: number | null
}

function versIntervention(ligne: LigneIntervention): Intervention {
  return {
    id: ligne.id,
    description: ligne.description,
    clientId: ligne.client_id,
    clientNom: ligne.client_nom,
    debut: ligne.debut,
    fin: ligne.fin,
    secondesEcoulees: ligne.secondes_ecoulees,
    factureId: ligne.facture_id,
    tauxHoraire: ligne.taux_horaire
  }
}

const REQUETE_BASE = `
  SELECT s.*, c.nom AS client_nom
  FROM suivi_temps s
  LEFT JOIN clients c ON c.id = s.client_id
`

function chargerIntervention(id: number): Intervention {
  const ligne = getDb()
    .prepare(`${REQUETE_BASE} WHERE s.id = ?`)
    .get(id) as unknown as LigneIntervention | undefined
  if (!ligne) throw new Error("Cette intervention n'existe pas.")
  return versIntervention(ligne)
}

export function enregistrerHandlersSuiviTemps(): void {
  ipcMain.handle('suiviTemps:lister', () => {
    const lignes = getDb()
      .prepare(`${REQUETE_BASE} ORDER BY s.debut DESC`)
      .all() as unknown as LigneIntervention[]
    return lignes.map(versIntervention)
  })

  /** Intervention en cours (chrono lancé) s'il y en a une. */
  ipcMain.handle('suiviTemps:enCours', () => {
    const ligne = getDb()
      .prepare(`${REQUETE_BASE} WHERE s.fin IS NULL ORDER BY s.debut DESC LIMIT 1`)
      .get() as unknown as LigneIntervention | undefined
    return ligne ? versIntervention(ligne) : null
  })

  ipcMain.handle('suiviTemps:demarrer', (_e, description: string, clientId: number | null) => {
    // Un seul chrono à la fois : cela évite des durées qui se chevauchent.
    const dejaEnCours = getDb().prepare('SELECT id FROM suivi_temps WHERE fin IS NULL').get()
    if (dejaEnCours) {
      throw new Error('Une intervention est déjà en cours. Arrête-la avant d\'en démarrer une autre.')
    }

    const resultat = getDb()
      .prepare("INSERT INTO suivi_temps (description, client_id, debut) VALUES (?, ?, datetime('now'))")
      .run(description, clientId)
    return chargerIntervention(Number(resultat.lastInsertRowid))
  })

  ipcMain.handle('suiviTemps:arreter', (_e, id: number) => {
    const ligne = getDb().prepare('SELECT debut, fin FROM suivi_temps WHERE id = ?').get(id) as
      | { debut: string; fin: string | null }
      | undefined
    if (!ligne) throw new Error("Cette intervention n'existe pas.")
    if (ligne.fin) throw new Error('Cette intervention est déjà terminée.')

    // La durée est recalculée côté base pour ne pas dépendre de l'horloge du renderer.
    getDb()
      .prepare(
        `UPDATE suivi_temps
         SET fin = datetime('now'),
             secondes_ecoulees = CAST((julianday('now') - julianday(debut)) * 86400 AS INTEGER)
         WHERE id = ?`
      )
      .run(id)
    return chargerIntervention(id)
  })

  /** Saisie ou correction manuelle d'une intervention (oubli de chrono, ajustement). */
  ipcMain.handle('suiviTemps:modifier', (_e, intervention: Intervention) => {
    if (intervention.secondesEcoulees < 0) throw new Error('La durée ne peut pas être négative.')
    if (intervention.tauxHoraire !== null && intervention.tauxHoraire < 0) {
      throw new Error('Le taux horaire ne peut pas être négatif.')
    }

    getDb()
      .prepare(
        'UPDATE suivi_temps SET description = ?, client_id = ?, secondes_ecoulees = ?, taux_horaire = ? WHERE id = ?'
      )
      .run(
        intervention.description,
        intervention.clientId,
        Math.round(intervention.secondesEcoulees),
        intervention.tauxHoraire,
        intervention.id
      )
    return chargerIntervention(intervention.id)
  })

  ipcMain.handle('suiviTemps:supprimer', (_e, id: number) => {
    getDb().prepare('DELETE FROM suivi_temps WHERE id = ?').run(id)
  })

  /**
   * Transforme des interventions terminées en lignes de main d'œuvre sur une facture.
   * Les interventions sont marquées comme facturées pour ne pas être facturées deux fois.
   */
  ipcMain.handle(
    'suiviTemps:facturer',
    (_e, ids: number[], factureId: number, tauxHoraireParDefaut: number) => {
      const db = getDb()
      const facture = db.prepare('SELECT numero FROM factures WHERE id = ?').get(factureId) as
        | { numero: string }
        | undefined
      if (!facture) throw new Error("Cette facture n'existe pas.")
      if (ids.length === 0) throw new Error('Aucune intervention sélectionnée.')

      return dansUneTransaction(() => {
        const insererLigne = db.prepare(
          'INSERT INTO facture_lignes (facture_id, designation, reference_inventaire, quantite, prix_unitaire) VALUES (?, ?, NULL, ?, ?)'
        )
        let nbLignes = 0

        for (const id of ids) {
          const ligne = db
            .prepare('SELECT description, secondes_ecoulees, fin, facture_id, taux_horaire FROM suivi_temps WHERE id = ?')
            .get(id) as
            | {
                description: string
                secondes_ecoulees: number
                fin: string | null
                facture_id: number | null
                taux_horaire: number | null
              }
            | undefined
          if (!ligne) continue
          if (!ligne.fin) throw new Error('Une intervention encore en cours ne peut pas être facturée.')
          if (ligne.facture_id) continue // déjà facturée

          const heures = ligne.secondes_ecoulees / 3600
          const taux = ligne.taux_horaire ?? tauxHoraireParDefaut
          insererLigne.run(
            factureId,
            ligne.description || 'Main d\'œuvre',
            Number(heures.toFixed(2)),
            taux
          )
          db.prepare('UPDATE suivi_temps SET facture_id = ? WHERE id = ?').run(factureId, id)
          nbLignes += 1
        }

        tracerAudit('facturation-temps', 'facture', facture.numero, `${nbLignes} intervention(s)`)
        return nbLignes
      })
    }
  )
}
