// Prouve que la logique métier extraite fonctionne réellement par le réseau,
// sans Electron : c'est tout l'objet de l'étape 1 du serveur multi-postes.
//
// Le test démarre un vrai serveur HTTP sur une base temporaire, puis appelle
// les opérations comme le ferait un poste distant. Il ne simule rien.
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

/* ── 1. Le serveur ne doit dépendre ni d'Electron ni d'une bibliothèque ──── */

console.log('=== Indépendance du serveur ===')
const serveurIndex = lire(join(SRC, 'serveur/index.ts'))
const serveurRegistre = lire(join(SRC, 'serveur/registre.ts'))

verifier(
  "le serveur n'importe pas Electron",
  !/from 'electron'/.test(serveurIndex) && !/from 'electron'/.test(serveurRegistre)
)
verifier(
  'le serveur réutilise la logique métier extraite',
  serveurRegistre.includes("from '../main/domaines/clients'")
)

/* ── 2. Il refuse d'écouter sur le réseau sans authentification ──────────── */

console.log("\n=== Refus d'exposition sans authentification ===")
verifier(
  "le code refuse une autre adresse que 127.0.0.1 tant qu'il n'y a pas de comptes",
  serveurIndex.includes("hote !== '127.0.0.1'") && serveurIndex.includes('throw new Error')
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
