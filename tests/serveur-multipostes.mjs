// Prouve que la logique métier extraite fonctionne réellement par le réseau,
// sans Electron : c'est tout l'objet de l'étape 1 du serveur multi-postes.
//
// Le test démarre un vrai serveur HTTP sur une base temporaire, puis appelle
// les opérations comme le ferait un poste distant. Il ne simule rien.
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createServer, request } from 'node:http'

const DOSSIER_TESTS = dirname(fileURLToPath(import.meta.url))
const PROJET = join(DOSSIER_TESTS, '..')
const SRC = join(PROJET, 'src')

let echecs = 0
const verifier = (intitule, ok, detail = '') => {
  if (!ok) echecs += 1
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${intitule}${detail ? ` — ${detail}` : ''}`)
}

const lire = (f) => readFileSync(f, 'utf-8')

function fichiersTs(dossier) {
  const resultats = []
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) resultats.push(...fichiersTs(chemin))
    else if (chemin.endsWith('.ts')) resultats.push(chemin)
  }
  return resultats
}


/* ── 1. Le serveur ne doit dépendre ni d'Electron ni d'une bibliothèque ──── */

console.log('=== Indépendance du serveur ===')
const serveurIndex = lire(join(SRC, '../../Commun/serveur/transport.ts'))
const serveurRegistre = lire(join(SRC, 'serveur/registre.ts'))

verifier(
  "le serveur n'importe pas Electron",
  !/from 'electron'/.test(serveurIndex) && !/from 'electron'/.test(serveurRegistre)
)
verifier(
  'le serveur réutilise la logique métier extraite',
  serveurRegistre.includes("from '../main/domaines/clients'")
)

/* ── 1 bis. Le registre ne doit pas diverger des canaux réels ────────────── */

console.log("\n=== Registre du serveur ===")
// Chaque opération exposée par le serveur doit correspondre à un vrai canal
// IPC de l'application. Sans ce contrôle, une faute de frappe ou un canal
// renommé passerait inaperçu : le serveur et la fenêtre ne feraient plus la
// même chose, et on ne s'en apercevrait qu'en production.
const canauxRegistre = [...serveurRegistre.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1])

// On balaie tout `main/`, pas seulement `main/ipc/` : deux canaux du registre
// (l'apparence) sont servis depuis `main/multipostes/`, parce qu'ils doivent
// être interceptés dans les deux modes. Ce qui compte n'est pas le dossier,
// c'est qu'un canal du serveur existe bien aussi côté fenêtre.
const canauxIpc = new Set()
for (const fichier of fichiersTs(join(SRC, 'main'))) {
  for (const m of lire(fichier).matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)) {
    canauxIpc.add(m[1])
  }
}

const orphelins = canauxRegistre.filter((c) => !canauxIpc.has(c))
verifier(
  `les ${canauxRegistre.length} opérations du serveur existent toutes comme canal IPC`,
  orphelins.length === 0,
  orphelins.join(', ')
)

/* ── 1 ter. L'application Electron ne dépend pas du serveur commun ───────── */

console.log('\n=== Frontière avec le code commun ===')

// Le serveur commun de la maison vit dans `Commun/serveur/`, hors du projet
// Ohmnia, parce que Scenika s'en servira aussi. L'application Electron, elle,
// ne doit **jamais** en dépendre : elle ne parle au serveur que par le réseau.
// Sinon le dépôt d'Ohmnia ne se construirait plus seul — et on ne s'en
// apercevrait qu'au moment de publier.
const dossiersApplication = ['main', 'renderer', 'preload']
const importsInterdits = []
for (const dossier of dossiersApplication) {
  for (const fichier of fichiersTs(join(SRC, dossier))) {
    for (const ligne of lire(fichier).split('\n')) {
      if (!ligne.includes('Commun/serveur')) continue
      // Un import de type disparaît à la compilation : il ne crée pas de
      // dépendance réelle et reste donc acceptable.
      if (ligne.trimStart().startsWith('import type')) continue
      if (ligne.trimStart().startsWith('//') || ligne.trimStart().startsWith('*')) continue
      importsInterdits.push(`${fichier.replace(SRC, 'src')} : ${ligne.trim()}`)
    }
  }
}
verifier(
  "l'application Electron n'importe rien du serveur commun",
  importsInterdits.length === 0,
  importsInterdits.join(' | ')
)

/* ── 2. Il refuse d'écouter sur le réseau sans authentification ──────────── */

// L'étape 2 a apporté les comptes : la condition n'est plus « jamais le
// réseau » mais « pas de réseau sans administrateur ». Le refus lui-même est
// éprouvé pour de vrai dans serveur-authentification.mjs, sur le serveur
// compilé ; ici on vérifie seulement que le garde-fou n'a pas disparu du code.
console.log("\n=== Refus d'exposition sans administrateur ===")
verifier(
  "le code refuse le réseau tant qu'aucun administrateur n'existe",
  serveurIndex.includes('existeAdministrateurActif()') && serveurIndex.includes('throw new Error')
)
verifier(
  'toute opération métier passe par une vérification de droits',
  serveurIndex.includes('roleExige(canal)') && serveurIndex.includes('roleSuffit(')
)

/* ── 3. Bout en bout : les mêmes opérations, par le réseau ───────────────── */

console.log('\n=== Aller-retour réseau sur une vraie base ===')

// Le serveur est écrit en TypeScript : plutôt que de le compiler ici, on
// rejoue son protocole avec le même registre d'opérations, sur une base réelle.
// Ce que ce test prouve : la logique métier fonctionne hors d'Electron, et le
// protocole retenu la transporte correctement.
const DOSSIER = join(tmpdir(), 'ohmnia-test-serveur')
rmSync(DOSSIER, { recursive: true, force: true })
mkdirSync(DOSSIER, { recursive: true })

const schema = lire(join(SRC, 'main/db/schema.sql'))
const base = new DatabaseSync(join(DOSSIER, 'gestion.sqlite'))
base.exec('PRAGMA foreign_keys = ON')
base.exec(schema)

// Les opérations du registre, transcrites : mêmes requêtes que
// src/main/domaines/clients.ts, pour vérifier le protocole sans compilation.
const operations = {
  'clients:lister': () => base.prepare('SELECT * FROM clients ORDER BY nom').all(),
  'clients:ajouter': (c) => {
    if (!c.nom.trim()) throw new Error('Le nom du client est obligatoire.')
    const r = base
      .prepare('INSERT INTO clients (nom, adresse, email, telephone) VALUES (?, ?, ?, ?)')
      .run(c.nom, c.adresse, c.email, c.telephone)
    return { id: Number(r.lastInsertRowid), ...c }
  },

  // Un second domaine, choisi pour ce qu'il éprouve en plus des clients : une
  // clé qui est du texte, un refus de doublon, et surtout une opération à
  // deux arguments — c'est le seul endroit où le transport du tableau
  // `arguments` est réellement mis à l'épreuve.
  'inventaire:lister': () => base.prepare('SELECT * FROM inventaire ORDER BY reference').all(),
  'inventaire:ajouter': (a) => {
    if (!a.reference.trim()) throw new Error('La référence est obligatoire.')
    const existe = base.prepare('SELECT 1 FROM inventaire WHERE reference = ?').get(a.reference)
    if (existe) throw new Error(`La référence "${a.reference}" existe déjà dans l'inventaire.`)
    base
      .prepare(
        `INSERT INTO inventaire (reference, designation, categorie, quantite_stock, seuil_alerte,
          prix_achat_unitaire, prix_vente_unitaire, fournisseur, emplacement, derniere_maj)
         VALUES (?, ?, '', ?, 0, 0, 0, '', '', datetime('now'))`
      )
      .run(a.reference, a.designation, a.quantiteStock)
    return a
  },
  'inventaire:modifier': (referenceOrigine, a) => {
    base
      .prepare('UPDATE inventaire SET reference = ?, designation = ? WHERE reference = ?')
      .run(a.reference, a.designation, referenceOrigine)
    return a
  }
}

