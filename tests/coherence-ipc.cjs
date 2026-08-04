// Vérifie la cohérence entre les handlers ipcMain déclarés côté main
// et les canaux invoqués côté preload : tout décalage provoquerait une
// erreur seulement au clic, donc autant le détecter maintenant.
const { readdirSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const { join: joindre } = require('node:path')

// Racine du projet, déduite de l'emplacement de ce fichier.
const DOSSIER_TESTS = __dirname
const PROJET = joindre(DOSSIER_TESTS, '..')


const RACINE = joindre(PROJET, 'src')

function fichiersRecursifs(dossier) {
  const resultats = []
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) resultats.push(...fichiersRecursifs(chemin))
    else if (chemin.endsWith('.ts')) resultats.push(chemin)
  }
  return resultats
}

const handlers = new Set()
const ecouteurs = new Set()
for (const fichier of fichiersRecursifs(join(RACINE, 'main'))) {
  const contenu = readFileSync(fichier, 'utf-8')
  for (const m of contenu.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)) handlers.add(m[1])
  for (const m of contenu.matchAll(/ipcMain\.(?:on|once)\(\s*'([^']+)'/g)) ecouteurs.add(m[1])
}

const preload = readFileSync(join(RACINE, 'preload/index.ts'), 'utf-8')
const invoques = new Set()
const envoyes = new Set()
for (const m of preload.matchAll(/ipcRenderer\.invoke\(\s*'([^']+)'/g)) invoques.add(m[1])
for (const m of preload.matchAll(/ipcRenderer\.send\(\s*'([^']+)'/g)) envoyes.add(m[1])

console.log(`Handlers main   : ${handlers.size}`)
console.log(`Invoke preload  : ${invoques.size}`)
console.log(`Listeners main  : ${ecouteurs.size} (${[...ecouteurs].join(', ')})`)
console.log(`Send preload    : ${envoyes.size} (${[...envoyes].join(', ')})`)

let echecs = 0

const sansHandler = [...invoques].filter((c) => !handlers.has(c))
if (sansHandler.length) {
  echecs += 1
  console.log(`\nECHEC canaux invoques sans handler : ${sansHandler.join(', ')}`)
} else {
  console.log('\nOK  tous les canaux invoques ont un handler')
}

const sansEcouteur = [...envoyes].filter((c) => !ecouteurs.has(c))
if (sansEcouteur.length) {
  echecs += 1
  console.log(`ECHEC canaux envoyes sans listener : ${sansEcouteur.join(', ')}`)
} else {
  console.log('OK  tous les canaux envoyes ont un listener')
}

const jamaisUtilises = [...handlers].filter((c) => !invoques.has(c))
if (jamaisUtilises.length) {
  console.log(`\nNote handlers jamais appeles par le preload : ${jamaisUtilises.join(', ')}`)
}

// Vérifie que chaque handler est bien enregistré au démarrage.
const indexMain = readFileSync(join(RACINE, 'main/index.ts'), 'utf-8')
const fonctionsEnregistrement = new Set()
for (const fichier of fichiersRecursifs(join(RACINE, 'main'))) {
  const contenu = readFileSync(fichier, 'utf-8')
  for (const m of contenu.matchAll(/export function (enregistrerHandlers\w+)/g)) {
    fonctionsEnregistrement.add(m[1])
  }
}
const nonAppelees = [...fonctionsEnregistrement].filter((f) => !indexMain.includes(`${f}()`))
if (nonAppelees.length) {
  echecs += 1
  console.log(`\nECHEC modules IPC non enregistres au demarrage : ${nonAppelees.join(', ')}`)
} else {
  console.log(`OK  les ${fonctionsEnregistrement.size} modules IPC sont enregistres au demarrage`)
}

console.log(`\n${echecs === 0 ? 'COHERENCE IPC VALIDEE' : `${echecs} PROBLEME(S) DETECTE(S)`}`)
process.exit(echecs === 0 ? 0 : 1)
