// L'agenda : dates et totaux, puis événements, locations, disponibilité et facture sur une vraie base.
//
// **Pourquoi cette suite existe.** Colin a demandé le 6 octobre 2026 un agenda pour ses événements
// et pour ses locations de matériel, en plusieurs exemplaires. Deux erreurs coûtent cher ici et
// ne se voient pas à l'écran : un chevauchement de dates mal compté (matériel loué deux fois) et
// une facture de location qui retirerait du stock du matériel qui revient. Cette suite éprouve le
// vrai code, compilé par esbuild, sur une vraie base.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
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

const DOSSIER = join(tmpdir(), 'ohmnia-test-agenda')
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
  `export * from ${chemin('shared/agenda')}
export { definirContexte } from ${chemin('main/contexte')}
export { ouvrirBaseDeDonnees, getDb, fermerBaseDeDonnees } from ${chemin('main/db/database')}
export { ajouterClient, supprimerClient } from ${chemin('main/domaines/clients')}
export { ajouterArticle } from ${chemin('main/domaines/inventaire')}
export { enregistrerEvenement, supprimerEvenement, listerAgenda, lireLocation, enregistrerLocation, changerStatutLocation, disponibiliteArticle } from ${chemin('main/domaines/agenda')}
`
)
const bundle = join(DOSSIER, 'agenda.mjs')
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
const a = await import('file://' + bundle.replace(/\\/g, '/'))

/* ── 1. Dates, chevauchements, totaux, grille ────────────────────────────── */

console.log('=== Calculs de l\'agenda ===')

verifier('un seul jour compte pour 1', a.nombreDeJours('2026-10-10', '2026-10-10') === 1)
verifier('du 10 au 12, bornes comprises : 3 jours', a.nombreDeJours('2026-10-10', '2026-10-12') === 3)
verifier('à cheval sur deux mois : du 30 octobre au 2 novembre = 4 jours', a.nombreDeJours('2026-10-30', '2026-11-02') === 4)
verifier('passage à l\'heure d\'été : du 28 au 30 mars = 3 jours', a.nombreDeJours('2026-03-28', '2026-03-30') === 3)
verifier('fin avant début : refusé', leve(() => a.nombreDeJours('2026-10-12', '2026-10-10')))
verifier('date mal formée : refusé', leve(() => a.nombreDeJours('abc', '2026-10-10')))

const p = (debut, fin) => ({ debut: `2026-10-${debut}`, fin: `2026-10-${fin}` })
verifier('qui finit le 12 et commence le 12 : se chevauchent', a.periodesSeChevauchent(p('10', '12'), p('12', '14')) === true)
verifier('qui finit le 12 et commence le 13 : ne se chevauchent pas', a.periodesSeChevauchent(p('10', '12'), p('13', '14')) === false)
verifier('une période incluse dans l\'autre : se chevauchent', a.periodesSeChevauchent(p('10', '12'), p('11', '11')) === true)
verifier('une période qui en contient une autre : se chevauchent', a.periodesSeChevauchent(p('10', '12'), p('09', '13')) === true)

verifier('3 × 12.50 sur 3 jours = 112.50', a.totalLigneLocation({ quantite: 3, prixParJour: 12.5 }, 3) === 112.5)
verifier('2 × 0.10 sur 3 jours = 0.60 (sans erreur de virgule flottante)', a.totalLigneLocation({ quantite: 2, prixParJour: 0.1 }, 3) === 0.6)
verifier(
  'le total d\'une location est la somme des lignes',
  a.totalLocation([{ quantite: 1, prixParJour: 10 }, { quantite: 2, prixParJour: 5 }], 2) === 40
)
verifier('la date courte se lit JJ.MM.AAAA', a.formaterDateCourte('2026-10-08') === '08.10.2026')

