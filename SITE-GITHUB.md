# Publier Ohmnia sur GitHub : dépôt, mises à jour et site vitrine

Trois choses différentes, à faire dans cet ordre :

1. **Le dépôt** — héberge le code (obligatoire pour le reste).
2. **Les releases** — hébergent les `.exe` et alimentent l'auto-updater.
3. **Le site vitrine** — page publique de présentation, via GitHub Pages.

---

## 1. Créer le dépôt

### Mettre le projet sous Git

Depuis `C:\Users\colin\Desktop\Gestion\APP` :

```bash
git init
```

```bash
git add . && git commit -m "Ohmnia 0.1.0"
```

Le `.gitignore` exclut déjà `node_modules/`, `out/`, `release/` et les données.
**Vérifie avant de publier qu'aucune donnée personnelle ne part** : ta base est dans
`%APPDATA%\Ohmnia`, hors du projet, donc normalement rien à craindre.

### Créer le dépôt sur GitHub

Sur [github.com/new](https://github.com/new) : nom `ohmnia`, **public** (nécessaire
pour que l'auto-updater fonctionne sans authentification), sans README ni .gitignore
(tu en as déjà).

Puis :

```bash
git remote add origin https://github.com/TON-COMPTE/ohmnia.git
```

```bash
git branch -M main && git push -u origin main
```

---

## 2. Publier une version (et alimenter l'auto-updater)

### Une seule fois : renseigner ton dépôt

Dans `electron-builder.yml`, remplace `VOTRE-COMPTE-GITHUB` par ton nom d'utilisateur :

```yaml
publish:
  - provider: github
    owner: TON-COMPTE
    repo: ohmnia
```

### Une seule fois : créer un jeton d'accès

`electron-builder` doit pouvoir téléverser sur tes releases.

1. [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new
   token (classic)**
2. Coche uniquement **`repo`**
3. Copie le jeton (il ne sera plus affiché)

Puis, dans le terminal, avant de publier :

```bash
$env:GH_TOKEN = "colle-ton-jeton-ici"
```

Ce jeton est un mot de passe : ne le mets jamais dans un fichier du projet.

### À chaque nouvelle version

1. Incrémente `version` dans `package.json` (`0.1.0` → `0.2.0`).
2. Vérifie que tout passe :

```bash
npm run verifier
```

3. Construis et publie :

```bash
npm run publish:win
```

La release apparaît sur GitHub avec l'installateur, `latest.yml` et le `.blockmap`.
Elle est créée en **brouillon** : va sur la page Releases du dépôt et clique
**Publish release** pour la rendre visible.

### Côté utilisateurs

Dans **Paramètres de l'app → Mises à jour** : source « Dépôt GitHub », dépôt
`TON-COMPTE/ohmnia`, et coche la vérification automatique. À chaque nouvelle release
publiée, l'app propose la mise à jour.

`npm run package:win` construit **sans rien envoyer** — utile pour tester en local.

---

## 3. Le site vitrine (GitHub Pages)

### Mettre en place l'hébergement

1. Crée un dossier `docs/` à la racine du projet et places-y ton `index.html`.
2. Sur GitHub : **Settings → Pages → Source : Deploy from a branch**, branche `main`,
   dossier `/docs`.
3. Le site est publié sur `https://TON-COMPTE.github.io/ohmnia/` (compte quelques
   minutes la première fois).

### Faire concevoir la page

Ouvre une **nouvelle conversation avec Claude** et donne-lui ce brief :

> Je veux une landing page pour **Ohmnia**, une application desktop de gestion
> (facturation, devis, comptabilité simplifiée, inventaire) pour indépendants,
> qui fonctionne **100 % en local, hors ligne**.
>
> Contraintes techniques : **un seul fichier `index.html`**, CSS et JS inclus
> dedans, aucune ressource externe (pas de CDN, pas de Google Fonts) — GitHub
> Pages doit pouvoir le servir tel quel. Responsive. Thème sombre par défaut
> avec adaptation au thème clair.
>
> Identité visuelle : dégradé turquoise `#1BE7B6` → bleu `#0E9CD9`, fond sombre
> `#0d1117`, cartes `#1a2130`. Le logo est un Ω (oméga) stylisé sur ce dégradé.
>
> Sections souhaitées :
> - Accroche : « La gestion de votre activité, entièrement sur votre ordinateur »
> - Argument central : **vos données ne quittent jamais votre machine**
> - Fonctionnalités : facturation et devis avec export PDF, rappels de paiement,
>   suivi du temps, inventaire avec alertes de stock, comptabilité simplifiée avec
>   import de relevés bancaires, sauvegardes chiffrées, multi-pays (CH/FR/BE/LU/DE)
> - Captures d'écran (je fournirai les images, prévois les emplacements)
> - Bouton de téléchargement pointant vers la dernière release GitHub
> - Pied de page : logiciel local, aucune télémétrie
>
> Ton : sobre et professionnel, pas de superlatifs marketing.

Ajoute ensuite tes captures dans `docs/images/` et pousse le tout.

### La page des conditions d'utilisation

L'application affiche au premier lancement un écran de conditions, avec un bouton
**« Lire sur le site »**. Il faut donc une page publique correspondante.

1. Crée `docs/conditions.html` reprenant **le même texte** que
   `src/shared/conditions.ts` (7 sections). Demande à Claude de le mettre en page
   avec la même identité visuelle que la landing page.
2. Dans `src/shared/conditions.ts`, remplace `URL_CONDITIONS` par l'adresse réelle :

   ```ts
   export const URL_CONDITIONS = 'https://TON-COMPTE.github.io/ohmnia/conditions.html'
   ```

3. Si tu modifies le texte des conditions, **incrémente aussi `VERSION_CONDITIONS`** :
   l'écran d'acceptation réapparaîtra pour que les utilisateurs relisent.

Garde les deux versions synchronisées : le texte dans l'app fait foi pour l'utilisateur,
la page web sert de référence consultable.

**Le lien de téléchargement toujours à jour** :
`https://github.com/TON-COMPTE/ohmnia/releases/latest`

---

## Points de vigilance

- **SmartScreen** : l'exe n'étant pas signé par un certificat commercial, Windows
  affichera un avertissement au premier lancement. C'est normal pour une application
  personnelle. Un certificat coûte quelques centaines de francs par an.
- **Dépôt public = code visible.** Le code d'Ohmnia ne contient aucun secret, mais
  ne commite jamais ton jeton GitHub ni un fichier de base de données.
- **Licence** : sans fichier `LICENSE`, ton code reste sous droit d'auteur classique
  (personne ne peut légalement le réutiliser). Si tu veux autoriser la réutilisation,
  ajoute une licence MIT depuis l'interface GitHub.
