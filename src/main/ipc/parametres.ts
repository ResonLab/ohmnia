import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import type {
  ChargeFixe,
  ParametresDeplacement,
  ParametresImpressionDb,
  ParametresMarge
} from '../../shared/types'

interface LigneParametresMarge {
  heures_facturables_mois: number
  ca_estime_mensuel: number
}

interface LigneParametresDeplacement {
  conso_l_100km: number
  prix_essence: number
  entretien_km: number
  marge_livraison_pct: number
}

interface LigneParametresImpression {
  prix_sachet_a4: number
  feuilles_par_sachet: number
  feuilles_par_facture: number
  prix_imprimante: number
  nb_factures_avant_remplacement: number
  prix_encre: number
  feuilles_par_cartouche: number
  prix_timbre: number
  prix_sachet_enveloppes: number
  nb_enveloppes_par_sachet: number
  marge_impression_pct: number
}

interface LigneChargeFixe {
  id: number
  libelle: string
  montant_mensuel: number
  categorie: string
  actif: number
}

function versChargeFixe(ligne: LigneChargeFixe): ChargeFixe {
  return {
    id: ligne.id,
    libelle: ligne.libelle,
    montantMensuel: ligne.montant_mensuel,
    categorie: ligne.categorie,
    actif: ligne.actif === 1
  }
}

function validerMontantPositif(valeur: number, nomChamp: string): string | null {
  if (typeof valeur !== 'number' || Number.isNaN(valeur) || valeur < 0) {
    return `${nomChamp} doit être un nombre positif.`
  }
  return null
}

