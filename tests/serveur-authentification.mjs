// Comptes, droits et authentification du serveur multi-postes (étape 2).
//
// Contrairement à `serveur-multipostes.mjs`, ce test ne transcrit rien : il
// compile le vrai `src/serveur/index.ts` avec esbuild et fait de vrais appels
// réseau dessus. C'est le seul moyen de vérifier une authentification — une
// version réécrite pour le test prouverait seulement que la réécriture est
// juste, ce qui n'intéresse personne.
import { readFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { request } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const DOSSIER_TESTS = dirname(fileURLToPath(import.meta.url))
const PROJET = join(DOSSIER_TESTS, '..')
const SRC = join(PROJET, 'src')

let echecs = 0
function verifier(intitule, condition, detail = '') {
  if (!condition) echecs += 1
  console.log(`  ${condition ? 'OK  ' : 'ECHEC'} ${intitule}`)
  if (!condition && detail) console.log(`        ${detail}`)
}

/* ── 1. La politique de droits couvre exactement le registre ─────────────── */

console.log('\n=== Politique de droits ===')

const registre = readFileSync(join(SRC, 'serveur/registre.ts'), 'utf-8')
const droitsSource = readFileSync(join(SRC, 'serveur/droits.ts'), 'utf-8')

const canauxRegistre = [...registre.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1])
const canauxDroits = [...droitsSource.matchAll(/^\s*'([^']+)':\s*'(\w+)'/gm)].map((m) => m[1])

const sansDroit = canauxRegistre.filter((c) => !canauxDroits.includes(c))
verifier(
  `les ${canauxRegistre.length} opérations du registre ont toutes un droit déclaré`,
  sansDroit.length === 0,
  sansDroit.join(', ')
)

const droitOrphelin = canauxDroits.filter((c) => !canauxRegistre.includes(c))
verifier(
  'aucun droit ne porte sur une opération qui n’existe plus',
  droitOrphelin.length === 0,
  droitOrphelin.join(', ')
)

/* ── 2. Compilation du vrai serveur ──────────────────────────────────────── */

const DOSSIER = join(tmpdir(), 'ohmnia-test-auth')
rmSync(DOSSIER, { recursive: true, force: true })
mkdirSync(DOSSIER, { recursive: true })

const bundle = join(DOSSIER, 'serveur.mjs')

// `db/database.ts` importe le schéma via `./schema.sql?raw`, une syntaxe propre
// à Vite qu'esbuild ne connaît pas : on la résout à la main.
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

