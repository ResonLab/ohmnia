import { createSign, generateKeyPairSync, randomBytes } from 'node:crypto'
import { networkInterfaces } from 'node:os'

/**
 * Fabrication d'un certificat auto-signé, sans OpenSSL.
 *
 * Le serveur refuse d'écouter sur le réseau sans chiffrement. Exiger d'aller
 * chercher OpenSSL et de recopier une ligne de commande ésotérique pour
 * franchir cette porte, c'est pousser les gens à laisser le serveur en clair —
 * autrement dit, faire échouer la mesure de sécurité par sa mise en œuvre.
 * L'application fabrique donc le certificat elle-même.
 *
 * Node sait générer une paire de clés mais **pas** un certificat X.509 : il
 * faut écrire la structure à la main. C'est du DER, décrit par la RFC 5280 —
 * verbeux mais mécanique, et entièrement vérifié par le test, qui ouvre une
 * vraie connexion TLS avec le certificat produit.
 *
 * Un certificat auto-signé reste inconnu des navigateurs et des systèmes : il
 * devra être accepté une fois sur chaque poste. Il chiffre parfaitement la
 * liaison ; ce qu'il ne fait pas, c'est prouver à un inconnu qu'il parle au bon
 * serveur. Sur le réseau d'une entreprise qui connaît sa propre machine, c'est
 * le bon compromis.
 */

/* ── Encodage DER, le strict nécessaire ──────────────────────────────────── */

function longueur(taille: number): Buffer {
  if (taille < 0x80) return Buffer.from([taille])

  const octets: number[] = []
  let reste = taille
  while (reste > 0) {
    octets.unshift(reste & 0xff)
    reste = Math.floor(reste / 256)
  }
  return Buffer.from([0x80 | octets.length, ...octets])
}

function element(marqueur: number, contenu: Buffer): Buffer {
  return Buffer.concat([Buffer.from([marqueur]), longueur(contenu.length), contenu])
}

const sequence = (...parties: Buffer[]): Buffer => element(0x30, Buffer.concat(parties))
const ensemble = (contenu: Buffer): Buffer => element(0x31, contenu)

function entier(valeur: Buffer | number): Buffer {
  if (typeof valeur === 'number') return element(0x02, Buffer.from([valeur]))
  // Un premier octet ≥ 0x80 ferait lire un nombre négatif : on préfixe un zéro.
  const contenu = valeur[0] >= 0x80 ? Buffer.concat([Buffer.from([0]), valeur]) : valeur
  return element(0x02, contenu)
}

function identifiant(pointe: string): Buffer {
  const parties = pointe.split('.').map(Number)
  const octets = [parties[0] * 40 + parties[1]]

  for (const partie of parties.slice(2)) {
    const groupe: number[] = []
    let reste = partie
    do {
      groupe.unshift(reste & 0x7f)
      reste = Math.floor(reste / 128)
    } while (reste > 0)
    for (let i = 0; i < groupe.length - 1; i += 1) groupe[i] |= 0x80
    octets.push(...groupe)
  }
  return element(0x06, Buffer.from(octets))
}

const nul = (): Buffer => Buffer.from([0x05, 0x00])
const texteUtf8 = (valeur: string): Buffer => element(0x0c, Buffer.from(valeur, 'utf-8'))
const octets = (contenu: Buffer): Buffer => element(0x04, contenu)
const booleen = (valeur: boolean): Buffer => element(0x01, Buffer.from([valeur ? 0xff : 0x00]))

/** BIT STRING : le premier octet compte les bits inutilisés du dernier octet. */
function bits(contenu: Buffer, inutilises = 0): Buffer {
  return element(0x03, Buffer.concat([Buffer.from([inutilises]), contenu]))
}

/** UTCTime, au format AAMMJJhhmmssZ. Suffisant jusqu'en 2049. */
function horodatage(date: Date): Buffer {
  const deux = (n: number): string => String(n).padStart(2, '0')
  const texte =
    deux(date.getUTCFullYear() % 100) +
    deux(date.getUTCMonth() + 1) +
    deux(date.getUTCDate()) +
    deux(date.getUTCHours()) +
    deux(date.getUTCMinutes()) +
    deux(date.getUTCSeconds()) +
    'Z'
  return element(0x17, Buffer.from(texte, 'ascii'))
}

/* ── Noms que le certificat couvre ───────────────────────────────────────── */

