import { ipcMain } from 'electron'
import {
  ajouterClient,
  listerClients,
  modifierClient,
  obtenirDetailClient,
  supprimerClient
} from '../domaines/clients'
import type { Client } from '../../shared/types'

/**
 * Branchement des clients sur la fenêtre.
 *
 * Ce fichier ne contient plus aucune logique métier : elle vit dans
 * `../domaines/clients.ts`, où le serveur multi-postes ira la chercher pour
 * exposer les mêmes opérations par le réseau.
 *
 * Les noms de canaux ne changent pas : l'interface n'a rien à modifier, et
 * `npm test` continue de vérifier qu'ils correspondent au preload.
 */
export function enregistrerHandlersClients(): void {
  ipcMain.handle('clients:lister', () => listerClients())

  ipcMain.handle('clients:ajouter', (_e, client: Omit<Client, 'id'>) => ajouterClient(client))

  ipcMain.handle('clients:modifier', (_e, client: Client) => modifierClient(client))

  ipcMain.handle('clients:supprimer', (_e, id: number) => supprimerClient(id))

  ipcMain.handle('clients:obtenirDetail', (_e, id: number) => obtenirDetailClient(id))
}
