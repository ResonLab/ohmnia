# Agenda de l'entreprise — conception

Date : 2026-10-08. Demande orale de Colin du 2026-10-06 (voir la mémoire `ohmnia-caisse-agenda`),
cadrée avec lui le 2026-10-08. Second sous-projet, après la caisse (0.3.0).
**Pas de synchronisation Google** : Colin a dit n'en avoir pas besoin.

## But

Un agenda interne à Ohmnia qui sert à deux choses : noter des **événements**, et suivre des **locations**
de matériel (ce que Colin faisait jusqu'ici à part, dans Lumika) : qui loue quoi, quand, en quelle
quantité, à quel prix, et sortir la facture sans la ressaisir. Tout reste local.

## Ce qui est décidé

- Module « Agenda » dans la barre latérale : grille du **mois** (précédent, suivant, « Aujourd'hui »),
  événements en pastilles avec l'heure, locations en barres sur plusieurs jours ; sous la grille, la
  **liste** des éléments du mois ; un clic ouvre le détail ; boutons « Ajouter un événement » et
  « Ajouter une location ».
- **Événement** : titre, début et fin (date et heure), lieu, notes. Pas de client.
- **Location** : client **obligatoire**, date de début et de fin (**jours entiers, bornes incluses**), notes,
  une ou plusieurs lignes {article de l'inventaire, **quantité**, **prix par jour**}. Total d'une ligne =
  quantité × nombre de jours × prix par jour ; total de la location = somme des lignes.
- Statuts d'une location : **Réservée**, **Rendue**, **Annulée**. Annuler garde la location lisible ; elle
  ne se supprime pas. Un événement, lui, peut être supprimé.
- **Une location ne modifie jamais le stock** : le matériel revient.
- **Disponibilité** d'un article sur des dates = stock actuel − somme des quantités déjà louées sur des dates
  qui se chevauchent (locations non annulées, la location qu'on modifie exclue). Une location « Rendue »
  compte encore pour ses dates. Si la quantité demandée dépasse la disponibilité, l'app **prévient et laisse
  enregistrer** (comme la caisse pour le stock) ; l'avertissement nomme l'article, la quantité demandée et
  la quantité disponible.
- **Créer la facture** : bouton actif si la location n'est pas annulée, a un total > 0 et n'a pas déjà de
  facture. Il crée un **brouillon** de facture pour le client : une ligne par ligne de location,
  désignation « Location <article>, du JJ.MM.AAAA au JJ.MM.AAAA », quantité = quantité × jours, prix
  unitaire = prix par jour, taux de taxe et délai de paiement par défaut de l'entreprise. **Les lignes de
  facture n'ont aucune référence d'inventaire** : sinon confirmer la facture retirerait du stock du matériel
  qui revient (voir `deduireStockUneFois` dans `domaines/factures.ts`). La location retient le numéro de la
  facture (`facture_id`) pour ne pas être facturée deux fois ; elle n'est ensuite plus liée au contenu de
  la facture (c'est une copie). L'écran affiche le numéro, et un bouton mène à Facturation, qui liste déjà
  les brouillons.
- Version visée : **0.4.0**.

## Données

- `evenements_agenda` : id, titre, debut (`YYYY-MM-DD HH:MM`), fin, lieu, notes.
- `locations` : id, client_id (référence `clients`, obligatoire), date_debut, date_fin (`YYYY-MM-DD`),
  statut (`Réservée` | `Rendue` | `Annulée`, défaut `Réservée`), notes, facture_id (entier nul par défaut,
  sans clé étrangère : la facture peut être supprimée sans casser la location).
- `location_lignes` : id, location_id (référence `locations`), reference_inventaire (sans clé étrangère vers
  `inventaire`, comme `facture_lignes`), designation (copiée), quantite, prix_par_jour.
- Tables neuves, donc `schema.sql` seulement (pas de migration de colonne).

## Découpage du code

- `src/shared/agenda.ts` : calcul pur, partagé avec l'écran : `nombreDeJours(debut, fin)`,
  `totalLigneLocation`, `totalLocation`, `periodesSeChevauchent(a, b)`, constantes des statuts.
- `src/main/domaines/agenda.ts` (sans Electron) : `listerAgenda(debut, fin)`, `enregistrerEvenement`,
  `supprimerEvenement`, `enregistrerLocation` (renvoie la location et ses avertissements),
  `changerStatutLocation`, `disponibiliteArticle(reference, debut, fin, exclureLocationId?)`,
  `creerFactureDepuisLocation(id)`.
- `src/main/ipc/agenda.ts`, `src/preload/index.ts`, `src/serveur/registre.ts`, `src/serveur/droits.ts`
  (lecture : lister, disponibilité ; écriture : tout le reste).
- `src/renderer/src/pages/Agenda.tsx` (+ entrée de menu dans `App.tsx`, qui lui passe une fonction pour
  ouvrir un autre module).
- `CONTEXTE.md` : compteurs de fichiers et section « L'agenda » ; clés `agenda.*` en français et anglais ;
  `tests/agenda.mjs` ajouté à `tests/lancer-tout.mjs`.

## Cas limites

- Fin avant début (événement ou location), titre vide, location sans ligne, quantité ≤ 0, prix < 0,
  article inconnu, client inconnu : refusés avec un message clair, rien d'écrit.
- Enregistrer une location et ses lignes est **tout ou rien**.
- Deux locations qui se touchent sans se chevaucher (l'une finit le 10, l'autre commence le 11) ne
  comptent pas l'une contre l'autre ; qui finit le 10 et commence le 10, si.
- Créer la facture deux fois : refusé. Si une étape échoue après la création du brouillon, le brouillon est
  supprimé (créer et enregistrer une facture ouvrent chacun leur transaction : on ne peut pas les imbriquer).
- Annuler une location déjà facturée est permis : la facture reste, à annuler séparément ; l'écran le dit.
- Un client qui a des locations ne peut pas être supprimé sans message clair (clé étrangère), comme avec
  ses factures.
- Garde de sortie : confirmation si l'on quitte le formulaire d'une location ou d'un événement modifié non
  enregistré (`gardeSortie.ts`).

## Vérification

`tests/agenda.mjs` sur une vraie base : durée en jours, chevauchements (bornes comprises), disponibilité
avec plusieurs locations et une annulée, avertissement sans blocage, refus sans rien écrire, facture
(lignes, quantités, prix, **aucune référence d'inventaire**, stock inchangé après confirmation de la
facture, pas de double facturation), annulation, événement sur plusieurs jours, atomicité en cas de panne.
Puis essai réel de l'app construite (profil jetable) : créer un événement et une location, déclencher un
avertissement, créer la facture, la retrouver dans Facturation.

## Hors périmètre

Synchronisation Google ou export .ics, rappels et notifications, événements récurrents, heures dans les
locations, tarif de location enregistré sur l'article, caution, état du matériel au retour, plusieurs
agendas.