export function enregistrerHandlersParametres(): void {
  ipcMain.handle('parametresMarge:lire', () => {
    const ligne = getDb()
      .prepare('SELECT * FROM parametres_marge WHERE id = 1')
      .get() as unknown as LigneParametresMarge
    return {
      heuresFacturablesMois: ligne.heures_facturables_mois,
      caEstimeMensuel: ligne.ca_estime_mensuel
    } satisfies ParametresMarge
  })

  ipcMain.handle('parametresMarge:enregistrer', (_e, valeurs: ParametresMarge) => {
    const erreur =
      validerMontantPositif(valeurs.heuresFacturablesMois, 'Les heures facturables par mois') ||
      validerMontantPositif(valeurs.caEstimeMensuel, "Le chiffre d'affaires estimé")
    if (erreur) throw new Error(erreur)

    getDb()
      .prepare('UPDATE parametres_marge SET heures_facturables_mois = ?, ca_estime_mensuel = ? WHERE id = 1')
      .run(valeurs.heuresFacturablesMois, valeurs.caEstimeMensuel)
    return valeurs
  })

  ipcMain.handle('parametresDeplacement:lire', () => {
    const ligne = getDb()
      .prepare('SELECT * FROM parametres_deplacement WHERE id = 1')
      .get() as unknown as LigneParametresDeplacement
    return {
      consoL100km: ligne.conso_l_100km,
      prixEssence: ligne.prix_essence,
      entretienKm: ligne.entretien_km,
      margeLivraisonPct: ligne.marge_livraison_pct
    } satisfies ParametresDeplacement
  })

  ipcMain.handle('parametresDeplacement:enregistrer', (_e, valeurs: ParametresDeplacement) => {
    const erreur =
      validerMontantPositif(valeurs.consoL100km, 'La consommation') ||
      validerMontantPositif(valeurs.prixEssence, "Le prix de l'essence") ||
      validerMontantPositif(valeurs.entretienKm, "Le coût d'entretien au km") ||
      validerMontantPositif(valeurs.margeLivraisonPct, 'La marge de livraison')
    if (erreur) throw new Error(erreur)

    getDb()
      .prepare(
        `UPDATE parametres_deplacement SET
          conso_l_100km = ?, prix_essence = ?, entretien_km = ?, marge_livraison_pct = ?
         WHERE id = 1`
      )
      .run(valeurs.consoL100km, valeurs.prixEssence, valeurs.entretienKm, valeurs.margeLivraisonPct)
    return valeurs
  })

  ipcMain.handle('parametresImpression:lire', () => {
    const ligne = getDb()
      .prepare('SELECT * FROM parametres_impression WHERE id = 1')
      .get() as unknown as LigneParametresImpression
    return {
      prixSachetA4: ligne.prix_sachet_a4,
      feuillesParSachet: ligne.feuilles_par_sachet,
      feuillesParFacture: ligne.feuilles_par_facture,
      prixImprimante: ligne.prix_imprimante,
      nbFacturesAvantRemplacement: ligne.nb_factures_avant_remplacement,
      prixEncre: ligne.prix_encre,
      feuillesParCartouche: ligne.feuilles_par_cartouche,
      prixTimbre: ligne.prix_timbre,
      prixSachetEnveloppes: ligne.prix_sachet_enveloppes,
      nbEnveloppesParSachet: ligne.nb_enveloppes_par_sachet,
      margeImpressionPct: ligne.marge_impression_pct
    } satisfies ParametresImpressionDb
  })

  ipcMain.handle('parametresImpression:enregistrer', (_e, valeurs: ParametresImpressionDb) => {
    getDb()
      .prepare(
        `UPDATE parametres_impression SET
          prix_sachet_a4 = ?, feuilles_par_sachet = ?, feuilles_par_facture = ?,
          prix_imprimante = ?, nb_factures_avant_remplacement = ?, prix_encre = ?,
          feuilles_par_cartouche = ?, prix_timbre = ?, prix_sachet_enveloppes = ?,
          nb_enveloppes_par_sachet = ?, marge_impression_pct = ?
         WHERE id = 1`
      )
      .run(
        valeurs.prixSachetA4,
        valeurs.feuillesParSachet,
        valeurs.feuillesParFacture,
        valeurs.prixImprimante,
        valeurs.nbFacturesAvantRemplacement,
        valeurs.prixEncre,
        valeurs.feuillesParCartouche,
        valeurs.prixTimbre,
        valeurs.prixSachetEnveloppes,
        valeurs.nbEnveloppesParSachet,
        valeurs.margeImpressionPct
      )
    return valeurs
  })

  ipcMain.handle('chargesFixes:lister', () => {
    const lignes = getDb()
      .prepare('SELECT * FROM charges_fixes ORDER BY id')
      .all() as unknown as LigneChargeFixe[]
    return lignes.map(versChargeFixe)
  })

  ipcMain.handle('chargesFixes:ajouter', (_e, charge: Omit<ChargeFixe, 'id'>) => {
    if (!charge.libelle.trim()) throw new Error('Le libellé de la charge est obligatoire.')
    const erreur = validerMontantPositif(charge.montantMensuel, 'Le montant mensuel')
    if (erreur) throw new Error(erreur)

    const resultat = getDb()
      .prepare('INSERT INTO charges_fixes (libelle, montant_mensuel, categorie, actif) VALUES (?, ?, ?, ?)')
      .run(charge.libelle, charge.montantMensuel, charge.categorie, charge.actif ? 1 : 0)

    const ligne = getDb()
      .prepare('SELECT * FROM charges_fixes WHERE id = ?')
      .get(resultat.lastInsertRowid) as unknown as LigneChargeFixe
    return versChargeFixe(ligne)
  })

  ipcMain.handle('chargesFixes:modifier', (_e, charge: ChargeFixe) => {
    if (!charge.libelle.trim()) throw new Error('Le libellé de la charge est obligatoire.')
    const erreur = validerMontantPositif(charge.montantMensuel, 'Le montant mensuel')
    if (erreur) throw new Error(erreur)

    getDb()
      .prepare('UPDATE charges_fixes SET libelle = ?, montant_mensuel = ?, categorie = ?, actif = ? WHERE id = ?')
      .run(charge.libelle, charge.montantMensuel, charge.categorie, charge.actif ? 1 : 0, charge.id)
    return charge
  })

  ipcMain.handle('chargesFixes:supprimer', (_e, id: number) => {
    getDb().prepare('DELETE FROM charges_fixes WHERE id = ?').run(id)
  })
}
