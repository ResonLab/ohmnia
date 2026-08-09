# CONTEXTE — Ohmnia

> **À lire en premier si tu es une IA qui reprend ce projet.**
> Ce fichier contient tout le nécessaire pour continuer sans rien redécouvrir.
> Le [README.md](README.md) contient les commandes et les règles de code ; ce fichier-ci
> contient l'historique des décisions, les pièges connus et ce qui reste à faire.

## Démarrage immédiat

```bash
npm install          # première fois seulement
npm run verifier     # doit passer avant et après toute modification
npm run dev          # lance l'application
```

Si `npm run verifier` échoue avant même que tu aies touché au code, **arrête-toi et
signale-le** : quelque chose a été cassé entre-temps.

Emplacement du projet : `C:\Users\colin\Desktop\Gestion\APP`
Données de l'utilisateur : `%APPDATA%\Ohmnia\` (jamais dans le projet)

> **L'utilisateur travaille dans l'Invite de commandes (`cmd.exe`), pas PowerShell.**
> Quand tu lui donnes une commande, utilise la syntaxe cmd ou précise le terminal.
> Exemple : `set VAR=valeur` (cmd) et non `$env:VAR = "valeur"` (PowerShell).
> Repère : `C:\...>` = cmd · `PS C:\...>` = PowerShell.

---

## 1. Le projet en une page

**Ohmnia** est une application de gestion pour indépendant (à l'origine un technicien
électronicien en Valais, Suisse). Elle remplace un fichier Excel/VBA fragile.

- **Desktop, 100 % local.** Aucune donnée ne quitte l'ordinateur. Le seul accès réseau
  possible est la vérification de mise à jour, et il est **désactivé par défaut**.
- **Pile** : Electron 43 + React 19 + TypeScript + SQLite (`node:sqlite`), empaquetée
  en `.exe` Windows par `electron-builder`.
- **Langue de travail** : tout est en français — code, commentaires, noms de variables,
  noms de colonnes SQL. L'interface est traduisible FR/EN.

### Contraintes posées par l'utilisateur, à respecter

1. **Le code doit rester simple à relire et à modifier par lui.** Il n'est pas
   développeur professionnel. Pas d'ORM, pas de state manager, pas d'abstraction
   inutile. SQL écrit à la main et lisible.
2. **Fiable, sécurisé et optimisé**, mais sans sacrifier le point 1.
3. **Messages d'erreur en français, précis et compréhensibles** — jamais un message
   technique brut.
4. Toutes les divisions protégées contre zéro. Aucune donnée d'exemple comptée
   dans les totaux.

---

## 2. Décisions techniques et pourquoi

| Décision | Raison |
|---|---|
| **`node:sqlite` et pas `better-sqlite3`** | `better-sqlite3` exige Visual Studio Build Tools (absents de la machine) et une recompilation à chaque montée de version d'Electron. `node:sqlite` est intégré à Node 24 — zéro dépendance native. |
| **Preload compilé en CommonJS** | Un preload `sandbox: true` ne peut pas charger de vrai module ESM. Forcé via `output.format: 'cjs'` dans `electron.vite.config.ts`. Le fichier produit est `index.js`, pas `index.mjs`. |
| **`app.setName('Ohmnia')` explicite** | Sans cela, le dossier de données changeait selon le mode de lancement (`Electron` au lieu de `Ohmnia`). Bug réel rencontré. |
| **Migration de dossier de données** | L'app s'appelait `gestion-electronicien` avant d'être renommée. `src/main/db/migration-dossier.ts` reprend automatiquement l'ancien dossier. |
| **Pas de clé étrangère sur `reference_inventaire`** | La spec veut qu'on puisse facturer un article absent de l'inventaire (simple avertissement). La contrainte bloquait tout enregistrement — bug réel signalé par l'utilisateur. |
| **Checkpoint WAL avant toute copie de la base** | Sans lui, la copie ne contenait même pas les tables. Les sauvegardes étaient inutilisables. Bug grave trouvé en test. |
| **Modale interne au lieu de `window.prompt()`** | Electron n'implémente pas `prompt()`. `alert()` et `confirm()` fonctionnent. |

