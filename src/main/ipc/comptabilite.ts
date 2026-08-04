import { app, dialog, ipcMain } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { dansUneTransaction, getDb } from '../db/database'
import { tracerAudit } from '../db/audit'
import { calculerMontantTva } from '../../shared/calculs'
import type { MouvementBancaire, ResultatImport } from '../../shared/types'

/** Échappe un champ CSV : guillemets doublés et champ encadré si nécessaire. */
function champCsv(valeur: string | number): string {
  const texte = String(valeur)
  if (/[";\n\r]/.test(texte)) return `"${texte.replace(/"/g, '""')}"`
  return texte
}

/**
 * Export comptable : une ligne par écriture, séparateur point-virgule
 * (attendu par Excel en configuration suisse et par la plupart des logiciels
 * de fiduciaire). Encodé en UTF-8 avec BOM pour que les accents s'affichent.
 */
function construireCsvComptable(annee: number | null): string {
  const conditions = annee === null ? '' : "WHERE CAST(strftime('%Y', j.date) AS INTEGER) = ?"
  const params = annee === null ? [] : [annee]

  const lignes = getDb()
    .prepare(
      `SELECT j.date, j.type, COALESCE(c.libelle, '') AS categorie, j.description,
              j.montant, j.tva_pct, COALESCE(j.numero_facture, '') AS numero_facture,
              j.notes
       FROM journal j
       LEFT JOIN categories_journal c ON c.id = j.categorie_id
       ${conditions}
       ORDER BY j.date, j.id`
    )
    .all(...params) as unknown as {
    date: string
    type: string
    categorie: string
    description: string
    montant: number
    tva_pct: number | null
    numero_facture: string
    notes: string
  }[]

  const entete = [
    'Date',
    'Type',
    'Categorie',
    'Description',
    'Montant CHF',
    'TVA %',
    'Montant TVA CHF',
    'Montant HT CHF',
    'No facture',
    'Notes'
  ]

  const corps = lignes.map((l) => {
    const montantTva = l.tva_pct ? calculerMontantTva(l.montant, l.tva_pct) : 0
    return [
      l.date,
      l.type,
      l.categorie,
      l.description,
      l.montant.toFixed(2),
      l.tva_pct === null ? '' : l.tva_pct.toFixed(2),
      montantTva.toFixed(2),
      (l.montant - montantTva).toFixed(2),
      l.numero_facture,
      l.notes.replace(/\r?\n/g, ' ')
    ]
      .map(champCsv)
      .join(';')
  })

  return '﻿' + [entete.map(champCsv).join(';'), ...corps].join('\r\n') + '\r\n'
}

/** Découpe une ligne CSV en tenant compte des champs entre guillemets. */
function decouperLigneCsv(ligne: string, separateur: string): string[] {
  const champs: string[] = []
  let courant = ''
  let dansGuillemets = false

  for (let i = 0; i < ligne.length; i += 1) {
    const caractere = ligne[i]
    if (caractere === '"') {
      if (dansGuillemets && ligne[i + 1] === '"') {
        courant += '"'
        i += 1
      } else {
        dansGuillemets = !dansGuillemets
      }
    } else if (caractere === separateur && !dansGuillemets) {
      champs.push(courant)
      courant = ''
    } else {
      courant += caractere
    }
  }
  champs.push(courant)
  return champs.map((c) => c.trim())
}

/** Convertit une date de relevé (plusieurs formats courants) en AAAA-MM-JJ. */
function normaliserDate(brut: string): string | null {
  const texte = brut.trim()

  const iso = texte.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // 31.12.2026 ou 31/12/2026 ou 31-12-26
  const europeen = texte.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/)
  if (europeen) {
    const jour = europeen[1].padStart(2, '0')
    const mois = europeen[2].padStart(2, '0')
    const annee = europeen[3].length === 2 ? `20${europeen[3]}` : europeen[3]
    return `${annee}-${mois}-${jour}`
  }
  return null
}

/** Convertit un montant de relevé (1'234.50 / 1 234,50 / -12.30) en nombre. */
function normaliserMontant(brut: string): number | null {
  const nettoye = brut.replace(/['\s ]/g, '').replace(',', '.')
  if (nettoye === '') return null
  const valeur = Number(nettoye)
  return Number.isFinite(valeur) ? valeur : null
}

/**
 * Repère le rôle de chaque colonne d'après la ligne d'en-tête.
 * Indispensable pour ne pas confondre le montant d'un mouvement avec la
 * colonne « Solde », qui suit souvent le montant dans les exports bancaires.
 */
interface ColonnesReleve {
  debit: number
  credit: number
  montant: number
  solde: number
  libelle: number
}

function repererColonnes(champsEntete: string[]): ColonnesReleve {
  const colonnes: ColonnesReleve = { debit: -1, credit: -1, montant: -1, solde: -1, libelle: -1 }

  champsEntete.forEach((champ, index) => {
    // Sans accents ni casse : « Débit » et « DEBIT » sont traités pareil.
    const nom = champ
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')

    if (colonnes.solde === -1 && /solde|balance|saldo/.test(nom)) colonnes.solde = index
    else if (colonnes.debit === -1 && /debit|sortie|charge/.test(nom)) colonnes.debit = index
    else if (colonnes.credit === -1 && /credit|entree|recette/.test(nom)) colonnes.credit = index
    else if (colonnes.montant === -1 && /montant|amount|betrag/.test(nom)) colonnes.montant = index
    else if (
      colonnes.libelle === -1 &&
      /libelle|description|texte|communication|motif|beneficiaire|details|buchungstext/.test(nom)
    ) {
      colonnes.libelle = index
    }
  })

  return colonnes
}

function analyserCsvBancaire(contenu: string): MouvementBancaire[] {
  const lignes = contenu
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
  if (lignes.length === 0) return []

  // Le séparateur est celui qui apparaît le plus souvent sur la première ligne.
  const separateur = (lignes[0].match(/;/g)?.length ?? 0) >= (lignes[0].match(/,/g)?.length ?? 0) ? ';' : ','

  // Une ligne d'en-tête ne contient pas de date exploitable.
  const premiereLigne = decouperLigneCsv(lignes[0], separateur)
  const aUnEntete = !premiereLigne.some((champ) => normaliserDate(champ))
  const colonnes = aUnEntete
    ? repererColonnes(premiereLigne)
    : { debit: -1, credit: -1, montant: -1, solde: -1, libelle: -1 }

  const mouvements: MouvementBancaire[] = []
  for (const ligne of lignes) {
    const champs = decouperLigneCsv(ligne, separateur)
    if (champs.length < 2) continue

    let date: string | null = null
    let indexDate = -1
    for (let i = 0; i < champs.length; i += 1) {
      const candidate = normaliserDate(champs[i])
      if (candidate) {
        date = candidate
        indexDate = i
        break
      }
    }
    if (!date) continue // en-tête, ligne de total ou séparateur

    let montant: number | null = null

    if (colonnes.debit !== -1 || colonnes.credit !== -1) {
      // Colonnes séparées : le débit est une sortie, donc négatif.
      const debit = colonnes.debit === -1 ? null : normaliserMontant(champs[colonnes.debit] ?? '')
      const credit = colonnes.credit === -1 ? null : normaliserMontant(champs[colonnes.credit] ?? '')
      if (credit !== null && credit !== 0) montant = Math.abs(credit)
      else if (debit !== null && debit !== 0) montant = -Math.abs(debit)
    } else if (colonnes.montant !== -1) {
      montant = normaliserMontant(champs[colonnes.montant] ?? '')
    } else {
      // Sans en-tête exploitable : premier nombre après la date, en ignorant
      // la dernière colonne qui est presque toujours le solde courant.
      const derniereColonneUtile = champs.length - 2
      for (let i = indexDate + 1; i <= derniereColonneUtile; i += 1) {
        const candidate = normaliserMontant(champs[i])
        if (candidate !== null && candidate !== 0) {
          montant = candidate
          break
        }
      }
      // Relevé à une seule colonne de montant : on l'accepte alors telle quelle.
      if (montant === null && champs.length - 1 > indexDate) {
        montant = normaliserMontant(champs[champs.length - 1])
      }
    }

    if (montant === null || montant === 0) continue

    const libelle =
      colonnes.libelle !== -1 && champs[colonnes.libelle]
        ? champs[colonnes.libelle]
        : champs
            .filter((_, i) => i !== indexDate && i !== colonnes.solde)
            .filter((c) => normaliserMontant(c) === null && c !== '')
            .join(' — ')

    mouvements.push({
      date,
      libelle: libelle.slice(0, 200),
      montant,
      dejaRapproche: false,
      ecritureExistanteId: null
    })
  }
  return mouvements
}

/**
 * Lecture CAMT.053 (relevé bancaire ISO 20022 utilisé par les banques suisses).
 * On lit les balises essentielles sans dépendance XML : montant, sens
 * (crédit/débit), date de valeur et libellé.
 */
function analyserCamt(contenu: string): MouvementBancaire[] {
  const mouvements: MouvementBancaire[] = []
  const blocs = contenu.split(/<Ntry\b[^>]*>/).slice(1)

  for (const bloc of blocs) {
    const corps = bloc.split('</Ntry>')[0]

    const montantBrut = corps.match(/<Amt\b[^>]*>([^<]+)<\/Amt>/)?.[1]
    const sens = corps.match(/<CdtDbtInd>([^<]+)<\/CdtDbtInd>/)?.[1]
    const date =
      corps.match(/<ValDt>\s*<Dt>([^<]+)<\/Dt>/)?.[1] ??
      corps.match(/<BookgDt>\s*<Dt>([^<]+)<\/Dt>/)?.[1]

    if (!montantBrut || !date) continue

    const montantAbsolu = normaliserMontant(montantBrut)
    if (montantAbsolu === null) continue

    // DBIT = débit (sortie d'argent) → montant négatif dans le relevé.
    const montant = sens === 'DBIT' ? -montantAbsolu : montantAbsolu

    const libelle = (
      corps.match(/<Ustrd>([^<]+)<\/Ustrd>/)?.[1] ??
      corps.match(/<AddtlNtryInf>([^<]+)<\/AddtlNtryInf>/)?.[1] ??
      corps.match(/<Nm>([^<]+)<\/Nm>/)?.[1] ??
      'Mouvement bancaire'
    ).slice(0, 200)

    const dateNormalisee = normaliserDate(date)
    if (!dateNormalisee) continue

    mouvements.push({
      date: dateNormalisee,
      libelle,
      montant,
      dejaRapproche: false,
      ecritureExistanteId: null
    })
  }
  return mouvements
}

/** Marque les mouvements déjà présents dans le Journal (même date, même montant). */
function rapprocher(mouvements: MouvementBancaire[]): MouvementBancaire[] {
  const requete = getDb().prepare(
    'SELECT id FROM journal WHERE date = ? AND ABS(montant - ?) < 0.005 LIMIT 1'
  )

  return mouvements.map((mouvement) => {
    const existante = requete.get(mouvement.date, Math.abs(mouvement.montant)) as
      | { id: number }
      | undefined
    return {
      ...mouvement,
      dejaRapproche: existante !== undefined,
      ecritureExistanteId: existante?.id ?? null
    }
  })
}

export function enregistrerHandlersComptabilite(): void {
  ipcMain.handle('comptabilite:exporterCsv', async (_e, annee: number | null) => {
    const suffixe = annee === null ? 'tout' : String(annee)
    const resultat = await dialog.showSaveDialog({
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
    const resultat = await dialog.showOpenDialog({
      title: 'Choisir un relevé bancaire',
      filters: [{ name: 'Relevés (CSV, CAMT.053)', extensions: ['csv', 'xml', 'tsv', 'txt'] }],
      properties: ['openFile']
    })
    if (resultat.canceled || resultat.filePaths.length === 0) return null

    const chemin = resultat.filePaths[0]
    const contenu = readFileSync(chemin, 'utf-8')
    const estXml = extname(chemin).toLowerCase() === '.xml' || contenu.includes('<Document')

    const mouvements = rapprocher(estXml ? analyserCamt(contenu) : analyserCsvBancaire(contenu))
    if (mouvements.length === 0) {
      throw new Error(
        "Aucun mouvement n'a pu être lu dans ce fichier. Vérifie qu'il s'agit bien d'un relevé CSV " +
          'ou CAMT.053 exporté depuis ta banque.'
      )
    }

    return {
      fichier: basename(chemin),
      mouvements,
      format: estXml ? 'CAMT.053' : 'CSV'
    } satisfies ResultatImport
  })

  /** Crée les écritures du Journal pour les mouvements retenus par l'utilisateur. */
  ipcMain.handle(
    'comptabilite:importerMouvements',
    (_e, mouvements: MouvementBancaire[], categorieEntreeId: number | null, categorieDepenseId: number | null) => {
      if (mouvements.length === 0) throw new Error('Aucun mouvement sélectionné.')

      const db = getDb()
      return dansUneTransaction(() => {
        const inserer = db.prepare(
          `INSERT INTO journal (date, type, categorie_id, description, montant, numero_facture, notes, tva_pct)
           VALUES (?, ?, ?, ?, ?, NULL, ?, NULL)`
        )

        let nb = 0
        for (const mouvement of mouvements) {
          const estEntree = mouvement.montant >= 0
          inserer.run(
            mouvement.date,
            estEntree ? 'Entrée' : 'Dépense',
            estEntree ? categorieEntreeId : categorieDepenseId,
            mouvement.libelle || 'Mouvement bancaire',
            Math.abs(mouvement.montant),
            'Importé depuis un relevé bancaire'
          )
          nb += 1
        }

        tracerAudit('import', 'journal', '', `${nb} mouvement(s) bancaire(s)`)
        return nb
      })
    }
  )
}