const octobre = a.grilleDuMois(2026, 10)
verifier('la grille a 42 jours', octobre.length === 42)
verifier('la grille d\'octobre 2026 commence le lundi 28 septembre', octobre[0] === '2026-09-28', octobre[0])
verifier('et finit le dimanche 8 novembre', octobre[41] === '2026-11-08', octobre[41])
verifier('elle contient le 31 octobre', octobre.includes('2026-10-31'))
verifier('un mois qui commence un lundi commence la grille ce jour-là', a.grilleDuMois(2027, 2)[0] === '2027-02-01')

/* ── 2. Les tables, et le client lié à des locations ─────────────────────── */

console.log('\n=== Base de données ===')
a.definirContexte({ dossierDonnees: DOSSIER, version: '0.0.0-test' })
a.ouvrirBaseDeDonnees()
const db = a.getDb()
const colonnes = (table) => new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map((l) => l.name))

verifier(
  'evenements_agenda a ses colonnes',
  ['titre', 'debut', 'fin', 'lieu', 'notes'].every((n) => colonnes('evenements_agenda').has(n))
)
verifier(
  'locations a ses colonnes',
  ['client_id', 'date_debut', 'date_fin', 'statut', 'notes', 'facture_id'].every((n) => colonnes('locations').has(n))
)
verifier(
  'location_lignes a ses colonnes',
  ['location_id', 'reference_inventaire', 'designation', 'quantite', 'prix_par_jour'].every((n) =>
    colonnes('location_lignes').has(n)
  )
)

const clientA = a.ajouterClient({ nom: 'Client A', adresse: '', email: '', telephone: '' })
db.prepare("INSERT INTO locations (client_id, date_debut, date_fin) VALUES (?, '2026-10-10', '2026-10-12')").run(clientA.id)
verifier(
  'une location neuve est « Réservée » par défaut',
  db.prepare('SELECT statut FROM locations').get().statut === a.STATUT_LOCATION_RESERVEE
)
verifier(
  'un statut inconnu est refusé par la base',
  leve(() => db.prepare("UPDATE locations SET statut = 'Perdue'").run())
)

let message = ''
try {
  a.supprimerClient(clientA.id)
} catch (e) {
  message = e.message
}
verifier('supprimer un client qui a des locations est refusé, avec un message clair', message.toLowerCase().includes('location'), message)
verifier(
  'et ce client existe toujours',
  db.prepare('SELECT COUNT(*) AS n FROM clients WHERE id = ?').get(clientA.id).n === 1
)
db.exec('DELETE FROM locations') // la suite repart d'un agenda sans location
const clientB = a.ajouterClient({ nom: 'Client B', adresse: '', email: '', telephone: '' })
a.supprimerClient(clientB.id)
verifier(
  'un client sans rien est supprimé',
  db.prepare('SELECT COUNT(*) AS n FROM clients WHERE id = ?').get(clientB.id).n === 0
)

/* ── 3. Les événements ───────────────────────────────────────────────────── */

console.log('\n=== Événements ===')

const nbEvenements = () => db.prepare('SELECT COUNT(*) AS n FROM evenements_agenda').get().n
const evenement = (valeurs = {}) => ({
  id: 0,
  titre: 'Salon du matériel',
  debut: '2026-10-20 18:00',
  fin: '2026-10-20 22:00',
  lieu: 'Halle 3',
  notes: 'Apporter les câbles',
  ...valeurs
})

const e1 = a.enregistrerEvenement(evenement())
verifier('un événement créé reçoit un identifiant', e1.id > 0)
verifier(
  'il est relu à l\'identique',
  e1.titre === 'Salon du matériel' && e1.debut === '2026-10-20 18:00' && e1.fin === '2026-10-20 22:00' && e1.lieu === 'Halle 3' && e1.notes === 'Apporter les câbles'
)
verifier(
  'il apparaît dans la liste du mois',
  a.listerAgenda('2026-10-01', '2026-10-31').evenements.some((e) => e.id === e1.id)
)
verifier('la liste des locations est vide tant qu\'il n\'y en a pas', a.listerAgenda('2026-10-01', '2026-10-31').locations.length === 0)