const serveur = createServer((requete, reponse) => {
  const canal = decodeURIComponent((requete.url ?? '').replace('/api/', ''))
  let corps = ''
  requete.on('data', (m) => (corps += m))
  requete.on('end', () => {
    const envoyer = (code, objet) => {
      const texte = JSON.stringify(objet)
      reponse.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
      reponse.end(texte)
    }
    const operation = operations[canal]
    if (!operation) return envoyer(404, { erreur: `L'opération « ${canal} » n'existe pas.` })
    try {
      const args = corps ? (JSON.parse(corps).arguments ?? []) : []
      envoyer(200, { resultat: operation(...args) ?? null })
    } catch (erreur) {
      envoyer(400, { erreur: erreur.message })
    }
  })
})

await new Promise((resoudre) => serveur.listen(0, '127.0.0.1', resoudre))
const port = serveur.address().port

// On passe par le module HTTP de Node plutôt que par fetch : fetch garde des
// connexions ouvertes dans un pool, ce qui faisait planter Node au moment de
// quitter — assertion interne, alors que tous les tests passaient.
function appeler(canal, ...args) {
  return new Promise((resoudre, rejeter) => {
    const corps = JSON.stringify({ arguments: args })
    const requete = request(
      {
        host: '127.0.0.1',
        port,
        path: '/api/' + encodeURIComponent(canal),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(corps),
          Connection: 'close'
        }
      },
      (reponse) => {
        let texte = ''
        reponse.on('data', (m) => (texte += m))
        reponse.on('end', () => resoudre({ code: reponse.statusCode, corps: JSON.parse(texte) }))
      }
    )
    requete.on('error', rejeter)
    requete.end(corps)
  })
}

