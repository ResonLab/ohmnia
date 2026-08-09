import { app, ipcMain } from 'electron'
import { choisirFichier, choisirDestination } from '../dialogues'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { executer } from '../multipostes/routeur'
import {
  analyserReleve,
  construireCsvComptable,
  importerMouvements
} from '../domaines/comptabilite'
import type { MouvementBancaire, ResultatImport } from '../../shared/types'

/**
 * Comptabilité, côté données. **Enregistré en mode local seulement** : en
 * multi-postes, ces mêmes canaux sont servis par le serveur.
 * Logique : `../domaines/comptabilite.ts`.
 */
export function enregistrerHandlersComptabilite(): void {
  /**
   * Le CSV lui-même, sans boîte de dialogue. Séparé de `exporterCsv` pour que
   * le contenu puisse venir du serveur en mode multi-postes, l'écriture du
   * fichier restant sur le poste qui exporte.
   */
  ipcMain.handle('comptabilite:construireCsv', (_e, annee: number | null) =>
    construireCsvComptable(annee)
  )

  /** Même découpage : le fichier est lu sur le poste, analysé là où est la base. */
  ipcMain.handle('comptabilite:analyserReleve', (_e, contenu: string, estXml: boolean) =>
    analyserReleve(contenu, estXml)
  )

  ipcMain.handle('comptabilite:importerMouvements', (_e, mouvements: MouvementBancaire[], entreeId: number | null, depenseId: number | null) =>
    importerMouvements(mouvements, entreeId, depenseId)
  )
}

/**
 * Comptabilité, côté poste : choisir un fichier, en écrire un.
 * **Enregistré dans les deux modes** — c'est ce poste-ci qui ouvre la boîte de
 * dialogue, même quand les données sont sur le serveur. Le contenu, lui, passe
 * par `executer()`, qui va le chercher là où il est.
 */
export function enregistrerHandlersComptabilitePoste(): void {
  ipcMain.handle('comptabilite:exporterCsv', async (_e, annee: number | null) => {
    const suffixe = annee === null ? 'tout' : String(annee)
    const resultat = await choisirDestination({
      title: 'Export comptable',
      defaultPath: join(app.getPath('documents'), `ohmnia-comptabilite-${suffixe}.csv`),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (resultat.canceled || !resultat.filePath) return null

    const csv = (await executer('comptabilite:construireCsv', annee)) as string
    writeFileSync(resultat.filePath, csv, 'utf-8')
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

    // Le rapprochement compare le relevé aux écritures déjà enregistrées :
    // il doit donc se faire là où vit le Journal, pas ici.
    const mouvements = (await executer(
      'comptabilite:analyserReleve',
      contenu,
      estXml
    )) as ResultatImport['mouvements']

    return {
      fichier: basename(chemin),
      mouvements,
      format: estXml ? 'CAMT.053' : 'CSV'
    } satisfies ResultatImport
  })
}