---

## 3. Bugs réels rencontrés (ne pas les réintroduire)

1. **Sauvegardes vides (grave).** Mode WAL : les écritures récentes vivent dans
   `gestion.sqlite-wal`. Copier seulement `gestion.sqlite` produisait une copie
   sans même les tables. → `viderJournalWal()` avant toute copie.
2. **`FOREIGN KEY constraint failed` à l'enregistrement d'une facture.** Contrainte
   sur `facture_lignes.reference_inventaire`. → Retirée par migration.
3. **Import bancaire lisant la colonne Solde** au lieu du Montant. → Lecture des
   en-têtes (Débit/Crédit/Montant/Solde), avec repli si pas d'en-tête.
4. **`prompt() is not supported`** → composant `Modale`.
5. **Tableaux larges coupés** quand la fenêtre n'est pas en plein écran.
   → `overflow-x: auto` sur `.carte` + `minWidth` sur la fenêtre.
6. **Ajout rapide inutilisable** : il manquait les destinations Facture, Devis et Client.
7. **Un test de cohérence mal conçu** exigeait la *présence* d'un placeholder :
   il échouait dès que l'utilisateur le remplaçait, c'est-à-dire dès qu'il faisait
   ce qu'on lui demandait. Une vérification doit constater un état correct, pas
   figer un état transitoire.
8. **Une documentation non vérifiée dérive.** CONTEXTE.md annonçait des compteurs
   faux quelques heures après sa rédaction. D'où la suite `coherence-documentation.mjs`
   qui vérifie automatiquement ses affirmations.

---

## 4. Structure

```
src/
  main/                 process principal (Node) — seul à toucher disque et base
    index.ts            fenêtre, enregistrement des 22 modules IPC
    pdf.ts              génération PDF (facture, devis, rappel)
    maj.ts              mises à jour (GitHub ou URL), désactivées par défaut
    db/
      schema.sql        SOURCE DE VÉRITÉ du schéma
      migrations.ts     ajout de colonnes + retrait de contraintes, sans perte
      database.ts       ouverture, PRAGMA, transactions, checkpoint WAL
      backup.ts         sauvegardes locales horodatées + rotation
      sauvegardeExterne.ts  chiffrement AES-256-GCM (scrypt)
      audit.ts          traçage + verrou des exercices clôturés
      migration-dossier.ts  reprise de l'ancien dossier de données
    ipc/                un fichier par domaine (20 fichiers)
  preload/index.ts      pont sécurisé — seule porte entre interface et système
  renderer/src/
    App.tsx             menu, navigation, thème, langue, Ctrl+K, écran de conditions
    pages/              17 écrans
    components/         8 composants (Modale, Camembert, BarresAnnuelles,
                        LogoOhmnia, ConditionsUtilisation, RechercheGlobale…)
    lib/                theme.ts, devise.ts, suggestions.ts
  shared/               partagé entre les trois couches
    types.ts            tous les types
    calculs.ts          TOUTES les formules métier
    pays.ts             profils CH / FR / BE / LU / DE
    i18n.ts             traductions FR/EN
    conditions.ts       conditions d'utilisation de l'app + version
tests/                  10 suites — `npm run verifier`
```

Les compteurs ci-dessus doivent rester exacts : `npm test` vérifie que **tous** les
modules IPC sont enregistrés au démarrage et affiche leur nombre.

---

## 5. Règles impératives

1. **Une formule = un seul endroit** : `src/shared/calculs.ts`. Toute division passe
   par `diviserSansErreur()`.
2. **Ajouter une colonne** : l'écrire dans `schema.sql` **ET** dans `COLONNES_ATTENDUES`
   de `migrations.ts`. Ne jamais supprimer la base pour appliquer un changement —
   l'utilisateur a de vraies données.
3. **Opération multi-tables** → `dansUneTransaction()`.
4. **Copier le fichier de base** → `viderJournalWal()` d'abord.
5. **Nouveau canal IPC** → déclarer dans `src/main/ipc/*.ts` (`ipcMain.handle`) **et**
   dans `src/preload/index.ts` (`ipcRenderer.invoke`). `npm test` vérifie l'appariement.
