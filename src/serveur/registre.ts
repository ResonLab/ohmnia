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
  'clients:obtenirDetail': (id) => obtenirDetailClient(id as number)
}
