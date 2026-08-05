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
git remote add origin https://github.com/Leimmingz/ohmnia.git
```

```bash
git branch -M main && git push -u origin main
```

---

## 2. Publier une version (et alimenter l'auto-updater)

### Une seule fois : renseigner ton dépôt

Dans `electron-builder.yml`, le compte est déjà renseigné :

```yaml
publish:
  - provider: github
    owner: Leimmingz
    repo: ohmnia
```

### Une seule fois : créer un jeton d'accès

`electron-builder` doit prouver à GitHub qu'il a le droit de téléverser sur ton dépôt.
C'est le rôle du jeton (*token*).

**1. Créer le jeton sur GitHub**

- Va sur [github.com/settings/tokens](https://github.com/settings/tokens)
- **Generate new token** → **Generate new token (classic)**
- Note : `Publication Ohmnia` — Expiration : 90 jours ou *No expiration*
- Coche **uniquement la case `repo`** (elle coche ses sous-cases automatiquement)
- **Generate token** en bas de page
- **Copie le jeton immédiatement** : il commence par `ghp_` et ne sera plus jamais
  réaffiché. Si tu le perds, il faudra en générer un autre.

**2. Le donner au terminal**

⚠️ **La commande dépend du terminal utilisé.** Les deux existent sous Windows et
n'ont pas la même syntaxe. Si tu te trompes, tu obtiens
`La syntaxe du nom de fichier, de répertoire ou de volume est incorrecte`.

Pour savoir où tu es : regarde le début de la ligne.
`C:\...>` = Invite de commandes · `PS C:\...>` = PowerShell.

**Invite de commandes** (`cmd.exe`) — ni guillemets, ni espaces autour du `=` :

```bash
set GH_TOKEN=ghp_colle-ton-jeton-ici
```

Vérification :

```bash
echo %GH_TOKEN%
```

**PowerShell** — avec guillemets, espaces autorisés :

```bash
$env:GH_TOKEN = "ghp_colle-ton-jeton-ici"
```

Vérification :

```bash
$env:GH_TOKEN.Substring(0,7)
```

Dans les deux cas, enchaîne avec `npm run publish:win` **dans la même fenêtre**.

> **Important** : cette variable ne vit que dans la fenêtre ouverte. Si tu la fermes,
> il faudra retaper la ligne à la prochaine publication. C'est volontaire : c'est le
> réglage le plus sûr.

**3. Si tu ne veux pas la retaper à chaque fois**

Enregistrement permanent pour ton compte Windows.

Invite de commandes :

```bash
setx GH_TOKEN "ghp_ton-jeton"
```

PowerShell :

```bash
[Environment]::SetEnvironmentVariable("GH_TOKEN", "ghp_ton-jeton", "User")
```

Ferme puis rouvre le terminal pour que ce soit pris en compte. Le jeton est alors
stocké dans ta session Windows — pratique, mais accessible à tout programme lancé
par ton compte. À éviter sur un ordinateur partagé.

Pour le retirer plus tard (invite de commandes) :

```bash
reg delete HKCU\Environment /v GH_TOKEN /f
```

### Sécurité du jeton — à lire

**Ce jeton est un mot de passe.** Qui l'a peut écrire sur tous tes dépôts.

- Ne le mets jamais dans un fichier du projet, ne le commite pas.
- **Ne le montre jamais dans une capture d'écran** — c'est la fuite la plus courante.
  Masque-le, ou ne copie que son début.
- Si tu penses qu'il a pu être vu : va sur
  [github.com/settings/tokens](https://github.com/settings/tokens), **supprime-le**,
  et génère-en un nouveau. C'est gratuit et immédiat.
- Un jeton avec une date d'expiration (90 jours) limite les dégâts en cas de fuite.

### Construire pour Linux : il faut passer par GitHub

`electron-builder` **ne sait pas produire un paquet Linux depuis Windows** : AppImage
et `.deb` exigent des outils qui n'existent que sous Linux. `npm run package:linux`
depuis l'invite de commandes échouera.

Deux solutions. La plus simple est de laisser GitHub construire à ta place, avec le
workflow [`.github/workflows/construire.yml`](.github/workflows/construire.yml) :

1. Va sur ton dépôt → onglet **Actions** → **Construire et publier** → **Run workflow**.
2. GitHub construit Windows **et** Linux, après avoir lancé `npm run verifier`.
3. Les installeurs apparaissent en pièces jointes en bas de la page du travail,
   téléchargeables pendant 14 jours. **Rien n'est publié.**

Aucun jeton à créer : GitHub en fournit un automatiquement, valable seulement pour
ce dépôt et le temps de l'exécution.

L'autre solution est d'installer une distribution dans WSL et de construire en local ;
c'est plus lourd, et inutile si le workflow suffit.

### Publier une version depuis GitHub

Plutôt que `npm run publish:win` avec ton jeton personnel, tu peux étiqueter la
version et laisser GitHub faire les deux systèmes :

```bash
git tag v0.2.0 && git push --tags
```

La *release* est créée en **brouillon**, avec les installeurs Windows et Linux et
les fichiers d'auto-mise à jour. Elle reste invisible tant que tu n'as pas cliqué
**Publish release**.

> Pense à incrémenter `version` dans `package.json` **avant** de poser l'étiquette :
> c'est ce numéro-là que lit l'auto-updater, pas le nom de l'étiquette.

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
`Leimmingz/ohmnia`, et coche la vérification automatique. À chaque nouvelle release
publiée, l'app propose la mise à jour.

`npm run package:win` construit **sans rien envoyer** — utile pour tester en local.

---

## 3. Le site vitrine (GitHub Pages)

### Mettre en place l'hébergement

1. Crée un dossier `docs/` à la racine du projet et places-y ton `index.html`.
2. Sur GitHub : **Settings → Pages → Source : Deploy from a branch**, branche `main`,
   dossier `/docs`.
3. Le site est publié sur `https://Leimmingz.github.io/ohmnia/` (compte quelques
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
   export const URL_CONDITIONS = 'https://Leimmingz.github.io/ohmnia/conditions.html'
   ```

3. Si tu modifies le texte des conditions, **incrémente aussi `VERSION_CONDITIONS`** :
   l'écran d'acceptation réapparaîtra pour que les utilisateurs relisent.

Garde les deux versions synchronisées : le texte dans l'app fait foi pour l'utilisateur,
la page web sert de référence consultable.

**Le lien de téléchargement toujours à jour** :
`https://github.com/Leimmingz/ohmnia/releases/latest`

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