6. **Pas de `window.prompt()`** → composant `Modale`.
7. **Le PDF ne contient aucune information interne** (notes de travail, case
   « à imprimer », marges). Thème clair, contrairement à l'interface.
8. **Vérifier avant de livrer** : `npm run verifier`.

---

## 6. Modules livrés

Accueil (tableau de bord) · Ajout rapide (8 destinations) · Clients (fiche + factures)
· Facturation (+ duplication, rappels, modèles) · Devis (+ conversion en facture)
· Suivi du temps (chrono → lignes de facture) · Journal (+ justificatifs photo,
graphiques) · Inventaire (alertes de seuil, décrément auto) · Modèles de prestations
· Tarifs & Marge · Charges & Marge · Résumé annuel · Import/Export comptable
(CSV + CAMT.053) · Audit & clôtures d'exercice · Mon entreprise (pays, TVA, CGV)
· Paramètres de l'app (thème, langue, sauvegardes, mises à jour)

---

## 7. Conformité et cadre légal

- **Profils pays** dans `src/shared/pays.ts` : CH, FR, BE, LU, DE. Chacun porte
  devise, taux de taxe, format d'identifiant fiscal, mention de non-assujettissement,
  seuil indicatif, durée de conservation.
- **Ces valeurs sont des points de départ à vérifier**, pas une certification. Les
  taux et surtout les seuils changent. C'est écrit dans le fichier et dans l'interface.
- **Case « assujetti à la TVA »** : si décochée, aucun montant de taxe n'est facturé
  et la mention légale du pays est imprimée. Le taux est forcé à 0.
- **Conditions générales** modifiables, avec un modèle de départ. L'utilisateur a été
  averti qu'une clause ne peut pas exclure la responsabilité en cas de faute grave
  ou intentionnelle (art. 100 CO en Suisse) et qu'un juriste doit relire.
- **Panneau de conformité** (module Audit) : contrôle les mentions obligatoires,
  la continuité et l'unicité de la numérotation. Il ne certifie rien.

### Deux textes juridiques distincts — ne pas les confondre

| | Conditions **de vente** | Conditions **d'utilisation** |
|---|---|---|
| Fichier | saisies par l'utilisateur en base | `src/shared/conditions.ts` |
| Entre qui | l'utilisateur et **ses clients** | l'éditeur d'Ohmnia et **l'utilisateur** |
| Où | Mon entreprise → imprimées sur factures | Écran au premier lancement |
| Sujet | garantie, paiement, réserve de propriété | l'app ne rend pas conforme, pas de garantie |

L'écran d'acceptation bloque l'application tant qu'il n'est pas validé. La case ne
s'active qu'après défilement complet du texte. **Incrémenter `VERSION_CONDITIONS`
à chaque modification du texte** : l'écran réapparaît alors pour relecture.
`URL_CONDITIONS` pointe vers https://leimmingz.github.io/ohmnia/conditions.html.
La suite `tests/coherence-site.mjs` compare le texte de la page publique à ce fichier :
modifier l'un sans l'autre fait échouer `npm run verifier`.

---

## 8. Ce qui reste à faire

### Traduction anglaise — partielle

**Fait** : infrastructure `src/shared/i18n.ts`, sélecteur de langue, navigation
complète, **documents PDF entièrement traduits** (testé FR et EN), paramètres
d'apparence.

**À faire** : le corps des 17 écrans est encore en français en dur (~400 chaînes).