const modifie = a.enregistrerEvenement({ ...e1, titre: 'Salon (déplacé)', fin: '2026-10-20 23:30' })
verifier('modifier un événement le met à jour sans en créer un autre', modifie.id === e1.id && modifie.titre === 'Salon (déplacé)' && modifie.fin === '2026-10-20 23:30' && nbEvenements() === 1)

const cheval = a.enregistrerEvenement(evenement({ titre: 'Soirée', debut: '2026-10-31 20:00', fin: '2026-11-01 02:00' }))
verifier('un événement à cheval sur la fin du mois est dans octobre', a.listerAgenda('2026-10-01', '2026-10-31').evenements.some((e) => e.id === cheval.id))
verifier('et dans novembre', a.listerAgenda('2026-11-01', '2026-11-30').evenements.some((e) => e.id === cheval.id))
verifier('mais pas en décembre', !a.listerAgenda('2026-12-01', '2026-12-31').evenements.some((e) => e.id === cheval.id))
verifier('les événements sont triés par début', a.listerAgenda('2026-10-01', '2026-11-30').evenements.map((e) => e.id).join() === `${e1.id},${cheval.id}`)

const avant = nbEvenements()
verifier('refus : titre vide', leve(() => a.enregistrerEvenement(evenement({ titre: '   ' }))) && nbEvenements() === avant)
verifier('refus : fin avant début', leve(() => a.enregistrerEvenement(evenement({ debut: '2026-10-20 22:00', fin: '2026-10-20 18:00' }))) && nbEvenements() === avant)
verifier('refus : date sans heure', leve(() => a.enregistrerEvenement(evenement({ debut: '2026-10-20' }))) && nbEvenements() === avant)
verifier('refus : date mal formée', leve(() => a.enregistrerEvenement(evenement({ fin: 'demain soir' }))) && nbEvenements() === avant)
verifier('refus : heure impossible', leve(() => a.enregistrerEvenement(evenement({ fin: '2026-10-21 25:00' }))) && nbEvenements() === avant)
verifier('refus : modifier un événement qui n\'existe pas', leve(() => a.enregistrerEvenement(evenement({ id: 9999 }))) && nbEvenements() === avant)

a.supprimerEvenement(cheval.id)
verifier('supprimer retire l\'événement', nbEvenements() === avant - 1 && !a.listerAgenda('2026-10-01', '2026-11-30').evenements.some((e) => e.id === cheval.id))
verifier('supprimer un événement inconnu ne fait rien', !leve(() => a.supprimerEvenement(424242)))
verifier(
  'l\'audit garde la création, la modification et la suppression',
  ['creation', 'modification', 'suppression'].every(
    (action) => db.prepare("SELECT COUNT(*) AS n FROM journal_audit WHERE entite = 'evenement_agenda' AND action = ?").get(action).n >= 1
  )
)

/* ── 4. Les locations et la disponibilité ────────────────────────────────── */

console.log('\n=== Locations ===')

db.exec('DELETE FROM locations') // la ligne de la partie 2 n'avait pas de lignes d'articles
const article = (reference, designation, stock) =>
  a.ajouterArticle({
    reference,
    designation,
    categorie: 'Autre',
    quantiteStock: stock,
    seuilAlerte: 0,
    prixAchatUnitaire: 1,
    prixVenteUnitaire: 100,
    fournisseur: '',
    emplacement: '',
    derniereMaj: ''
  })
article('P1', 'Projecteur LED', 8)
article('P2', 'Enceinte', 2)

const stockDe = (reference) => db.prepare('SELECT quantite_stock AS n FROM inventaire WHERE reference = ?').get(reference).n
const nbLocations = () => db.prepare('SELECT COUNT(*) AS n FROM locations').get().n
const nbLignesLocation = () => db.prepare('SELECT COUNT(*) AS n FROM location_lignes').get().n
const location = (reste = {}) => ({
  id: 0,
  clientId: clientA.id,
  dateDebut: '2026-10-10',
  dateFin: '2026-10-12',
  notes: '',
  lignes: [{ referenceInventaire: 'P1', quantite: 3, prixParJour: 12.5 }],
  ...reste
})