/**
 * Les adresses IPv4 de cette machine sur le réseau local.
 *
 * Sans elles, un poste qui se connecte à `https://192.168.1.20:8787` verrait un
 * certificat qui ne parle pas de cette adresse : un nom commun ne suffit plus
 * depuis longtemps, seul le champ « autres noms » compte.
 */
export function adressesLocales(): string[] {
  const adresses = new Set<string>(['127.0.0.1'])
  for (const cartes of Object.values(networkInterfaces())) {
    for (const carte of cartes ?? []) {
      if (carte.family === 'IPv4' && !carte.internal) adresses.add(carte.address)
    }
  }
  return [...adresses]
}

function nomsAlternatifs(nomsDns: string[], adressesIp: string[]): Buffer {
  const entrees: Buffer[] = []
  // dNSName : [2] implicite. iPAddress : [7] implicite, quatre octets bruts.
  for (const nom of nomsDns) entrees.push(element(0x82, Buffer.from(nom, 'ascii')))
  for (const adresse of adressesIp) {
    const morceaux = adresse.split('.').map(Number)
    if (morceaux.length === 4 && morceaux.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      entrees.push(element(0x87, Buffer.from(morceaux)))
    }
  }
  return sequence(...entrees)
}

function extension(oid: string, critique: boolean, valeur: Buffer): Buffer {
  const parties = [identifiant(oid)]
  if (critique) parties.push(booleen(true))
  parties.push(octets(valeur))
  return sequence(...parties)
}

/* ── Le certificat ───────────────────────────────────────────────────────── */

function enPem(etiquette: string, contenu: Buffer): string {
  const base64 = contenu.toString('base64').replace(/(.{64})/g, '$1\n').trim()
  return `-----BEGIN ${etiquette}-----\n${base64}\n-----END ${etiquette}-----\n`
}

export interface CertificatAutoSigne {
  certificatPem: string
  clePem: string
  /** Noms et adresses couverts, à afficher pour que l'utilisateur vérifie. */
  couvre: string[]
  expireLe: Date
}

export function fabriquerCertificatAutoSigne(options: {
  nomCommun?: string
  nomsDns?: string[]
  adressesIp?: string[]
  jours?: number
} = {}): CertificatAutoSigne {
  const nomCommun = options.nomCommun ?? 'ohmnia'
  const nomsDns = options.nomsDns ?? ['localhost', nomCommun]
  const adressesIp = options.adressesIp ?? adressesLocales()
  const jours = options.jours ?? 1825 // cinq ans

  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const clePubliqueDer = publicKey.export({ type: 'spki', format: 'der' })

  const debut = new Date(Date.now() - 60_000) // une minute de marge : horloges décalées
  const fin = new Date(debut.getTime() + jours * 86_400_000)

  // sha256WithRSAEncryption. Le même bloc figure dans le certificat et à côté.
  const algorithme = sequence(identifiant('1.2.840.113549.1.1.11'), nul())

  // Émetteur et sujet sont identiques : c'est ce qui fait « auto-signé ».
  const nom = sequence(ensemble(sequence(identifiant('2.5.4.3'), texteUtf8(nomCommun))))

  const extensions = element(
    0xa3,
    sequence(
      // Ce certificat ne signe pas d'autres certificats.
      extension('2.5.29.19', true, sequence()),
      // digitalSignature + keyEncipherment : bits 0 et 2, d'où 0xA0 et 5 bits inutilisés.
      extension('2.5.29.15', true, bits(Buffer.from([0xa0]), 5)),
      // Authentification d'un serveur TLS, et rien d'autre.
      extension('2.5.29.37', false, sequence(identifiant('1.3.6.1.5.5.7.3.1'))),
      extension('2.5.29.17', false, nomsAlternatifs(nomsDns, adressesIp))
    )
  )

  const corps = sequence(
    element(0xa0, entier(2)), // version v3
    // Numéro de série : positif, donc premier bit à zéro.
    entier(Buffer.from(randomBytes(16).map((o, i) => (i === 0 ? o & 0x7f : o)))),
    algorithme,
    nom,
    sequence(horodatage(debut), horodatage(fin)),
    nom,
    clePubliqueDer,
    extensions
  )

  const signeur = createSign('sha256')
  signeur.update(corps)
  const signature = signeur.sign(privateKey)

  const certificat = sequence(corps, algorithme, bits(signature))

  return {
    certificatPem: enPem('CERTIFICATE', certificat),
    clePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    couvre: [...nomsDns, ...adressesIp],
    expireLe: fin
  }
}
