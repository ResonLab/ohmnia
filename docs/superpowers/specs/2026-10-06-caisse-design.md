# Caisse — conception

Date : 2026-10-06. Demande orale de Colin (voir la mémoire `ohmnia-caisse-agenda`).
Premier des deux sous-projets : la **caisse** ; l'**agenda de l'entreprise** (événements et locations) aura sa propre spécification ensuite. La synchronisation Google est abandonnée pour l'instant.

## But

Vendre des articles de l'inventaire comme à une vraie caisse : panier, paiement en espèces, par carte ou mixte, change en espèces, ticket PDF A4 (Colin n'a pas d'imprimante à tickets). Tout reste local.

## Ce qui est décidé

- Écran « Caisse » dans la barre latérale : liste d'articles de l'inventaire (avec recherche) et panier. Le prix vient de `prixVenteUnitaire`.
- Stock insuffisant : avertissement, vente autorisée (comme pour les factures).
- Paiement : **Carte**, **Espèces**, **Mixte** (part carte saisie, reste en espèces).
- Espèces : montant remis → rendu de monnaie.
- Change : si le client paie dans une autre devise, l'utilisateur choisit la devise et **saisit le taux** ; le dernier taux utilisé par devise est proposé. Pas de récupération en ligne. Le rendu est calculé dans la devise de l'entreprise.
- **Arrondi suisse** : quand la devise de l'entreprise est le CHF, la part payée **en espèces** est arrondie aux 5 centimes les plus proches (la part carte reste exacte). Le ticket affiche une ligne « Arrondi » si elle n'est pas nulle ; l'entrée du Journal en espèces porte le montant arrondi ; le rendu se calcule sur le montant arrondi. Aucun arrondi pour les autres devises.
- Chaque vente a un numéro de ticket séquentiel (T-0001…). Le stock baisse. Le Journal reçoit une entrée par mode de paiement, dans les catégories « Caisse – espèces » et « Caisse – carte » (créées si absentes). Une vente mixte crée donc deux entrées.
- Onglet « Journal de caisse » : liste des ventes, totaux du jour séparés espèces / carte.
- Annulation d'une vente : le stock est remis, les entrées du Journal sont retirées, l'action est tracée dans l'audit. La vente reste visible, marquée « Annulée », et son numéro n'est pas réutilisé.
- Ticket PDF A4 (via `src/main/pdf.ts`) : en-tête entreprise, numéro, date, lignes, total, mode(s) de paiement, ligne « Servi par … ».
- « Servi par » : champ des Paramètres « Nom affiché sur les tickets », modifiable, jamais écrit en dur ; vide → la ligne est omise.
- TVA : suit `assujetti_tva`. Non assujetti : aucune ligne de TVA, même mention que sur les factures. Assujetti : HT, TVA, TTC au taux `tva_defaut_pct`.

## Données

- `ventes_caisse` : id, numéro (unique), date, total (devise de l'entreprise), statut (`Validée` | `Annulée`), servi_par (copié au moment de la vente), tva_pct, montant_tva.
- `ventes_caisse_lignes` : vente_id, reference_inventaire (sans clé étrangère, comme `facture_lignes`), designation, quantite, prix_unitaire.
- `ventes_caisse_paiements` : vente_id, mode (`Espèces` | `Carte`), montant (devise de l'entreprise, arrondi inclus pour les espèces en CHF), arrondi, devise_recue, montant_recu, taux, rendu, ecriture_journal_id.
- Réglage « Nom affiché sur les tickets » dans les paramètres de l'entreprise ; derniers taux par devise dans les paramètres de l'app.
- Migration idempotente dans `src/main/db/migrations.ts`.

## Découpage du code

- `src/main/domaines/caisse.ts` : logique pure, sans Electron (calcul du total et de la TVA, répartition mixte, change et rendu, enregistrement d'une vente dans une transaction, annulation).
- `src/main/ipc/caisse.ts` : canaux IPC ; exposition dans `src/preload/index.ts` ; types dans `src/shared/types.ts`.
- `src/renderer/src/pages/Caisse.tsx` (+ journal de caisse) ; entrée dans `App.tsx`.
- Ticket : gabarit dans `ImpressionDocument` ou équivalent, imprimé par `pdf.ts`.
- Le mode multipostes doit couvrir les nouveaux canaux (le test `coherence-ipc` l'impose).

## Cas limites

- Panier vide, quantité nulle ou négative : refusés.
- Mixte : part carte comprise entre 0 et le total ; montant remis en espèces ≥ part espèces, sinon refus.
- Taux nul ou négatif : refusé.
- Vente enregistrée de façon atomique : tout ou rien (vente, lignes, paiements, stock, Journal).
- Garde de sortie : confirmation si l'on quitte la caisse avec un panier non vide (mécanisme `gardeSortie.ts` existant).

## Vérification

`tests/caisse.mjs`, ajouté à `tests/lancer-tout.mjs` : total et TVA (assujetti ou non), arrondi aux 5 centimes (espèces seulement, jamais sur la carte), rendu de monnaie, change, vente mixte, baisse de stock, entrées du Journal, annulation, atomicité en cas d'erreur. Puis essai réel sur l'app construite.

## Hors périmètre

Remises, lecteur de code-barres, tiroir-caisse physique, récupération automatique du taux, clôture comptable de caisse, agenda et locations (sous-projet suivant).
