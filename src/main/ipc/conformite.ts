import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { profilPays } from '../../shared/pays'
import type { PointConformite } from '../../shared/types'

/**
 * Contrôles de conformité de la facturation.
 *
 * Ce panneau vérifie ce qu'une application peut vérifier objectivement :
 * présence des mentions obligatoires, continuité de la numérotation,
 * cohérence de l'assujettissement. Il ne remplace pas l'avis d'un fiduciaire
 * et ne certifie rien : c'est une liste de contrôle, pas une garantie légale.
 */
export function enregistrerHandlersConformite(): void {
  ipcMain.handle('conformite:verifier', () => {
    const db = getDb()
    const entreprise = db.prepare('SELECT * FROM entreprise WHERE id = 1').get() as {
      nom: string
      adresse: string
      iban: string
      pays: string
      numero_ide: string
      assujetti_tva: number
      conditions_generales: string
      tva_defaut_pct: number
    }
    const profil = profilPays(entreprise.pays)
    const assujetti = entreprise.assujetti_tva === 1
    const points: PointConformite[] = []

    points.push({
      cle: 'nom',
      libelle: "Nom de l'entreprise",
      statut: entreprise.nom.trim() ? 'ok' : 'manquant',
      explication: entreprise.nom.trim()
        ? 'Présent sur tous les documents.'
        : "Le nom de l'émetteur est une mention obligatoire sur une facture."
    })

    points.push({
      cle: 'adresse',
      libelle: "Adresse complète de l'entreprise",
      statut: entreprise.adresse.trim().length > 5 ? 'ok' : 'manquant',
      explication:
        entreprise.adresse.trim().length > 5
          ? 'Présente sur tous les documents.'
          : "L'adresse de l'émetteur est une mention obligatoire sur une facture."
    })

    const identifiant = entreprise.numero_ide.trim()
    points.push({
      cle: 'identifiant',
      libelle: profil.libelleIdentifiant,
      statut: identifiant ? 'ok' : assujetti ? 'manquant' : 'avertissement',
      explication: identifiant
        ? `Imprimé sur les documents (${identifiant}).`
        : assujetti
          ? `Obligatoire sur les factures d'une entreprise assujettie à la ${profil.nomTaxe}.`
          : `Recommandé même sans assujettissement : il identifie officiellement votre entreprise (${profil.exempleIdentifiant}).`
    })

    points.push({
      cle: 'taxe',
      libelle: `Cohérence ${profil.nomTaxe}`,
      statut: assujetti === entreprise.tva_defaut_pct > 0 ? 'ok' : assujetti ? 'avertissement' : 'manquant',
      explication: assujetti
        ? entreprise.tva_defaut_pct > 0
          ? `Assujetti, taux par défaut ${entreprise.tva_defaut_pct}%.`
          : `Vous êtes déclaré assujetti mais le taux par défaut est à 0%.`
        : entreprise.tva_defaut_pct === 0
          ? `Non assujetti : aucune ${profil.nomTaxe} facturée, mention légale imprimée.`
          : `Non assujetti mais un taux de ${entreprise.tva_defaut_pct}% est configuré : facturer une taxe sans y être assujetti expose à un redressement.`
    })

    points.push({
      cle: 'iban',
      libelle: 'Coordonnées de paiement (IBAN)',
      statut: entreprise.iban.trim().length > 10 ? 'ok' : 'avertissement',
      explication:
        entreprise.iban.trim().length > 10
          ? 'Imprimées sur les factures et rappels.'
          : "Sans IBAN complet, le client ne sait pas où payer. Ce n'est pas une obligation légale mais c'est indispensable en pratique."
    })

    points.push({
      cle: 'conditions',
      libelle: 'Conditions générales',
      statut: entreprise.conditions_generales.trim().length > 100 ? 'ok' : 'avertissement',
      explication:
        entreprise.conditions_generales.trim().length > 100
          ? 'Imprimées au bas des documents.'
          : "Sans conditions générales, aucune limitation de garantie ou de responsabilité ne vous est opposable. Un modèle de départ est disponible dans « Mon entreprise »."
    })

    // Numérotation : une facture manquante dans la suite attire l'attention
    // d'un contrôle. On détecte les trous dans la partie numérique.
    const numeros = db
      .prepare('SELECT numero FROM factures ORDER BY id')
      .all() as unknown as { numero: string }[]

    const suffixes = numeros
      .map((n) => Number(n.numero.replace(/\D/g, '')))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b)

    let trous = 0
    for (let i = 1; i < suffixes.length; i += 1) {
      if (suffixes[i] - suffixes[i - 1] > 1) trous += suffixes[i] - suffixes[i - 1] - 1
    }

    points.push({
      cle: 'numerotation',
      libelle: 'Continuité de la numérotation',
      statut: numeros.length === 0 ? 'avertissement' : trous === 0 ? 'ok' : 'avertissement',
      explication:
        numeros.length === 0
          ? 'Aucune facture émise pour le moment.'
          : trous === 0
            ? `${numeros.length} facture(s), numérotation continue.`
            : `${trous} numéro(s) manquant(s) dans la suite. Une facture annulée doit rester dans le système avec le statut « Annulée » plutôt qu'être supprimée.`
    })

    const doublons = db
      .prepare('SELECT numero, COUNT(*) AS n FROM factures GROUP BY numero HAVING n > 1')
      .all() as unknown as { numero: string; n: number }[]

    points.push({
      cle: 'doublons',
      libelle: 'Unicité des numéros de facture',
      statut: doublons.length === 0 ? 'ok' : 'manquant',
      explication:
        doublons.length === 0
          ? 'Chaque numéro est unique.'
          : `Numéros en double : ${doublons.map((d) => d.numero).join(', ')}.`
    })

    // Sauvegardes : la conservation des pièces est une obligation comptable.
    points.push({
      cle: 'conservation',
      libelle: 'Conservation des documents',
      statut: 'avertissement',
      explication: `En ${profil.nom}, les pièces comptables doivent être conservées ${profil.conservationAnnees} ans. Pensez à la sauvegarde externe chiffrée : une seule copie sur un seul ordinateur ne suffit pas.`
    })

    return points
  })
}