const r1 = a.enregistrerLocation(location())
verifier('une location neuve est « Réservée »', r1.location.statut === a.STATUT_LOCATION_RESERVEE)
verifier('3 jours, bornes comprises', r1.location.jours === 3)
verifier('total : 3 × 12.50 × 3 jours = 112.50', r1.location.total === 112.5, String(r1.location.total))
verifier('la désignation est relue dans l\'inventaire', r1.location.lignes[0].designation === 'Projecteur LED')
verifier('le client est nommé, aucune facture n\'est liée', r1.location.clientNom === 'Client A' && r1.location.factureId === null && r1.location.factureNumero === null)
verifier('aucun avertissement quand le stock suffit', r1.avertissements.length === 0)
verifier('le stock de l\'inventaire est inchangé', stockDe('P1') === 8, String(stockDe('P1')))

const dispo = (reference, debut, fin, exclure) => a.disponibiliteArticle(reference, `2026-10-${debut}`, `2026-10-${fin}`, exclure)
const d1 = dispo('P1', '10', '12')
verifier('disponibilité du 10 au 12 : stock 8, loué 3, disponible 5', d1.stock === 8 && d1.loue === 3 && d1.disponible === 5, JSON.stringify(d1))
verifier('du 13 au 14 : rien de loué', dispo('P1', '13', '14').loue === 0)
verifier('du 12 au 14 : la location finit le 12, elle compte', dispo('P1', '12', '14').loue === 3)
verifier('du 08 au 09 : elle commence le 10, elle ne compte pas', dispo('P1', '08', '09').loue === 0)
verifier('disponibilité d\'un article inconnu : refusée', leve(() => a.disponibiliteArticle('ZZ', '2026-10-10', '2026-10-12')))

const r2 = a.enregistrerLocation(location({ lignes: [{ referenceInventaire: 'P1', quantite: 6, prixParJour: 12.5 }] }))
verifier(
  'dépasser la disponibilité : la location est enregistrée, avec un avertissement',
  nbLocations() === 2 && r2.avertissements.length === 1,
  JSON.stringify(r2.avertissements)
)
verifier(
  'l\'avertissement nomme l\'article, la quantité demandée et la quantité disponible',
  r2.avertissements[0].includes('"P1"') && r2.avertissements[0].includes('6') && r2.avertissements[0].includes('5'),
  r2.avertissements[0]
)

const annulee = a.changerStatutLocation(r1.location.id, a.STATUT_LOCATION_ANNULEE)
verifier('annuler une location change son statut', annulee.statut === a.STATUT_LOCATION_ANNULEE)
verifier('une location annulée ne compte plus : loué 6', dispo('P1', '10', '12').loue === 6)
verifier('en excluant la location qu\'on modifie : loué 0', dispo('P1', '10', '12', r2.location.id).loue === 0)

const reenregistree = a.enregistrerLocation({
  id: r2.location.id,
  clientId: clientA.id,
  dateDebut: '2026-10-10',
  dateFin: '2026-10-12',
  notes: 'modifiée',
  lignes: [{ referenceInventaire: 'P1', quantite: 6, prixParJour: 12.5 }]
})
verifier('modifier une location ne la compte pas contre elle-même : aucun avertissement', reenregistree.avertissements.length === 0, JSON.stringify(reenregistree.avertissements))

a.changerStatutLocation(r2.location.id, a.STATUT_LOCATION_RENDUE)
a.enregistrerLocation({ ...location({ id: r2.location.id, notes: 'encore modifiée' }), lignes: [{ referenceInventaire: 'P1', quantite: 6, prixParJour: 12.5 }] })
verifier('modifier une location ne change pas son statut', a.lireLocation(r2.location.id).statut === a.STATUT_LOCATION_RENDUE)

