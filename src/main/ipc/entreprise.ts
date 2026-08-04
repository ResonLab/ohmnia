import { app, dialog, ipcMain } from 'electron'
import { getDb } from '../db/database'
import type { Entreprise } from '../../shared/types'
import { profilPays } from '../../shared/pays'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'

const EXTENSIONS_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

function versDataUrl(cheminAbsolu: string): string | null {
  const extension = extname(cheminAbsolu).toLowerCase()
  const mime = EXTENSIONS_MIME[extension]
  if (!mime || !existsSync(cheminAbsolu)) return null
  const contenu = readFileSync(cheminAbsolu).toString('base64')
  return `data:${mime};base64,${contenu}`
}

interface LigneEntreprise {
  nom: string
  adresse: string
  email: string
  telephone: string
  iban: string
  titulaire_compte: string
  tva_defaut_pct: number
  logo_path: string | null
  prefixe_facture: string
  prefixe_devis: string
  assujetti_tva: number
  numero_ide: string
  conditions_generales: string
  mentions_pied: string
  pays: string
}

function versEntreprise(ligne: LigneEntreprise): Entreprise {
  return {
    nom: ligne.nom,
    adresse: ligne.adresse,
    email: ligne.email,
    telephone: ligne.telephone,
    iban: ligne.iban,
    titulaireCompte: ligne.titulaire_compte,
    tvaDefautPct: ligne.tva_defaut_pct,
    logoPath: ligne.logo_path,
    prefixeFacture: ligne.prefixe_facture,
    prefixeDevis: ligne.prefixe_devis,
    assujettiTva: ligne.assujetti_tva === 1,
    numeroIde: ligne.numero_ide,
    conditionsGenerales: ligne.conditions_generales,
    mentionsPied: ligne.mentions_pied,
    pays: ligne.pays
  }
}

function validerEntreprise(valeurs: Entreprise): string | null {
  if (!valeurs.nom.trim()) return 'Le nom de l\'entreprise est obligatoire.'
  if (valeurs.tvaDefautPct < 0 || valeurs.tvaDefautPct > 100) {
    return 'Le taux de taxe par défaut doit être compris entre 0 et 100.'
  }
  if (!valeurs.prefixeFacture.trim()) return 'Le préfixe de numéro de facture est obligatoire.'
  if (!valeurs.prefixeDevis.trim()) return 'Le préfixe de numéro de devis est obligatoire.'

  // Les règles d'identifiant et de taxe dépendent du pays sélectionné.
  const profil = profilPays(valeurs.pays)
  const identifiant = valeurs.numeroIde.trim()

  if (identifiant && !profil.formatIdentifiant.test(identifiant)) {
    return `${profil.libelleIdentifiant} invalide pour ${profil.nom}. ${profil.aideIdentifiant}`
  }
  if (valeurs.assujettiTva && !identifiant) {
    return `Une entreprise assujettie à la ${profil.nomTaxe} doit indiquer son ${profil.libelleIdentifiant} : il est obligatoire sur les factures.`
  }
  // Facturer une taxe sans y être assujetti expose à un redressement :
  // le taux reste donc à zéro tant que la case n'est pas cochée.
  if (!valeurs.assujettiTva && valeurs.tvaDefautPct !== 0) {
    return `Tant que vous n'êtes pas assujetti à la ${profil.nomTaxe}, le taux par défaut doit rester à 0.`
  }
  return null
}

export function enregistrerHandlersEntreprise(): void {
  ipcMain.handle('entreprise:lire', () => {
    const ligne = getDb().prepare('SELECT * FROM entreprise WHERE id = 1').get() as unknown as LigneEntreprise
    return versEntreprise(ligne)
  })

  ipcMain.handle('entreprise:lireLogoDataUrl', (_evenement, cheminAbsolu: string | null) => {
    if (!cheminAbsolu) return null
    return versDataUrl(cheminAbsolu)
  })

  ipcMain.handle('entreprise:choisirLogo', async () => {
    const resultat = await dialog.showOpenDialog({
      title: 'Choisir un logo',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
      properties: ['openFile']
    })
    if (resultat.canceled || resultat.filePaths.length === 0) return null

    const fichierSource = resultat.filePaths[0]
    const extension = extname(fichierSource).toLowerCase()
    if (!EXTENSIONS_MIME[extension]) {
      throw new Error('Format d\'image non pris en charge. Utilisez PNG, JPG, SVG ou WEBP.')
    }

    const dossierLogo = join(app.getPath('userData'), 'Logo')
    if (!existsSync(dossierLogo)) mkdirSync(dossierLogo, { recursive: true })
    const cheminDestination = join(dossierLogo, `logo${extension}`)
    copyFileSync(fichierSource, cheminDestination)

    getDb().prepare('UPDATE entreprise SET logo_path = ? WHERE id = 1').run(cheminDestination)

    return { logoPath: cheminDestination, dataUrl: versDataUrl(cheminDestination) }
  })

  ipcMain.handle('entreprise:enregistrer', (_evenement, valeurs: Entreprise) => {
    const erreur = validerEntreprise(valeurs)
    if (erreur) throw new Error(erreur)

    getDb()
      .prepare(
        `UPDATE entreprise SET
          nom = ?, adresse = ?, email = ?, telephone = ?, iban = ?,
          titulaire_compte = ?, tva_defaut_pct = ?, logo_path = ?,
          prefixe_facture = ?, prefixe_devis = ?,
          assujetti_tva = ?, numero_ide = ?, conditions_generales = ?, mentions_pied = ?,
          pays = ?
         WHERE id = 1`
      )
      .run(
        valeurs.nom,
        valeurs.adresse,
        valeurs.email,
        valeurs.telephone,
        valeurs.iban,
        valeurs.titulaireCompte,
        valeurs.tvaDefautPct,
        valeurs.logoPath,
        valeurs.prefixeFacture,
        valeurs.prefixeDevis,
        valeurs.assujettiTva ? 1 : 0,
        valeurs.numeroIde.trim(),
        valeurs.conditionsGenerales,
        valeurs.mentionsPied,
        valeurs.pays
      )

    return versEntreprise(
      getDb().prepare('SELECT * FROM entreprise WHERE id = 1').get() as unknown as LigneEntreprise
    )
  })
}
