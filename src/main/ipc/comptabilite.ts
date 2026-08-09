import { app, ipcMain } from 'electron'
import { choisirFichier, choisirDestination } from '../dialogues'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { tracerAudit } from '../db/audit'
import {
  analyserReleve,
  construireCsvComptable,
  importerMouvements
} from '../domaines/comptabilite'
import type { MouvementBancaire, ResultatImport } from '../../shared/types'

/**
 * Branchement de la comptabilité sur la fenêtre.
 * Logique : `../domaines/comptabilite.ts`. Ne reste ici que le choix du fichier
 * à lire et de l'endroit où écrire l'export — deux boîtes de dialogue.
 */
export function enregistrerHandlersComptabilite(): void {
  ipcMain.handle('comptabilite:exporterCsv', async (_e, annee: number | null) => {
    const suffixe = annee === null ? 'tout' : String(annee)
    const resultat = await choisirDestination({
      title: 'Export comptable',
      defaultPath: join(app.getPath('documents'), `ohmnia-comptabilite-${suffixe}.csv`),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (resultat.canceled || !resultat.filePath) return null

    writeFileSync(resultat.filePath, construireCsvComptable(annee), 'utf-8')
    tracerAudit('export', 'comptabilite', suffixe, resultat.filePath)
    return resultat.filePath
  })

  ipcMain.handle('comptabilite:choisirReleve', async () => {
    const resultat = await choisirFichier({
      title: 'Choisir un relevé bancaire',
      filters: [{ name: 'Relevés (CSV, CAMT.053)', extensions: ['csv', 'xml', 'tsv', 'txt'] }],
      properties: ['openFile']
    })
    if (resultat.canceled || resultat.filePaths.length === 0) return null

    const chemin = resultat.filePaths[0]
    const contenu = readFileSync(chemin, 'utf-8')
    const estXml = extname(chemin).toLowerCase() === '.xml' || contenu.includes('<Document')

    return {
      fichier: basename(chemin),
      mouvements: analyserReleve(contenu, estXml),
      format: estXml ? 'CAMT.053' : 'CSV'
    } satisfies ResultatImport
  })

  ipcMain.handle('comptabilite:importerMouvements', (_e, mouvements: MouvementBancaire[], entreeId: number | null, depenseId: number | null) =>
    importerMouvements(mouvements, entreeId, depenseId)
  )
}
