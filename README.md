<div align="center">

<img src="docs/logo.svg" alt="Ohmnia" width="80" height="80" />

# Ohmnia

**Gestion pour indépendants — facturation, devis, compta · 100 % local**

[![Windows](https://img.shields.io/badge/Windows-10%20%2F%2011-0078d4?style=flat-square&logo=windows&logoColor=white)](https://github.com/ResonLab/ohmnia/releases/latest)
[![Electron](https://img.shields.io/badge/Electron-43-47848f?style=flat-square&logo=electron&logoColor=white)](https://electronjs.org)
[![SQLite](https://img.shields.io/badge/SQLite-local-003b57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Site](https://img.shields.io/badge/Site-resonlab.github.io-16b981?style=flat-square)](https://resonlab.github.io/ohmnia/)
[![Licence](https://img.shields.io/badge/Licence-MIT-9f5cf7?style=flat-square)](LICENSE)

*Aucun compte · aucun serveur · aucune télémétrie*

🌐 **[Site web](https://resonlab.github.io/ohmnia/)** &nbsp;·&nbsp; 📥 **[Télécharger](https://github.com/ResonLab/ohmnia/releases/latest)** &nbsp;·&nbsp; 📄 **[Conditions](https://resonlab.github.io/ohmnia/conditions.html)** &nbsp;·&nbsp; ✉️ **[Contact](mailto:ohmnia@proton.me)**

</div>

---

## À propos

Ohmnia remplace le classeur Excel + macros VBA d'un indépendant par une vraie application. Factures, devis, suivi du temps, inventaire, journal des recettes et dépenses — le tout dans un fichier SQLite sur ton disque.

**Rien ne part sur Internet.** Pas de compte à créer, pas de serveur, pas de statistiques d'usage. Le seul accès réseau possible est la vérification de mise à jour, désactivée par défaut.

Le revers est assumé : personne ne peut récupérer tes données à ta place. Fais des copies.

---

## Installation

👉 **[Télécharger la dernière version](https://github.com/ResonLab/ohmnia/releases/latest)**

Lance `Ohmnia Setup X.Y.Z.exe`. Windows affichera un avertissement SmartScreen au premier lancement : l'exe n'est pas signé par un certificat commercial. **Informations complémentaires** → **Exécuter quand même**.

---

## Ce que ça fait

| Module | Détail |
|---|---|
| **Facturation** | Devis → facture en un clic, export PDF, duplication, modèles |
| **Rappels** | Échéances suivies, relances des impayés selon tes délais |
| **Suivi du temps** | Chrono par client et projet, report direct en ligne de facture |
| **Inventaire** | Articles, mouvements, alertes de seuil, décrément automatique |
| **Journal** | Recettes et dépenses, justificatifs photo, graphiques |
| **Banque** | Import CSV et CAMT.053, rapprochement automatique |
| **Sauvegardes** | Copies locales horodatées + archives chiffrées AES-256-GCM |
| **Multi-pays** | CH · FR · BE · LU · DE — taux, formats et mentions légales |
| **Audit** | Clôture d'exercice, verrou, contrôle de la numérotation |

> ⚠️ **Ohmnia ne te rend pas conforme.** Les taux et seuils proposés sont des points de départ, pas une certification. Voir les [conditions d'utilisation](https://resonlab.github.io/ohmnia/conditions.html).

---

## Où sont tes données

| Quoi | Où |
|---|---|
| Base de données | `%APPDATA%\Ohmnia\gestion.sqlite` |
| Sauvegardes | `%APPDATA%\Ohmnia\Backups\` |
| Justificatifs | `%APPDATA%\Ohmnia\Justificatifs\` |
| PDF générés | `Documents\Ohmnia\{Factures,Devis,Rappels}\` |

Une sauvegarde est créée **au démarrage** et **avant chaque export PDF**. Désinstaller l'application ne supprime jamais ces données.

---

## Développement

```bash
npm install
npm run dev          # lance l'app avec rechargement à chaud
npm run verifier     # typecheck + 18 suites de tests — doit passer avant toute publication
npm run package:win  # construit l'installeur, sans rien envoyer
npm run publish:win  # construit ET publie sur les GitHub Releases
```

### Pile

**Electron 43** · **React 19** · **TypeScript** · **`node:sqlite`** (module intégré à Node — aucune compilation native, aucun rebuild à chaque montée de version d'Electron).

Sécurité : `contextIsolation`, `sandbox`, `nodeIntegration: false`, CSP stricte, requêtes SQL toujours préparées.

### Structure

```
src/
  main/          process Node — seul à toucher le disque et la base
    db/          schéma, migrations, sauvegardes, chiffrement, audit
    ipc/         un fichier par domaine métier
  preload/       pont sécurisé : seule porte entre l'interface et le système
  renderer/      interface React (17 écrans)
  shared/        types, calculs, profils pays, traductions
tests/           9 suites — npm run verifier
```

### Les règles qui comptent

1. **Une formule = un seul endroit** : `src/shared/calculs.ts`. Toute division passe par `diviserSansErreur()`.
2. **Ajouter une colonne** → `schema.sql` **et** `COLONNES_ATTENDUES` de `migrations.ts`. Ne jamais supprimer la base pour appliquer un changement.
3. **Opération multi-tables** → `dansUneTransaction()`.
4. **Copier le fichier de base** → `viderJournalWal()` d'abord. En mode WAL, sans checkpoint la copie est inutilisable.
5. **Nouveau canal IPC** → le déclarer dans `src/main/ipc/*.ts` **et** dans `src/preload/index.ts`. `npm test` vérifie l'appariement.
6. **Pas de `window.prompt()`** dans Electron → composant `Modale`.
7. **Le PDF ne contient aucune information interne** (notes, marges, case « à imprimer »).

Le code, les commentaires et les colonnes SQL sont **en français**, volontairement : ce projet doit rester relisable par son auteur, qui n'est pas développeur de métier. Pas d'ORM, pas de state manager, du SQL écrit à la main.

📖 Historique des décisions, pièges connus et reste à faire : **[CONTEXTE.md](CONTEXTE.md)** · Publication et site : **[SITE-GITHUB.md](SITE-GITHUB.md)**

---

## Contact

Une question, un bug, une idée ? **[ohmnia@proton.me](mailto:ohmnia@proton.me)** ou une [issue GitHub](https://github.com/ResonLab/ohmnia/issues).

Ce n'est pas un service d'assistance : une seule personne développe Ohmnia, sur son temps. Les réponses arrivent quand elles arrivent.

---

## Les applications de la maison

Cinq programmes, cinq publics, une seule façon de travailler : vos données
restent sur votre machine.

- **Ohmnia** — gestion pour indépendant : facturation, devis, suivi du temps, inventaire *(vous y êtes)*
- [Scenika](https://github.com/ResonLab/scenika) — parc son et lumière, locations, puissance, adressage DMX
- [Acustika](https://github.com/ResonLab/acustika) — simulation acoustique : couverture d'enceintes dans une salle
- [Lumika](https://github.com/ResonLab/lumika) — plan de feu de théâtre : perches, patch, feuille imprimable
- [Nexika](https://github.com/ResonLab/nexika) — le serveur multi-postes, commun à Ohmnia et Scenika

Tout est présenté sur [resonlab.github.io](https://resonlab.github.io).

## Licence

[MIT](LICENSE) — fais-en ce que tu veux, sans garantie.