Méthode, écran par écran :
1. Ajouter les chaînes dans `TEXTES` de `src/shared/i18n.ts` (clé préfixée par
   l'écran, ex. `client.nouveau`).
2. Dans le composant : `import { t } from '../../../shared/i18n'`, puis remplacer
   `Nouveau client` par `{t('client.nouveau')}`.
3. `npm run typecheck` — les clés inconnues sont rejetées à la compilation.

Les messages d'erreur du main process (`src/main/ipc/*.ts`) sont aussi en français ;
ils devront recevoir le même traitement, ou être renvoyés sous forme de clé.

### Autres pistes évoquées et non faites

- **QR-facture suisse** (Swiss QR-bill) — écartée par l'utilisateur, pas encore assujetti.
- **Décompte TVA trimestriel** — écarté pour la même raison.
- Ces deux points redeviendront pertinents dès qu'il dépassera le seuil.

### Publication — partiellement faite

**Fait** : dépôt public [github.com/Leimmingz/ohmnia](https://github.com/Leimmingz/ohmnia)
créé, branche `main` poussée. `gh` (GitHub CLI) installé mais **pas authentifié**
(`gh auth login` demande une interaction).

**En attente** : une branche `securite-et-documentation` est poussée et non fusionnée.
À intégrer avec `git checkout main && git merge securite-et-documentation && git push`.

**Fait** : le site est en ligne sur https://leimmingz.github.io/ohmnia/ (GitHub Pages,
branche `main`, dossier `/docs`). Douze pages, six en français et six en anglais
dans `docs/en/`. Licence MIT ajoutée.

**Reste à faire** : aucune release publiée. Marche à suivre dans
[SITE-GITHUB.md](SITE-GITHUB.md) : jeton d'accès → `npm run publish:win`.
La cible Linux (AppImage et `.deb`) est configurée mais jamais construite :
electron-builder ne sait pas produire un paquet Linux depuis Windows, il faut
WSL ou GitHub Actions.

Tant qu'aucune release n'existe, l'auto-updater n'a rien à trouver.

---

## 9. État actuel

- `npm run verifier` : typecheck + 10 suites de tests, **tout passe**.
- Version `0.1.2`. Construite par GitHub Actions pour Windows et Linux.
  Corrige deux defauts : les boites de dialogue natives sans fenetre parente,
  qui pouvaient passer derriere l'app en gardant le focus clavier, et la
  verification de mise a jour qui restait figee sans message.
  L'ancienne release `0.1.0`, televersee a la main, a une auto-mise a jour
  cassee : son `latest.yml` annonce `Ohmnia-Setup-0.1.0.exe` alors que le
  fichier en ligne s'appelle `Ohmnia.Setup.0.1.0.exe` (404). A supprimer.
  Ancien installateur local : `release\Ohmnia Setup 0.1.0.exe` (96 Mo) avec
  `latest.yml` pour l'auto-updater.
- Base de l'utilisateur : `%APPDATA%\Ohmnia\gestion.sqlite`, 25 tables, intégrité `ok`.
- Les données de test créées pendant le développement ont été **supprimées**.
  L'entreprise « Valclair » est configurée, pays Suisse, non assujettie à la TVA.
- **Le logo de l'entreprise n'est pas configuré** : les PDF sortent sans logo tant
  que l'utilisateur n'en a pas choisi un dans « Mon entreprise ».
- Les conditions d'utilisation n'ont pas encore été acceptées : l'écran s'affichera
  au prochain lancement.

### Placeholders à remplacer avant diffusion

| Fichier | Valeur | État |
|---|---|---|
| `electron-builder.yml` | `owner` | ✔ renseigné : `Leimmingz` |
| `src/shared/conditions.ts` | `URL_CONDITIONS` | ✔ bascule sur l'adresse GitHub Pages faite |

Compte GitHub du projet : **Leimmingz**, dépôt prévu `ohmnia`.
`npm test` rappelle ce qui reste à remplacer sans faire échouer la vérification.

## 10. Sécurité — incident à connaître

Un jeton d'accès GitHub a été exposé en capture d'écran pendant le développement.
Il a été signalé et doit avoir été révoqué. **Si tu vois un secret dans une capture
ou un message, signale-le immédiatement et en premier**, avant toute autre réponse.

Rappels appliqués au projet :
- `.gitignore` exclut `.env` et `.claude/`
- Aucun secret n'est stocké dans le code
- Le mot de passe des sauvegardes chiffrées n'est enregistré nulle part (par choix)

---

## 11. Ton de travail attendu

L'utilisateur travaille souvent en autonomie déléguée (« débrouille-toi »). Il attend :
- qu'on **teste réellement** ce qu'on livre, pas qu'on affirme que ça marche ;
- qu'on **signale honnêtement** ce qui n'a pas pu être vérifié ;
- qu'on **corrige les bugs qu'il signale en cherchant la cause**, pas en contournant.

## 12. Chantier en cours : le serveur multi-postes (branche `serveur-multipostes`)

**`main` est intact et publiable.** Tout ce chantier vit sur une branche.

### Ce qui est fait

- `src/main/contexte.ts` : où vivent les données et quelle version tourne. La
  couche Electron le renseigne au démarrage. **La couche base de données
  n'importe plus Electron du tout.**
- `src/main/domaines/` : la logique métier, sans Electron. **Les 20 domaines
  sont convertis** — la conversion module par module est terminée.
- `src/main/ipc/` : ne fait plus que brancher les canaux sur la fenêtre.
  Il n'y reste du SQL que dans les trois endroits listés plus bas, où la
  requête ne fait qu'enregistrer le résultat d'une boîte de dialogue.
- `src/serveur/` : squelette de serveur HTTP qui réutilise `domaines/`.
  Protocole : `POST /api/<canal>` avec `{ "arguments": [...] }`.
  **Les noms de canaux sont exactement ceux de l'IPC**, pour que les deux modes
  ne puissent pas diverger. **99 opérations exposées.**
- `tests/serveur-multipostes.mjs` : démarre un vrai serveur sur une base
  temporaire et fait de vrais appels réseau.

**Étape 2 faite : comptes, droits, authentification.**

- `src/serveur/comptes.ts` : comptes, mots de passe, sessions, journal des
  accès. **Base séparée `comptes.sqlite`**, pas dans `gestion.sqlite` — les
  comptes seront communs à Ohmnia et Scenika, et le mode local ne doit pas
  hériter d'un schéma dont il n'a pas l'usage.
- `src/serveur/droits.ts` : **qui a le droit de quoi, dans un seul fichier**,
  opération par opération. Trois rôles : `lecture` < `ecriture` <
  `administration`.
- `src/serveur/index.ts` : toute opération métier exige une session. Le jeton
  voyage dans `Authorization: Bearer <jeton>`.
- `tests/serveur-authentification.mjs` : **compile le vrai serveur avec esbuild
  et l'attaque par le réseau.** Rien n'y est transcrit — une authentification
  réécrite pour le test ne prouverait que la justesse de la réécriture.

Protocole d'authentification :

| Appel | Effet |
|---|---|
| `serveur:etat` | public — dit si un compte existe déjà |
| `comptes:creerPremierAdministrateur` | public, mais **refusé dès qu'un compte existe** |
| `session:ouvrir` | public — rend un jeton valable 12 h |
| tout le reste | jeton obligatoire, rôle vérifié |

Codes de réponse : `400` erreur métier · `401` pas de session · `403` droits
insuffisants · `404` opération inconnue.

### Les garde-fous, à ne pas retirer

1. **Aucun import d'Electron** dans `domaines/` ni `serveur/`.
2. **Pas de réseau sans administrateur.** Le serveur refuse d'écouter ailleurs
   que sur `127.0.0.1` tant qu'aucun compte administrateur n'existe : sinon le
   premier venu créerait le sien et prendrait la comptabilité.
3. **Chaque opération du registre doit exister comme canal IPC.** Vérifié
   automatiquement : une faute de frappe fait échouer la suite.
4. **Chaque opération du registre doit avoir un droit déclaré.** Une opération
   sans droit est refusée à l'exécution, et `npm test` la signale. Les droits
   ne sont **jamais déduits du nom du canal** : une règle « `lister` = lecture »
   se tromperait en silence sur `conditions:accepter` ou `recherche:globale`.
5. **Le message d'échec de connexion est le même** que le compte existe ou non.
   Sinon la page de connexion devient un moyen de savoir qui travaille ici.
6. **Le dernier administrateur ne peut être ni rétrogradé ni désactivé.** Un
   serveur sans administrateur ne se reprend plus en main.

Tous ont été **vérifiés en les cassant volontairement**.

### Ce qui manque encore, et qu'il ne faut pas oublier

**Le transport n'est pas chiffré.** Mots de passe et jetons circulent en clair
en HTTP. Sur le réseau local d'une petite entreprise, c'est un risque assumé ;
dès que le serveur est joignable au-delà, il faut le mettre derrière un
reverse-proxy HTTPS. C'est écrit en tête de `src/serveur/index.ts` pour que
personne ne le découvre en production.

### Ce qui reste volontairement dans `ipc/`

Cinq modules gardent une part Electron : **comptabilite, conditions,
entreprise, justificatifs, parametresApp**. Ils ouvrent des sélecteurs de
fichiers ou l'explorateur, ce qui n'a aucun sens sur un serveur. Ce qui reste
là-bas n'est jamais du métier :

| Module | Ce qui reste côté fenêtre |
|---|---|
| comptabilite | choisir le fichier de relevé à lire, choisir où écrire l'export CSV |
| conditions | ouvrir la page des conditions dans le navigateur du poste |
| entreprise | choisir le logo, le copier, le lire en data URL |
| justificatifs | ajouter, ouvrir, lire, supprimer les fichiers sur le disque |
| parametresApp | dossiers, sauvegardes, infos système, export de toutes les données |

**Les justificatifs sont le seul point vraiment en suspens** : leur lecture et
leur suppression visent le disque du poste. En mode serveur, ces fichiers
devront vivre à côté de la base du serveur. C'est une décision de l'étape 3,
pas d'un simple déplacement de code.

### Ce qui reste à faire

**Étape 3** : l'application sait se connecter à un serveur au lieu de sa base
locale. C'est là que ça devient visible pour l'utilisateur. Il faudra y
trancher trois points laissés ouverts :

- **Où vivent les justificatifs** en mode serveur (voir juste au-dessus).
- **Ce que l'interface fait d'un `401`** : une session de 12 h expire en pleine
  saisie. Reconnexion transparente ou écran de connexion qui préserve le
  travail en cours — mais jamais une perte silencieuse.
- **Ce qu'un rôle `lecture` voit à l'écran.** Aujourd'hui le serveur refuse
  l'écriture ; l'interface, elle, afficherait toujours ses boutons. Un bouton
  qui échoue systématiquement est une mauvaise interface : il faut les masquer
  selon le rôle rendu par `session:ouvrir`.

**Mise en service, quand l'étape 3 sera là** : démarrer le serveur sur
`127.0.0.1`, créer le premier administrateur, l'arrêter, le rouvrir sur
l'adresse du réseau. Le garde-fou impose cet ordre.

### Pièges rencontrés, à ne pas réintroduire

**Des vérifications visaient `ipc/`, où le code n'est plus.** Deux suites
lisaient le fichier source de `ipc/` : `audit-securite.mjs` y cherchait
`dansUneTransaction` dans les factures et les devis, et `parseurs-bancaires.mjs`
y découpait les analyseurs de relevés pour les exécuter. Déplacer le code sans
déplacer le contrôle aurait laissé passer une écriture hors transaction en mode
réseau. Les deux pointent désormais sur `domaines/`. **En convertissant un
module, chercher son nom dans `tests/` avant de conclure.**

`parseurs-bancaires.mjs` découpe `domaines/comptabilite.ts` entre deux
commentaires — « Découpe une ligne CSV » et « Marque les mouvements » — puis
retire les types pour exécuter le bloc. Ce bloc ne doit donc toucher ni la base
ni Electron, et ses fonctions doivent rester internes au module : le test
ajoute ses propres `export`.

**Le nom du canal doit tenir sur la même ligne qu'`ipcMain.handle(`.** Le
garde-fou qui apparie le registre et l'IPC cherche `ipcMain.handle('<canal>'`
d'un seul tenant. Une mise en forme sur plusieurs lignes rend le canal
invisible et fait échouer la suite, alors que le code est correct.

### Piège du premier jet

`fetch` garde des connexions dans un pool : Node plantait sur une assertion
interne en quittant, **alors que tous les tests passaient**. Le code de sortie
était faux. Dans les tests, utiliser le module `node:http` et ne jamais appeler
`process.exit()` pendant la fermeture des sockets.
