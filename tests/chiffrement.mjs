// Vérifie le chiffrement/déchiffrement de la sauvegarde externe.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const MAGIC = Buffer.from('OHMNIA01', 'utf-8')
const TAILLE_SEL = 16
const TAILLE_IV = 12
const TAILLE_TAG = 16
const LONGUEUR_CLE = 32

const deriverCle = (mdp, sel) => scryptSync(mdp, sel, LONGUEUR_CLE, { N: 16384, r: 8, p: 1 })

function chiffrer(donnees, motDePasse) {
  const sel = randomBytes(TAILLE_SEL)
  const iv = randomBytes(TAILLE_IV)
  const c = createCipheriv('aes-256-gcm', deriverCle(motDePasse, sel), iv)
  const chiffre = Buffer.concat([c.update(donnees), c.final()])
  return Buffer.concat([MAGIC, sel, iv, c.getAuthTag(), chiffre])
}

function dechiffrer(contenu, motDePasse) {
  const enteteMin = MAGIC.length + TAILLE_SEL + TAILLE_IV + TAILLE_TAG
  if (contenu.length <= enteteMin || !contenu.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Ce fichier n'est pas une sauvegarde Ohmnia valide.")
  }
  let p = MAGIC.length
  const sel = contenu.subarray(p, (p += TAILLE_SEL))
  const iv = contenu.subarray(p, (p += TAILLE_IV))
  const tag = contenu.subarray(p, (p += TAILLE_TAG))
  const chiffre = contenu.subarray(p)

  const d = createDecipheriv('aes-256-gcm', deriverCle(motDePasse, sel), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(chiffre), d.final()])
}

let echecs = 0
const verifier = (intitule, condition) => {
  if (!condition) echecs += 1
  console.log(`  ${condition ? 'OK  ' : 'ECHEC'} ${intitule}`)
}

const MDP = 'MonMotDePasse2026'
const cheminBase = join(process.env.APPDATA, 'Ohmnia', 'gestion.sqlite')
const base = readFileSync(cheminBase)
console.log(`Base source : ${base.length} octets\n`)

console.log('--- Aller-retour sur la vraie base ---')
const paquet = chiffrer(base, MDP)
verifier('le fichier chiffre commence par la signature', paquet.subarray(0, 8).toString() === 'OHMNIA01')
verifier('le contenu est bien chiffre (pas de SQLite en clair)', !paquet.includes(Buffer.from('SQLite format 3')))

const restaure = dechiffrer(paquet, MDP)
verifier('taille identique apres dechiffrement', restaure.length === base.length)
verifier('contenu identique octet par octet', restaure.equals(base))
verifier('en-tete SQLite present', restaure.subarray(0, 15).toString().startsWith('SQLite format 3'))

console.log('\n--- Mauvais mot de passe ---')
try {
  dechiffrer(paquet, 'MauvaisMotDePasse')
  verifier('rejette un mauvais mot de passe', false)
} catch {
  verifier('rejette un mauvais mot de passe', true)
}

console.log('\n--- Fichier altere (1 octet modifie) ---')
const altere = Buffer.from(paquet)
altere[altere.length - 20] ^= 0xff
try {
  dechiffrer(altere, MDP)
  verifier('detecte une alteration', false)
} catch {
  verifier('detecte une alteration', true)
}

console.log('\n--- Fichier etranger ---')
try {
  dechiffrer(Buffer.from('nimportequoi'.repeat(20)), MDP)
  verifier('rejette un fichier non-Ohmnia', false)
} catch {
  verifier('rejette un fichier non-Ohmnia', true)
}

console.log('\n--- Ecriture sur disque puis relecture ---')
const dossier = join(process.env.TEMP, 'ohmnia-test-externe')
if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true })
const chemin = join(dossier, 'test.ohmnia')
writeFileSync(chemin, paquet)
const relu = dechiffrer(readFileSync(chemin), MDP)
verifier('relecture depuis le disque identique', relu.equals(base))

console.log(`\n${echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} TEST(S) EN ECHEC`}`)
process.exit(echecs === 0 ? 0 : 1)
