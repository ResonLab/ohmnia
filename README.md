# Ohmnia

Application de gestion locale pour technicien électronicien indépendant (Suisse).
Tout fonctionne **hors ligne** : aucune donnée ne quitte l'ordinateur.

> Reprise du projet par une IA ou par toi après une pause : lis [CONTEXTE.md](CONTEXTE.md).
> Publication sur GitHub et site vitrine : [SITE-GITHUB.md](SITE-GITHUB.md).

## Lancer et construire

```bash
npm run dev          # lance l'app en développement (rechargement à chaud)
npm run verifier     # typecheck + toutes les suites de tests
npm run package:win  # construit release\Ohmnia Setup X.Y.Z.exe (sans publier)
npm run publish:win  # construit ET publie sur les GitHub Releases
```

`npm run verifier` doit passer avant toute publication : il vérifie les types,
la cohérence des canaux IPC, la sécurité Electron, les analyseurs de relevés
bancaires, le chiffrement des sauvegardes et les correctifs de régression connus.

## Où sont mes données

| Quoi | Où |
|---|---|
| Base de données | `%APPDATA%\Ohmnia\gestion.sqlite` |
| Sauvegardes automatiques | `%APPDATA%\Ohmnia\Backups\` |
| Justificatifs (photos) | `%APPDATA%\Ohmnia\Justificatifs\` |
| Logo de l'entreprise | `%APPDATA%\Ohmnia\Logo\` |
| PDF générés | `Documents\Ohmnia\{Factures,Devis,Rappels}\` (modifiable) |

Une sauvegarde est créée automatiquement **au démarrage** et **avant chaque export PDF**.
Désinstaller l'application ne supprime jamais ces données.

## Diffuser une mise à jour aux autres postes

L'auto-update est **désactivé par défaut** : sans adresse configurée, l'application
ne fait aucun accès réseau. Pour l'activer, il faut un endroit accessible en HTTP
où déposer les fichiers de version.

### 1. Construire la nouvelle version

Incrémenter `version` dans `package.json` (ex. `0.1.0` → `0.2.0`), puis :

```bash
npm run package:win
```

Le dossier `release\` contient alors les trois fichiers nécessaires :
`latest.yml`, `Ohmnia Setup X.Y.Z.exe` et son `.blockmap`.

### 2. Publier ces fichiers

Copier **tout le contenu de `release\`** vers l'emplacement choisi :

| Situation | Solution |
|---|---|
| Postes sur le même réseau | Dossier partagé servi en HTTP (IIS, ou `npx http-server` sur un poste allumé). Reste entièrement sur le réseau local. |
| Postes à distance | Une *release* GitHub, ou n'importe quel hébergement web statique. |

### 3. Configurer chaque poste, une seule fois

Dans **Paramètres de l'app → Mises à jour**, renseigner l'adresse (celle qui expose
`latest.yml`), par exemple `http://192.168.1.20/ohmnia`, et cocher la vérification
automatique au démarrage si souhaité.

Ensuite, à chaque nouvelle version publiée, les postes proposent la mise à jour.
Le téléchargement et l'installation restent des actions explicites de l'utilisateur ;
une sauvegarde de la base est faite automatiquement avant le redémarrage.

**Limite connue** : l'exe n'étant pas signé avec un certificat commercial, Windows
SmartScreen peut avertir à la première installation sur un poste.

## Structure du code

```
src/
  main/                 process principal (Node) — accès disque et base de données
    index.ts            création de la fenêtre, enregistrement des modules IPC
    pdf.ts              génération des PDF (facture, devis, rappel)
    db/
      schema.sql        toutes les tables (source de vérité du schéma)
      database.ts       ouverture, PRAGMA, transactions, checkpoint WAL
      migrations.ts     ajout de colonnes sans perte de données
      backup.ts         sauvegardes locales horodatées + rotation
      sauvegardeExterne.ts  sauvegarde chiffrée AES-256-GCM
      audit.ts          traçage et verrou des exercices clôturés
    ipc/                un fichier par domaine métier (clients, factures, …)
  preload/index.ts      pont sécurisé : seule porte entre l'interface et le système
  renderer/src/         interface React
    App.tsx             menu et navigation
    pages/              un fichier par écran
    components/         éléments réutilisables (modale, logo, graphiques…)
    lib/                thème et valeurs suggérées
  shared/
    types.ts            types partagés entre les trois couches
    calculs.ts          TOUTES les formules métier (divisions protégées)
```

## Règles à respecter si tu modifies le code

1. **Les formules vivent dans `src/shared/calculs.ts`**, jamais dupliquées ailleurs.
   Toute division passe par `diviserSansErreur()` pour éviter les `NaN`/`Infinity`.

2. **Ajouter une colonne à une table existante** : l'écrire dans `schema.sql`
   (nouvelles installations) **et** dans `COLONNES_ATTENDUES` de `migrations.ts`
   (installations existantes). Ne jamais supprimer la base pour appliquer un changement.

3. **Toute opération touchant plusieurs tables** passe par `dansUneTransaction()` :
   soit tout réussit, soit rien n'est modifié.

4. **Copier le fichier de la base** exige d'abord `viderJournalWal()`. En mode WAL,
   les écritures récentes sont dans `gestion.sqlite-wal` : sans checkpoint, la copie
   est incomplète voire inutilisable.

5. **Nouveau canal IPC** : le déclarer dans `src/main/ipc/*.ts` (`ipcMain.handle`)
   **et** dans `src/preload/index.ts` (`ipcRenderer.invoke`). Le renderer n'a jamais
   d'accès direct au disque ou à la base.

6. **`window.prompt()` ne fonctionne pas dans Electron.** Utiliser le composant
   `Modale` pour toute saisie ponctuelle. `alert()` et `confirm()` fonctionnent.

7. **Le document PDF ne doit contenir aucune information interne** (notes de travail,
   case « à imprimer », marges). Il est volontairement en thème clair, contrairement
   à l'interface.

## Choix techniques

- **`node:sqlite` plutôt que `better-sqlite3`** : module intégré à Node, donc aucune
  compilation native, aucun rebuild à chaque montée de version d'Electron, et pas
  besoin de Visual Studio Build Tools.
- **Sécurité Electron** : `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, CSP stricte, requêtes SQL toujours préparées.
- **Pas d'ORM, pas de state manager** : SQL lisible écrit à la main, hooks React
  standards. Objectif : que le code reste modifiable sans expertise.
