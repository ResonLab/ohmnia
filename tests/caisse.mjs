// La caisse : calcul d'un règlement, puis ventes sur une vraie base.
//
// **Pourquoi cette suite existe.** Colin a demandé le 6 octobre 2026 une vraie
// caisse (espèces, carte, mixte, change, ticket A4). L'argent d'un client se
// trompe au centime près ; cette suite éprouve le vrai code, compilé par esbuild,
// sur une vraie base — y compris les refus qui ne doivent rien écrire.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { build } from 'esbuild'

const PROJET = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(PROJET, 'src')

let echecs = 0
const verifier = (intitule, ok, detail = '') => {
  if (!ok) echecs += 1
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${intitule}${detail ? ` — ${detail}` : ''}`)
}
const leve = (fonction) => {
  try {
    fonction()
    return false
  } catch {
    return true
  }
}

const DOSSIER = join(tmpdir(), 'ohmnia-test-caisse')
rmSync(DOSSIER, { recursive: true, force: true })
mkdirSync(DOSSIER, { recursive: true })

const chargerSqlBrut = {
  name: 'sql-brut',
  setup(constructeur) {
    constructeur.onResolve({ filter: /\.sql\?raw$/ }, (arg) => ({
      path: join(arg.resolveDir, arg.path.replace('?raw', '')),
      namespace: 'sql-brut'
    }))
    constructeur.onLoad({ filter: /.*/, namespace: 'sql-brut' }, (arg) => ({
      contents: `export default ${JSON.stringify(readFileSync(arg.path, 'utf-8'))}`,
      loader: 'js'
    }))
  }
}

const chemin = (p) => JSON.stringify(join(SRC, p).replace(/\\/g, '/'))
const entree = join(DOSSIER, 'entree.ts')
writeFileSync(
  entree,
  `export * from ${chemin('shared/caisse')}
export { definirContexte } from ${chemin('main/contexte')}
export { ouvrirBaseDeDonnees, getDb, fermerBaseDeDonnees } from ${chemin('main/db/database')}
export { lireEntreprise, enregistrerEntreprise } from ${chemin('main/domaines/entreprise')}
export { ajouterArticle } from ${chemin('main/domaines/inventaire')}
export { vendre, lireVente, listerVentes } from ${chemin('main/domaines/caisse')}
`
)
const bundle = join(DOSSIER, 'caisse.mjs')
await build({
  entryPoints: [entree],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['node:*', 'electron'],
  plugins: [chargerSqlBrut],
  logLevel: 'silent'
})
const c = await import('file://' + bundle.replace(/\\/g, '/'))

/* ── 1. Le calcul d'un règlement ─────────────────────────────────────────── */

console.log('=== Calcul du règlement ===')

verifier('12.33 s\'arrondit à 12.35', c.arrondirCinqCentimes(12.33) === 12.35)
verifier('12.32 s\'arrondit à 12.30', c.arrondirCinqCentimes(12.32) === 12.3)
verifier('12.325 s\'arrondit à 12.35', c.arrondirCinqCentimes(12.325) === 12.35)
verifier('zéro reste zéro', c.arrondirCinqCentimes(0) === 0)

const lignes = [{ quantite: 2, prixUnitaire: 10 }]
const sansTaxe = c.calculerTotalCaisse(lignes, false, 0)
verifier(
  'non assujetti : aucune taxe, total = sous-total',
  sansTaxe.sousTotal === 20 && sansTaxe.montantTva === 0 && sansTaxe.total === 20,
  JSON.stringify(sansTaxe)
)
const avecTaxe = c.calculerTotalCaisse(lignes, true, 8.1)
verifier(
  'assujetti à 8.1 % : 1.62 de taxe, 21.62 au total',
  avecTaxe.montantTva === 1.62 && avecTaxe.total === 21.62,
  JSON.stringify(avecTaxe)
)
verifier(
  'assujetti avec un taux à 0 : aucune taxe ajoutée',
  c.calculerTotalCaisse(lignes, true, 0).total === 20
)

const base = {
  total: 12.33,
  partCarte: 0,
  devise: 'CHF',
  deviseEntreprise: 'CHF',
  taux: 1,
  montantRecuEspeces: 20,
  arrondiSuisse: true
}
const especes = c.calculerReglement(base)
verifier(
  'espèces en CHF : 12.33 devient 12.35, arrondi 0.02, rendu 7.65',
  especes.especes === 12.35 && especes.arrondi === 0.02 && especes.rendu === 7.65 && especes.carte === 0,
  JSON.stringify(especes)
)
const sansArrondi = c.calculerReglement({ ...base, arrondiSuisse: false })
verifier(
  'hors CHF : aucun arrondi',
  sansArrondi.especes === 12.33 && sansArrondi.arrondi === 0 && sansArrondi.rendu === 7.67,
  JSON.stringify(sansArrondi)
)
const mixte = c.calculerReglement({ ...base, total: 50.03, partCarte: 30.03, montantRecuEspeces: 20 })
verifier(
  'mixte : la carte reste exacte, seules les espèces s\'arrondissent',
  mixte.carte === 30.03 && mixte.especes === 20 && mixte.arrondi === 0,
  JSON.stringify(mixte)
)
const mixteArrondi = c.calculerReglement({ ...base, total: 50, partCarte: 30.02, montantRecuEspeces: 20 })
verifier(
  'mixte : 19.98 en espèces devient 20.00, la carte garde ses 30.02',
  mixteArrondi.carte === 30.02 && mixteArrondi.especes === 20 && mixteArrondi.arrondi === 0.02,
  JSON.stringify(mixteArrondi)
)
const carteSeule = c.calculerReglement({ ...base, partCarte: 12.33, montantRecuEspeces: 0 })
verifier(
  'carte seule : rien en espèces, pas d\'arrondi, pas de rendu',
  carteSeule.carte === 12.33 && carteSeule.especes === 0 && carteSeule.arrondi === 0 && carteSeule.rendu === 0,
  JSON.stringify(carteSeule)
)
const change = c.calculerReglement({
  ...base,
  total: 40,
  devise: 'EUR',
  taux: 0.95,
  montantRecuEspeces: 45
})
verifier(
  'change : 40 CHF = 42.11 EUR à encaisser, 45 EUR remis, rendu 2.75 CHF',
  change.aEncaisserDeviseRecue === 42.11 && change.rendu === 2.75,
  JSON.stringify(change)
)
const memeDevise = c.calculerReglement({ ...base, taux: 7 })
verifier('devise de l\'entreprise : le taux saisi est ignoré', memeDevise.rendu === 7.65, JSON.stringify(memeDevise))

verifier('refus : part carte négative', leve(() => c.calculerReglement({ ...base, partCarte: -1 })))
verifier('refus : part carte supérieure au total', leve(() => c.calculerReglement({ ...base, partCarte: 13 })))
verifier('refus : espèces remises insuffisantes', leve(() => c.calculerReglement({ ...base, montantRecuEspeces: 10 })))
verifier(
  'refus : taux nul avec une devise étrangère',
  leve(() => c.calculerReglement({ ...base, devise: 'EUR', taux: 0 }))
)
verifier(
  'refus : taux négatif avec une devise étrangère',
  leve(() => c.calculerReglement({ ...base, devise: 'EUR', taux: -1 }))
)
verifier('refus : total nul', leve(() => c.calculerReglement({ ...base, total: 0 })))

/* ── 2. Les tables, et le nom affiché sur les tickets ────────────────────── */

console.log('\n=== Base de données ===')
c.definirContexte({ dossierDonnees: DOSSIER, version: '0.0.0-test' })

// Une base d'avant la caisse : sans ses tables, sans `nom_ticket`.
c.ouvrirBaseDeDonnees()
c.fermerBaseDeDonnees()
const ancienne = new DatabaseSync(join(DOSSIER, 'gestion.sqlite'))
ancienne.exec('PRAGMA foreign_keys = OFF')
for (const table of ['ventes_caisse_paiements', 'ventes_caisse_lignes', 'ventes_caisse']) {
  ancienne.exec(`DROP TABLE IF EXISTS ${table}`)
}
try {
  ancienne.exec('ALTER TABLE entreprise DROP COLUMN nom_ticket')
} catch {
  // Colonne absente : la base est déjà « d'avant ».
}
ancienne.prepare("UPDATE entreprise SET nom = 'Atelier Colin' WHERE id = 1").run()
ancienne.close()

c.ouvrirBaseDeDonnees()
const db = c.getDb()
const colonnes = (table) => new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map((l) => l.name))
const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((l) => l.name))

verifier(
  'les trois tables de la caisse existent',
  ['ventes_caisse', 'ventes_caisse_lignes', 'ventes_caisse_paiements'].every((t) => tables.has(t))
)
verifier('la migration ajoute entreprise.nom_ticket à une ancienne base', colonnes('entreprise').has('nom_ticket'))
verifier("la fiche entreprise n'a rien perdu", c.lireEntreprise().nom === 'Atelier Colin')
verifier("le nom du ticket est vide tant qu'on ne l'a pas réglé", c.lireEntreprise().nomTicket === '')
verifier(
  'les ventes ont les colonnes attendues',
  ['numero', 'date', 'total', 'statut', 'servi_par', 'tva_pct', 'montant_tva'].every((n) => colonnes('ventes_caisse').has(n))
)
verifier(
  'les paiements ont les colonnes attendues',
  ['vente_id', 'mode', 'montant', 'arrondi', 'devise_recue', 'montant_recu', 'taux', 'rendu', 'ecriture_journal_id'].every(
    (n) => colonnes('ventes_caisse_paiements').has(n)
  )
)

c.enregistrerEntreprise({ ...c.lireEntreprise(), nomTicket: 'Colin' })
verifier("le nom du ticket s'enregistre", c.lireEntreprise().nomTicket === 'Colin')
c.enregistrerEntreprise({ ...c.lireEntreprise(), nomTicket: '' })
verifier('et peut être vidé', c.lireEntreprise().nomTicket === '')

/* ── 3. Vendre, sur une vraie base ───────────────────────────────────────── */

console.log('\n=== Vendre ===')

const maintenant = new Date()
const deuxChiffres = (n) => String(n).padStart(2, '0')
const aujourdhui = `${maintenant.getFullYear()}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}`

const reglerEntreprise = (modifs) => c.enregistrerEntreprise({ ...c.lireEntreprise(), ...modifs })
reglerEntreprise({ pays: 'CH', nomTicket: 'Colin', assujettiTva: false, tvaDefautPct: 0 })

const article = (reference, prix, stock) =>
  c.ajouterArticle({
    reference,
    designation: `Article ${reference}`,
    categorie: 'Autre',
    quantiteStock: stock,
    seuilAlerte: 0,
    prixAchatUnitaire: 1,
    prixVenteUnitaire: prix,
    fournisseur: '',
    emplacement: '',
    derniereMaj: ''
  })
article('A1', 10, 5)
article('A2', 50, 10)
article('A3', 12.33, 3)

const stockDe = (reference) => db.prepare('SELECT quantite_stock AS n FROM inventaire WHERE reference = ?').get(reference).n
const nbVentes = () => db.prepare('SELECT COUNT(*) AS n FROM ventes_caisse').get().n
const nbEcritures = () => db.prepare('SELECT COUNT(*) AS n FROM journal').get().n
const ecrituresDe = (numero) =>
  db
    .prepare(
      `SELECT j.type, j.montant, c.libelle AS categorie FROM journal j
       JOIN categories_journal c ON c.id = j.categorie_id
       WHERE j.description LIKE ? ORDER BY j.id`
    )
    .all(`%${numero}%`)
const demande = (lignesVente, reste = {}) => ({
  lignes: lignesVente.map(([referenceInventaire, quantite]) => ({ referenceInventaire, quantite })),
  partCarte: 0,
  deviseRecue: 'CHF',
  taux: 1,
  montantRecuEspeces: 0,
  ...reste
})

const v1 = c.vendre(demande([['A1', 2]], { montantRecuEspeces: 20 }))
verifier('première vente : numéro T-0001', v1.numero === 'T-0001', v1.numero)
verifier('le stock baisse de la quantité vendue', stockDe('A1') === 3, String(stockDe('A1')))
verifier(
  'un seul paiement, en espèces, de 20',
  v1.paiements.length === 1 && v1.paiements[0].mode === 'Espèces' && v1.paiements[0].montant === 20 && v1.total === 20
)
verifier(
  'une écriture « Entrée » au Journal, catégorie Caisse – espèces',
  JSON.stringify(ecrituresDe('T-0001')) ===
    JSON.stringify([{ type: 'Entrée', montant: 20, categorie: 'Caisse – espèces' }]),
  JSON.stringify(ecrituresDe('T-0001'))
)
verifier('« Servi par » vient du réglage de l\'entreprise', v1.serviPar === 'Colin')
verifier('la date de la vente est celle du jour', v1.date.startsWith(aujourdhui), v1.date)
verifier(
  'l\'audit garde la trace de la vente',
  db.prepare("SELECT COUNT(*) AS n FROM journal_audit WHERE entite = 'vente_caisse' AND reference = 'T-0001'").get().n === 1
)

const v2 = c.vendre(demande([['A1', 1]], { partCarte: 10 }))
verifier('deuxième vente : T-0002, payée par carte', v2.numero === 'T-0002' && v2.paiements[0].mode === 'Carte')
verifier(
  'la carte entre au Journal dans sa propre catégorie',
  JSON.stringify(ecrituresDe('T-0002')) === JSON.stringify([{ type: 'Entrée', montant: 10, categorie: 'Caisse – carte' }])
)

const v3 = c.vendre(demande([['A2', 1]], { partCarte: 30, montantRecuEspeces: 20 }))
verifier(
  'vente mixte : deux paiements, deux écritures',
  v3.paiements.length === 2 &&
    JSON.stringify(ecrituresDe(v3.numero)) ===
      JSON.stringify([
        { type: 'Entrée', montant: 30, categorie: 'Caisse – carte' },
        { type: 'Entrée', montant: 20, categorie: 'Caisse – espèces' }
      ]),
  JSON.stringify(ecrituresDe(v3.numero))
)

const v4 = c.vendre(demande([['A1', 6]], { partCarte: 60 }))
verifier('stock insuffisant : la vente passe, le stock reste à zéro', v4.total === 60 && stockDe('A1') === 0)
verifier(
  'et l\'avertissement le dit',
  v4.avertissements.some((a) => a.includes('Stock insuffisant pour "A1"')),
  JSON.stringify(v4.avertissements)
)

const v5 = c.vendre(demande([['A3', 1]], { montantRecuEspeces: 20 }))
verifier(
  'espèces en CHF : 12.33 → 12.35, arrondi 0.02, rendu 7.65',
  v5.paiements[0].montant === 12.35 && v5.paiements[0].arrondi === 0.02 && v5.paiements[0].rendu === 7.65,
  JSON.stringify(v5.paiements[0])
)
verifier('l\'écriture du Journal porte le montant arrondi', ecrituresDe(v5.numero)[0].montant === 12.35)

const v6 = c.vendre(demande([['A2', 1]], { deviseRecue: 'EUR', taux: 0.95, montantRecuEspeces: 55 }))
verifier(
  'change : 50 CHF payés avec 55 EUR à 0.95 → rendu 2.25 CHF',
  v6.paiements[0].deviseRecue === 'EUR' && v6.paiements[0].montantRecu === 55 && v6.paiements[0].taux === 0.95 && v6.paiements[0].rendu === 2.25,
  JSON.stringify(v6.paiements[0])
)

verifier('une entreprise non assujettie : aucune taxe en base', v1.tvaPct === 0 && v1.montantTva === 0)
reglerEntreprise({ assujettiTva: true, numeroIde: 'CHE-123.456.789 TVA', tvaDefautPct: 8.1 })
const totalTaxe = c.calculerTotalCaisse([{ quantite: 1, prixUnitaire: 50 }], true, 8.1).total
const v7 = c.vendre(demande([['A2', 1]], { partCarte: totalTaxe }))
verifier(
  'assujettie à 8.1 % : 4.05 de taxe, 54.05 au total, figés dans la vente',
  v7.tvaPct === 8.1 && v7.montantTva === 4.05 && v7.total === 54.05,
  JSON.stringify({ t: v7.tvaPct, m: v7.montantTva, total: v7.total })
)
reglerEntreprise({ assujettiTva: false, numeroIde: '', tvaDefautPct: 0, nomTicket: '' })
const v8 = c.vendre(demande([['A2', 1]], { partCarte: 50 }))
verifier('nom du ticket vidé : « Servi par » est vide', v8.serviPar === '')
reglerEntreprise({ nomTicket: 'Colin' })

const relue = c.lireVente(v3.id)
verifier(
  'une vente relue garde ses lignes et ses paiements',
  relue.numero === v3.numero && relue.lignes.length === 1 && relue.lignes[0].prixUnitaire === 50 && relue.paiements.length === 2
)
const liste = c.listerVentes()
verifier('la liste montre les plus récentes d\'abord', liste.length === 8 && liste[0].numero === 'T-0008', liste.map((v) => v.numero).join(','))
verifier('la liste d\'un jour sans vente est vide', c.listerVentes('2000-01-01').length === 0)
verifier('la liste du jour contient les huit ventes', c.listerVentes(aujourdhui).length === 8)

// Les refus ne doivent rien écrire du tout.
const avant = { ventes: nbVentes(), ecritures: nbEcritures(), stock: stockDe('A2') }
const rienEcrit = () => nbVentes() === avant.ventes && nbEcritures() === avant.ecritures && stockDe('A2') === avant.stock
verifier('refus : panier vide', leve(() => c.vendre(demande([]))) && rienEcrit())
verifier('refus : quantité nulle', leve(() => c.vendre(demande([['A2', 0]], { partCarte: 50 }))) && rienEcrit())
verifier('refus : quantité négative', leve(() => c.vendre(demande([['A2', -1]], { partCarte: 50 }))) && rienEcrit())
verifier('refus : article inconnu', leve(() => c.vendre(demande([['ZZ', 1]], { partCarte: 50 }))) && rienEcrit())
verifier('refus : part carte supérieure au total', leve(() => c.vendre(demande([['A2', 1]], { partCarte: 51 }))) && rienEcrit())
verifier('refus : espèces insuffisantes', leve(() => c.vendre(demande([['A2', 1]], { montantRecuEspeces: 10 }))) && rienEcrit())
verifier(
  'refus : taux nul avec une devise étrangère',
  leve(() => c.vendre(demande([['A2', 1]], { deviseRecue: 'EUR', taux: 0, montantRecuEspeces: 99 }))) && rienEcrit()
)

// Un exercice clôturé refuse la vente en entier : ni stock, ni vente, ni écriture.
db.prepare('INSERT INTO exercices_clotures (annee) VALUES (?)').run(maintenant.getFullYear())
verifier(
  'exercice clôturé : la vente est refusée en entier',
  leve(() => c.vendre(demande([['A2', 1]], { partCarte: 50 }))) && rienEcrit()
)
db.prepare('DELETE FROM exercices_clotures WHERE annee = ?').run(maintenant.getFullYear())

// Une panne en cours de route, après que le stock et le Journal ont été écrits :
// c'est elle qui prouve que la transaction annule vraiment tout.
db.exec("CREATE TRIGGER panne_test BEFORE INSERT ON ventes_caisse_paiements BEGIN SELECT RAISE(ABORT, 'panne'); END")
verifier(
  'panne après les écritures : tout est annulé (vente, stock, Journal)',
  leve(() => c.vendre(demande([['A2', 1]], { partCarte: 50 }))) && rienEcrit()
)
db.exec('DROP TRIGGER panne_test')
verifier(
  'et la vente suivante reprend le bon numéro, sans trou',
  c.vendre(demande([['A2', 1]], { partCarte: 50 })).numero === 'T-0009'
)

console.log(echecs === 0 ? '\n  CAISSE : VALIDEE' : `\n  CAISSE : ${echecs} ECHEC(S)`)
process.exit(echecs === 0 ? 0 : 1)
