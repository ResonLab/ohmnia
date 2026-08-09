import { getDb } from '../db/database'
import { calculerTotalDocument } from '../../shared/calculs'
import type { Client, ClientDetail, DevisDuClient, FactureDuClient } from '../../shared/types'

/**
 * Logique métier des clients, sans aucune dépendance à Electron.
 *
 * Ces fonctions étaient écrites directement dans les `ipcMain.handle` de
 * `../ipc/clients.ts`, donc inutilisables ailleurs. Le serveur multi-postes
 * appellera exactement les mêmes, en les exposant par le réseau au lieu de les
 * exposer à la fenêtre.
 *
 * Règle à tenir en convertissant les autres domaines : **ici, rien qui vienne
 * d'`electron`**. Ni `ipcMain`, ni `dialog`, ni `app`. Ce qui a besoin d'une
 * fenêtre reste dans `../ipc/`.
 */

function validerClient(client: Omit<Client, 'id'>): string | null {
  if (!client.nom.trim()) return 'Le nom du client est obligatoire.'
  // Contrôles souples : un client peut n'avoir ni email ni téléphone,
  // mais s'ils sont renseignés ils doivent avoir une forme plausible.
  if (client.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email.trim())) {
    return "L'adresse email n'est pas valide (exemple : nom@domaine.ch)."
  }
  if (client.telephone.trim() && !/^[0-9+\s().-]{6,}$/.test(client.telephone.trim())) {
    return 'Le numéro de téléphone ne doit contenir que des chiffres, espaces, +, -, ( ) et faire au moins 6 caractères.'
  }
  return null
}

export function listerClients(): Client[] {
  return getDb().prepare('SELECT * FROM clients ORDER BY nom').all() as unknown as Client[]
}

export function ajouterClient(client: Omit<Client, 'id'>): Client {
  const erreur = validerClient(client)
  if (erreur) throw new Error(erreur)

  const resultat = getDb()
    .prepare('INSERT INTO clients (nom, adresse, email, telephone) VALUES (?, ?, ?, ?)')
    .run(client.nom, client.adresse, client.email, client.telephone)
  return { id: Number(resultat.lastInsertRowid), ...client } satisfies Client
}

export function modifierClient(client: Client): Client {
  const erreur = validerClient(client)
  if (erreur) throw new Error(erreur)

  getDb()
    .prepare('UPDATE clients SET nom = ?, adresse = ?, email = ?, telephone = ? WHERE id = ?')
    .run(client.nom, client.adresse, client.email, client.telephone, client.id)
  return client
}

export function supprimerClient(id: number): void {
  // Un client encore rattaché à une facture ou un devis ne doit pas disparaître
  // silencieusement : on explique plutôt pourquoi la suppression est refusée.
  const nbFactures = getDb()
    .prepare('SELECT COUNT(*) AS n FROM factures WHERE client_id = ?')
    .get(id) as { n: number }
  const nbDevis = getDb().prepare('SELECT COUNT(*) AS n FROM devis WHERE client_id = ?').get(id) as {
    n: number
  }
  if (nbFactures.n > 0 || nbDevis.n > 0) {
    throw new Error(
      `Ce client ne peut pas être supprimé : il est lié à ${nbFactures.n} facture(s) et ${nbDevis.n} devis. ` +
        "Supprimez ou réattribuez ces documents d'abord."
    )
  }
  getDb().prepare('DELETE FROM clients WHERE id = ?').run(id)
}

export function obtenirDetailClient(id: number): ClientDetail {
  const client = getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id) as unknown as
    | Client
    | undefined
  if (!client) throw new Error("Ce client n'existe pas ou a été supprimé.")

  // Le montant des factures vient toujours du Journal, jamais d'une ressaisie.
  const lignesFactures = getDb()
    .prepare(
      `SELECT f.id, f.numero, f.date, f.statut,
        (SELECT SUM(j.montant) FROM journal j WHERE j.numero_facture = f.numero) AS montant
       FROM factures f
       WHERE f.client_id = ?
       ORDER BY f.date DESC, f.id DESC`
    )
    .all(id) as unknown as {
    id: number
    numero: string
    date: string
    statut: FactureDuClient['statut']
    montant: number | null
  }[]

  const maintenant = Date.now()
  const factures: FactureDuClient[] = lignesFactures.map((f) => ({
    id: f.id,
    numero: f.numero,
    date: f.date,
    statut: f.statut,
    montant: f.montant,
    joursEnAttente:
      f.statut === 'En attente'
        ? Math.floor((maintenant - new Date(f.date).getTime()) / (1000 * 60 * 60 * 24))
        : null
  }))

  const lignesDevis = getDb()
    .prepare(
      'SELECT id, numero, date, statut, remise_pct, tva_pct FROM devis WHERE client_id = ? ORDER BY date DESC, id DESC'
    )
    .all(id) as unknown as {
    id: number
    numero: string
    date: string
    statut: DevisDuClient['statut']
    remise_pct: number
    tva_pct: number
  }[]

  const devis: DevisDuClient[] = lignesDevis.map((d) => {
    const lignes = getDb()
      .prepare('SELECT quantite, prix_unitaire FROM devis_lignes WHERE devis_id = ?')
      .all(d.id) as unknown as { quantite: number; prix_unitaire: number }[]
    const { total } = calculerTotalDocument(
      lignes.map((l) => ({ quantite: l.quantite, prixUnitaire: l.prix_unitaire })),
      d.remise_pct,
      d.tva_pct
    )
    return { id: d.id, numero: d.numero, date: d.date, statut: d.statut, total }
  })

  const totalFacture = factures.reduce((s, f) => s + (f.montant ?? 0), 0)
  const totalEnAttente = factures
    .filter((f) => f.statut === 'En attente')
    .reduce((s, f) => s + (f.montant ?? 0), 0)

  return { ...client, factures, devis, totalFacture, totalEnAttente } satisfies ClientDetail
}