await build({
  entryPoints: [join(SRC, 'serveur/index.ts')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['node:*'],
  plugins: [chargerSqlBrut],
  logLevel: 'silent'
})

const { demarrerServeur } = await import('file://' + bundle.replace(/\\/g, '/'))

/* ── 3. Refus d'ouverture au réseau sans administrateur ──────────────────── */

console.log("\n=== Refus d'exposition sans administrateur ===")

let refusReseau = null
try {
  demarrerServeur({ dossierDonnees: DOSSIER, version: '0.0.0-test', port: 0, hote: '0.0.0.0' })
} catch (erreur) {
  refusReseau = erreur.message
}
verifier(
  'le serveur refuse le réseau tant qu’aucun administrateur n’existe',
  refusReseau !== null && refusReseau.includes('0.0.0.0'),
  refusReseau ?? 'aucune erreur levée'
)

/* ── 4. Bout en bout, sur le vrai serveur ────────────────────────────────── */

console.log('\n=== Aller-retour réseau authentifié ===')

const serveur = demarrerServeur({
  dossierDonnees: DOSSIER,
  version: '0.0.0-test',
  port: 0,
  hote: '127.0.0.1'
})
await new Promise((resoudre) => serveur.on('listening', resoudre))
const port = serveur.address().port

// Module `node:http` et `Connection: close` : `fetch` garde des connexions
// dans un pool, ce qui faisait planter Node au moment de quitter.
function appeler(canal, args = [], jeton = null) {
  return new Promise((resoudre, rejeter) => {
    const corps = JSON.stringify({ arguments: args })
    const entetes = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(corps),
      Connection: 'close'
    }
    if (jeton) entetes.Authorization = `Bearer ${jeton}`

    const requete = request(
      {
        host: '127.0.0.1',
        port,
        path: '/api/' + encodeURIComponent(canal),
        method: 'POST',
        headers: entetes
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

const etat = await appeler('serveur:etat')
verifier('un serveur neuf se déclare non installé', etat.corps.resultat.installe === false)

const sansJeton = await appeler('clients:lister')
verifier('une opération métier sans jeton est refusée (401)', sansJeton.code === 401)

const premier = await appeler('comptes:creerPremierAdministrateur', [
  'patron',
  'motdepasse1',
  'Le patron'
])
verifier(
  'le premier administrateur peut être créé',
  premier.code === 200 && premier.corps.resultat.role === 'administration'
)

const second = await appeler('comptes:creerPremierAdministrateur', ['pirate', 'motdepasse1'])
verifier(
  'un second « premier administrateur » est refusé',
  second.code === 400 && second.corps.erreur.includes('existent déjà')
)

const faible = await appeler('session:ouvrir', ['patron', 'court'])
verifier('un mot de passe faux est refusé', faible.code === 400)
verifier(
  'le message ne dit pas si le compte existe',
  faible.corps.erreur === 'Identifiant ou mot de passe incorrect.',
  faible.corps.erreur
)

const inconnu = await appeler('session:ouvrir', ['personne', 'motdepasse1'])
verifier(
  'un compte inexistant renvoie exactement le même message',
  inconnu.corps.erreur === faible.corps.erreur
)

const connexion = await appeler('session:ouvrir', ['patron', 'motdepasse1'])
verifier('connexion réussie', connexion.code === 200 && connexion.corps.resultat.jeton.length === 64)
const jetonAdmin = connexion.corps.resultat.jeton

const listeAdmin = await appeler('clients:lister', [], jetonAdmin)
verifier('l’administrateur lit les clients', listeAdmin.code === 200)

const ajoutAdmin = await appeler(
  'clients:ajouter',
  [{ nom: 'Client de test', adresse: '', email: '', telephone: '' }],
  jetonAdmin
)
verifier('l’administrateur écrit', ajoutAdmin.code === 200)

const faux = await appeler('clients:lister', [], 'a'.repeat(64))
verifier('un jeton inventé est refusé (401)', faux.code === 401)

/* ── 5. Les droits séparent réellement les rôles ─────────────────────────── */

console.log('\n=== Séparation des rôles ===')

await appeler('comptes:creer', ['stagiaire', 'motdepasse2', 'lecture', 'Stagiaire'], jetonAdmin)
const connexionLecture = await appeler('session:ouvrir', ['stagiaire', 'motdepasse2'])
const jetonLecture = connexionLecture.corps.resultat.jeton

const lectureLit = await appeler('clients:lister', [], jetonLecture)
verifier('le rôle lecture consulte', lectureLit.code === 200)

const lectureEcrit = await appeler(
  'clients:ajouter',
  [{ nom: 'Interdit', adresse: '', email: '', telephone: '' }],
  jetonLecture
)
verifier('le rôle lecture ne peut pas écrire (403)', lectureEcrit.code === 403)

const lectureAdministre = await appeler('comptes:lister', [], jetonLecture)
verifier('le rôle lecture ne peut pas administrer (403)', lectureAdministre.code === 403)

const lectureCloture = await appeler('exercices:cloturer', [2026], jetonLecture)
verifier('le rôle lecture ne peut pas clôturer un exercice (403)', lectureCloture.code === 403)

await appeler('comptes:creer', ['employe', 'motdepasse3', 'ecriture'], jetonAdmin)
const connexionEcriture = await appeler('session:ouvrir', ['employe', 'motdepasse3'])
const jetonEcriture = connexionEcriture.corps.resultat.jeton

const ecritureEcrit = await appeler(
  'clients:ajouter',
  [{ nom: 'Client employé', adresse: '', email: '', telephone: '' }],
  jetonEcriture
)
verifier('le rôle écriture écrit', ecritureEcrit.code === 200)

const ecritureAdministre = await appeler(
  'entreprise:enregistrer',
  [{ nom: 'Pirate' }],
  jetonEcriture
)
verifier(
  "le rôle écriture ne peut pas modifier l'entreprise (403)",
  ecritureAdministre.code === 403
)

/* ── 6. Le dernier administrateur ne peut pas se retirer ─────────────────── */

console.log('\n=== Garde-fou du dernier administrateur ===')

const retrait = await appeler('comptes:changerRole', ['patron', 'lecture'], jetonAdmin)
verifier(
  'rétrograder le dernier administrateur est refusé',
  retrait.code === 400 && retrait.corps.erreur.includes('dernier administrateur')
)

const desactivation = await appeler('comptes:desactiver', ['patron'], jetonAdmin)
verifier(
  'désactiver le dernier administrateur est refusé',
  desactivation.code === 400 && desactivation.corps.erreur.includes('dernier administrateur')
)

/* ── 7. Fermeture de session ─────────────────────────────────────────────── */

console.log('\n=== Fermeture de session ===')

const fermeture = await appeler('session:fermer', [], jetonEcriture)
verifier('la session se ferme', fermeture.code === 200)

const apresFermeture = await appeler('clients:lister', [], jetonEcriture)
verifier('le jeton ne vaut plus rien après fermeture (401)', apresFermeture.code === 401)

/* ── 8. Le journal des accès a bien enregistré ───────────────────────────── */

console.log('\n=== Journal des accès ===')

const acces = await appeler('acces:lister', [50], jetonAdmin)
const lignes = acces.corps.resultat
verifier(
  'les refus de droits sont tracés',
  lignes.some((l) => l.resultat === 'refus' && l.identifiant === 'stagiaire')
)
verifier(
  'les échecs de connexion sont tracés',
  lignes.some((l) => l.canal === 'session:ouvrir' && l.resultat === 'echec')
)
verifier(
  'les lectures ne sont pas tracées',
  !lignes.some((l) => l.canal === 'clients:lister')
)

/* ── 9. Le martèlement de mots de passe finit par bloquer ────────────────── */

console.log('\n=== Blocage après tentatives répétées ===')

// Cinq échecs consécutifs sur le même compte. Le sixième doit être bloqué
// même si le mot de passe est le bon : sans cela, un attaquant a tout son
// temps pour essayer un dictionnaire.
let dernierRefus = null
for (let i = 0; i < 5; i += 1) {
  dernierRefus = await appeler('session:ouvrir', ['stagiaire', 'mauvaispassword9'])
}
verifier('les cinq premiers échecs restent des refus ordinaires', dernierRefus.code === 400)

const bonMotDePasse = await appeler('session:ouvrir', ['stagiaire', 'motdepasse2'])
verifier(
  'le bon mot de passe est refusé pendant le blocage',
  bonMotDePasse.code === 400 && bonMotDePasse.corps.erreur.includes('bloqué'),
  bonMotDePasse.corps.erreur
)

// Un administrateur doit pouvoir débloquer sans attendre le délai.
await appeler('comptes:reactiver', ['stagiaire'], jetonAdmin)
const apresDeblocage = await appeler('session:ouvrir', ['stagiaire', 'motdepasse2'])
verifier('un administrateur peut débloquer le compte', apresDeblocage.code === 200)

// Fermer le serveur AVANT de sortir : sans attendre sa fermeture effective,
// Node plante sur une assertion interne au moment de quitter.
await new Promise((resoudre) => serveur.close(resoudre))

console.log(
  echecs === 0
    ? '\nAUTHENTIFICATION : ETAPE 2 VALIDEE'
    : `\n${echecs} TEST(S) EN ECHEC`
)
process.exitCode = echecs === 0 ? 0 : 1