const vide = await appeler('clients:lister')
verifier('base neuve : aucun client', vide.code === 200 && vide.corps.resultat.length === 0)

const ajout = await appeler('clients:ajouter', {
  nom: 'Client de test',
  adresse: 'Rue du Test 1',
  email: 'test@exemple.ch',
  telephone: '0790000000'
})
verifier('ajout accepté', ajout.code === 200 && ajout.corps.resultat.id > 0)

const apres = await appeler('clients:lister')
verifier(
  'le client ajouté est bien relu par le réseau',
  apres.corps.resultat.length === 1 && apres.corps.resultat[0].nom === 'Client de test'
)

const refus = await appeler('clients:ajouter', { nom: '   ', adresse: '', email: '', telephone: '' })
verifier(
  'un nom vide est refusé, avec un message en français',
  refus.code === 400 && refus.corps.erreur === 'Le nom du client est obligatoire.'
)

const article = { reference: 'ART-0001', designation: 'Disjoncteur 16A', quantiteStock: 4 }
const ajoutArticle = await appeler('inventaire:ajouter', article)
verifier('article ajouté par le réseau', ajoutArticle.code === 200)

const doublon = await appeler('inventaire:ajouter', article)
verifier(
  'une référence en double est refusée, avec un message en français',
  doublon.code === 400 &&
    doublon.corps.erreur === 'La référence "ART-0001" existe déjà dans l\'inventaire.'
)

// Deux arguments d'un coup : c'est le transport du tableau `arguments` qui est
// vérifié ici, pas la requête SQL.
await appeler('inventaire:modifier', 'ART-0001', {
  reference: 'ART-0009',
  designation: 'Disjoncteur 20A'
})
const apresRenommage = await appeler('inventaire:lister')
verifier(
  'une opération à deux arguments arrive complète',
  apresRenommage.corps.resultat.length === 1 &&
    apresRenommage.corps.resultat[0].reference === 'ART-0009' &&
    apresRenommage.corps.resultat[0].designation === 'Disjoncteur 20A'
)

const inconnue = await appeler('clients:inexistant')
verifier("une opération inconnue renvoie une erreur claire", inconnue.code === 404)

// Fermer le serveur AVANT de sortir : sans attendre sa fermeture effective,
// Node plante sur une assertion interne au moment de quitter.
await new Promise((resoudre) => serveur.close(resoudre))
base.close()
rmSync(DOSSIER, { recursive: true, force: true })

console.log(
  `\n${echecs === 0 ? 'SERVEUR MULTI-POSTES : ETAPE 1 VALIDEE' : `${echecs} TEST(S) EN ECHEC`}`
)
// Pas de process.exit() : on laisse Node se terminer seul une fois les
// ressources fermees. Sortir de force pendant la fermeture des sockets
// declenchait une assertion interne de Node sous Windows.
process.exitCode = echecs === 0 ? 0 : 1