const locCheval = a.enregistrerLocation(location({ dateDebut: '2026-10-31', dateFin: '2026-11-02', lignes: [{ referenceInventaire: 'P2', quantite: 1, prixParJour: 40 }] }))
verifier('une location à cheval sur deux mois est dans octobre', a.listerAgenda('2026-10-01', '2026-10-31').locations.some((l) => l.id === locCheval.location.id))
verifier('et dans novembre', a.listerAgenda('2026-11-01', '2026-11-30').locations.some((l) => l.id === locCheval.location.id))
verifier('mais pas en décembre', a.listerAgenda('2026-12-01', '2026-12-31').locations.length === 0)
verifier('la liste montre aussi les locations annulées, triées par début', a.listerAgenda('2026-10-01', '2026-10-31').locations.map((l) => l.id).join() === [r1.location.id, r2.location.id, locCheval.location.id].join())

// Les refus ne doivent rien écrire du tout.
const avantLoc = { locations: nbLocations(), lignes: nbLignesLocation() }
const rienEcrit = () => nbLocations() === avantLoc.locations && nbLignesLocation() === avantLoc.lignes
const ligneOk = { referenceInventaire: 'P1', quantite: 1, prixParJour: 10 }
verifier('refus : fin avant début', leve(() => a.enregistrerLocation(location({ dateDebut: '2026-10-12', dateFin: '2026-10-10' }))) && rienEcrit())
verifier('refus : aucune ligne', leve(() => a.enregistrerLocation(location({ lignes: [] }))) && rienEcrit())
verifier('refus : quantité nulle', leve(() => a.enregistrerLocation(location({ lignes: [{ ...ligneOk, quantite: 0 }] }))) && rienEcrit())
verifier('refus : quantité négative', leve(() => a.enregistrerLocation(location({ lignes: [{ ...ligneOk, quantite: -1 }] }))) && rienEcrit())
verifier('refus : prix négatif', leve(() => a.enregistrerLocation(location({ lignes: [{ ...ligneOk, prixParJour: -1 }] }))) && rienEcrit())
verifier('refus : article inconnu', leve(() => a.enregistrerLocation(location({ lignes: [{ ...ligneOk, referenceInventaire: 'ZZ' }] }))) && rienEcrit())
verifier('refus : client inconnu', leve(() => a.enregistrerLocation(location({ clientId: 9999 }))) && rienEcrit())
verifier('refus : modifier une location qui n\'existe pas', leve(() => a.enregistrerLocation(location({ id: 9999 }))) && rienEcrit())
verifier('refus : date mal formée', leve(() => a.enregistrerLocation(location({ dateDebut: 'lundi' }))) && rienEcrit())
verifier('refus : statut inconnu', leve(() => a.changerStatutLocation(r1.location.id, 'Perdue')) && a.lireLocation(r1.location.id).statut === a.STATUT_LOCATION_ANNULEE)
verifier('refus : statut d\'une location inconnue', leve(() => a.changerStatutLocation(9999, a.STATUT_LOCATION_RENDUE)))

// Une panne après l'écriture de l'en-tête : tout doit être annulé, en-tête compris.
db.exec("CREATE TRIGGER panne_test BEFORE INSERT ON location_lignes BEGIN SELECT RAISE(ABORT, 'panne'); END")
verifier('panne en cours d\'enregistrement : tout est annulé, en-tête compris', leve(() => a.enregistrerLocation(location())) && rienEcrit())
db.exec('DROP TRIGGER panne_test')

verifier(
  'l\'audit garde la création et l\'annulation',
  db.prepare("SELECT COUNT(*) AS n FROM journal_audit WHERE entite = 'location' AND action = 'creation'").get().n >= 1 &&
    db.prepare("SELECT COUNT(*) AS n FROM journal_audit WHERE entite = 'location' AND action = 'annulation'").get().n === 1
)

console.log(echecs === 0 ? '\n  AGENDA : VALIDE' : `\n  AGENDA : ${echecs} ECHEC(S)`)
process.exit(echecs === 0 ? 0 : 1)
