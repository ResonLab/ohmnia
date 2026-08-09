import {
  cloturerExercice,
  listerAudit,
  listerExercices,
  reouvrirExercice,
  viderAudit
} from '../main/domaines/audit'
import {
  creerRappel,
  listerRappels,
  prochainNiveauRappel,
  supprimerRappel
} from '../main/domaines/rappels'
import {
  enregistrerObjectifAnnuel,
  lireObjectifAnnuel,
  resumeParAnnee
} from '../main/domaines/resume'
import { chargerTableauDeBord } from '../main/domaines/tableauDeBord'
import { lireParametresApp } from '../main/domaines/parametresApp'
import {
  ajouterClient,
  listerClients,
  modifierClient,
  obtenirDetailClient,
  supprimerClient
} from '../main/domaines/clients'

/**
 * Ce que le serveur sait faire, canal par canal.
 *
 * Les noms sont **exactement ceux des canaux IPC** de l'application locale.
 * Une opération se comporte donc pareil qu'elle passe par la fenêtre ou par le
 * réseau, et l'interface n'a qu'un aiguillage à faire, pas deux implémentations
 * à maintenir.
 *
 * Pour ajouter un domaine : l'extraire d'abord dans `main/domaines/`, puis
 * l'inscrire ici. Rien d'autre.
 */
export type Operation = (...arguments_: unknown[]) => unknown

export const REGISTRE: Record<string, Operation> = {
  'clients:lister': () => listerClients(),
  'clients:ajouter': (client) => ajouterClient(client as Parameters<typeof ajouterClient>[0]),
  'clients:modifier': (client) => modifierClient(client as Parameters<typeof modifierClient>[0]),
  'clients:supprimer': (id) => supprimerClient(id as number),
  'clients:obtenirDetail': (id) => obtenirDetailClient(id as number),

  'audit:lister': (limite) => listerAudit((limite as number) ?? 300),
  'audit:vider': () => viderAudit(),
  'exercices:lister': () => listerExercices(),
  'exercices:cloturer': (annee) => cloturerExercice(annee as number),
  'exercices:reouvrir': (annee) => reouvrirExercice(annee as number),

  'rappels:lister': (factureId) => listerRappels(factureId as number),
  'rappels:prochainNiveau': (factureId) => prochainNiveauRappel(factureId as number),
  'rappels:creer': (factureId, niveau, frais) =>
    creerRappel(factureId as number, niveau as number, frais as number),
  'rappels:supprimer': (id) => supprimerRappel(id as number),

  'resume:parAnnee': () => resumeParAnnee(),
  'objectifAnnuel:lire': (annee) => lireObjectifAnnuel(annee as number),
  'objectifAnnuel:enregistrer': (annee, objectif) =>
    enregistrerObjectifAnnuel(annee as number, objectif as number),

  'tableauDeBord:charger': () => chargerTableauDeBord(),
  'parametresApp:lire': () => lireParametresApp()
}
