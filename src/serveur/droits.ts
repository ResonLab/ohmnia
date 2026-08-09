import type { Role } from './comptes'

/**
 * Qui a le droit de quoi — **la politique de droits tient dans ce seul fichier**.
 *
 * Elle est écrite à la main, opération par opération, plutôt que déduite du nom
 * du canal. Une règle du genre « `lister` = lecture, le reste = écriture »
 * paraît séduisante et se trompe silencieusement : `conditions:accepter` écrit,
 * `recherche:globale` lit, et une opération mal nommée passerait du mauvais
 * côté sans que personne ne s'en aperçoive. Ici, une opération sans droit
 * déclaré est **refusée**, et `npm test` le signale.
 *
 * Les trois rôles, du moins au plus étendu :
 *
 * - **lecture** — consulter. Un apprenti, un comptable externe qui vérifie.
 * - **ecriture** — le travail courant : facturer, saisir, gérer le stock.
 * - **administration** — ce qui engage l'entreprise ou le serveur : identité
 *   de l'entreprise, clôtures d'exercice, réglages, purge du journal d'audit.
 *
 * Le doute se tranche vers le haut : dans le doute, `administration`.
 */
export const DROITS: Record<string, Role> = {
  /* Clients */
  'clients:lister': 'lecture',
  'clients:obtenirDetail': 'lecture',
  'clients:ajouter': 'ecriture',
  'clients:modifier': 'ecriture',
  'clients:supprimer': 'ecriture',

  /* Audit et exercices — clôturer un exercice verrouille le passé. */
  'audit:lister': 'administration',
  'audit:vider': 'administration',
  'exercices:lister': 'lecture',
  'exercices:cloturer': 'administration',
  'exercices:reouvrir': 'administration',

  /* Rappels */
  'rappels:lister': 'lecture',
  'rappels:prochainNiveau': 'lecture',
  'rappels:creer': 'ecriture',
  'rappels:supprimer': 'ecriture',

  /* Résumé annuel */
  'resume:parAnnee': 'lecture',
  'objectifAnnuel:lire': 'lecture',
  'objectifAnnuel:enregistrer': 'ecriture',

  /* Tableau de bord */
  'tableauDeBord:charger': 'lecture',

  /* Modèles de prestations */
  'modeles:lister': 'lecture',
  'modeles:creer': 'ecriture',
  'modeles:enregistrer': 'ecriture',
  'modeles:supprimer': 'ecriture',
  'modeles:creerDepuisFacture': 'ecriture',

  /* Tarifs */
  'tarifsProduits:lister': 'lecture',
  'tarifsProduits:ajouter': 'ecriture',
  'tarifsProduits:modifier': 'ecriture',
  'tarifsProduits:supprimer': 'ecriture',
  'tarifsMainOeuvre:lister': 'lecture',
  'tarifsMainOeuvre:ajouter': 'ecriture',
  'tarifsMainOeuvre:modifier': 'ecriture',
  'tarifsMainOeuvre:supprimer': 'ecriture',
  'tarifsDeplacement:lister': 'lecture',
  'tarifsDeplacement:ajouter': 'ecriture',
  'tarifsDeplacement:modifier': 'ecriture',
  'tarifsDeplacement:supprimer': 'ecriture',

  /* Inventaire */
  'inventaire:lister': 'lecture',
  'inventaire:referenceSuggeree': 'lecture',
  'inventaire:resume': 'lecture',
  'inventaire:ajouter': 'ecriture',
  'inventaire:modifier': 'ecriture',
  'inventaire:supprimer': 'ecriture',

  /* Recherche et conformité */
  'recherche:globale': 'lecture',
  'conformite:verifier': 'lecture',

  /* Suivi du temps */
  'suiviTemps:lister': 'lecture',
  'suiviTemps:enCours': 'lecture',
  'suiviTemps:demarrer': 'ecriture',
  'suiviTemps:arreter': 'ecriture',
  'suiviTemps:modifier': 'ecriture',
  'suiviTemps:supprimer': 'ecriture',
  'suiviTemps:facturer': 'ecriture',

  /* Devis */
  'devis:prochainNumero': 'lecture',
  'devis:obtenirDetail': 'lecture',
  'devis:historique': 'lecture',
  'devis:creerBrouillon': 'ecriture',
  'devis:dupliquer': 'ecriture',
  'devis:enregistrer': 'ecriture',
  'devis:supprimer': 'ecriture',
  'devis:changerStatut': 'ecriture',

  /* Factures */
  'factures:prochainNumero': 'lecture',
  'factures:obtenirDetail': 'lecture',
  'factures:historique': 'lecture',
  'factures:creerBrouillon': 'ecriture',
  'factures:dupliquer': 'ecriture',
  'factures:creerDepuisDevis': 'ecriture',
  'factures:enregistrer': 'ecriture',
  'factures:supprimer': 'ecriture',
  'factures:changerStatut': 'ecriture',
  'factures:confirmerEnregistrementHistorique': 'ecriture',

  /* Journal */
  'categoriesJournal:lister': 'lecture',
  'categoriesJournal:ajouter': 'ecriture',
  'categoriesJournal:renommer': 'ecriture',
  'categoriesJournal:supprimer': 'ecriture',
  'journal:lister': 'lecture',
  'journal:repartitionParCategorie': 'lecture',
  'journal:evolutionAnnuelle': 'lecture',
  'journal:ajouter': 'ecriture',
  'journal:modifier': 'ecriture',
  'journal:supprimer': 'ecriture',

  /* Paramètres de calcul — ils changent les prix : réservés à l'administration. */
  'parametresMarge:lire': 'lecture',
  'parametresMarge:enregistrer': 'administration',
  'parametresDeplacement:lire': 'lecture',
  'parametresDeplacement:enregistrer': 'administration',
  'parametresImpression:lire': 'lecture',
  'parametresImpression:enregistrer': 'administration',
  'chargesFixes:lister': 'lecture',
  'chargesFixes:ajouter': 'administration',
  'chargesFixes:modifier': 'administration',
  'chargesFixes:supprimer': 'administration',

  /* Paramètres de l'application */
  'parametresApp:lire': 'lecture',
  'parametresApp:enregistrer': 'administration',
  'parametresApp:verifierIntegrite': 'administration',

  /* Conditions d'utilisation */
  'conditions:etat': 'lecture',
  'conditions:url': 'lecture',
  'conditions:accepter': 'administration',

  /* Entreprise — son identité figure sur chaque facture. */
  'entreprise:lire': 'lecture',
  'entreprise:enregistrer': 'administration',

  /* Justificatifs */
  'justificatifs:lister': 'lecture',
  'justificatifs:compterParEcriture': 'lecture',

  /* Comptabilité — un import crée des écritures dans le Journal. */
  'comptabilite:importerMouvements': 'ecriture'
}

/**
 * Le rôle exigé par une opération. `null` si aucun n'est déclaré — l'appelant
 * doit alors refuser : mieux vaut une opération inaccessible qu'une opération
 * ouverte à tous par oubli.
 */
export function roleExige(canal: string): Role | null {
  return DROITS[canal] ?? null
}
