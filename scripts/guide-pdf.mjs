import { app, BrowserWindow } from 'electron'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Imprime le guide en PDF, dans les deux langues.
 *
 * **Pourquoi un PDF alors que la page existe déjà** : on installe le logiciel
 * sur la machine de l'atelier ou dans un camion, sans le navigateur ouvert à
 * côté. Un PDF s'emporte, se lit hors ligne, s'imprime et se range dans un
 * dossier de production.
 *
 * **Il est déduit de la même source que les pages.** Ce qui s'écrit une fois ne
 * doit s'écrire qu'une fois : le guide vit dans `src/shared/guide.ts`, les
 * pages en sortent, et le PDF sort des pages. Un PDF rédigé à part divergerait
 * au premier correctif — et c'est le document qu'on emporte, donc celui qu'on
 * croit.
 *
 * Electron rend la page exactement comme l'application l'afficherait. Aucun
 * générateur de PDF supplémentaire, aucune police à embarquer.
 *
 *   npm run guide:pdf
 */
const PROJET = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Les pages à imprimer, et le nom du fichier produit. */
const PAGES = [
  ['docs/guide.html', 'release/Ohmnia-guide-fr.pdf'],
  ['docs/en/guide.html', 'release/Ohmnia-guide-en.pdf']
]

/**
 * Le style d'impression, injecté avant le rendu.
 *
 * La page du site est claire ou sombre selon le thème du lecteur ; un PDF, lui,
 * s'imprime. **Du texte clair sur fond sombre vide une cartouche et reste
 * illisible** — la même leçon que pour la feuille de patch. On force donc le
 * thème clair et on retire ce qui ne sert qu'à l'écran.
 */
const STYLE_PDF = `
  :root { color-scheme: light; }
  html { --bg: #fff; --bg-2: #fff; --card: #fff; --fg: #111; --fg-dim: #333;
         --fg-faint: #555; --border: #bbb; --stripe: #f2f2f2; --aurora-op: 0; }
  body { background: #fff !important; color: #111 !important; }
  header, footer, .aurora, .progres, .btn { display: none !important; }
  .js .reveal { opacity: 1 !important; transform: none !important; }
  .card { break-inside: avoid; border: 1px solid #ccc; background: #fff; }
  .hero { padding-top: 0; }
  .grad-text { color: #0E9CD9 !important; -webkit-text-fill-color: #0E9CD9 !important; }
  .piege { border-left: 3px solid #0E9CD9; color: #333; }
`

app.whenReady().then(async () => {
  mkdirSync(join(PROJET, 'release'), { recursive: true })

  /**
   * **Une seule fenêtre, réutilisée pour les deux pages.**
   *
   * Créer une seconde `BrowserWindow` après un `printToPDF` faisait échouer son
   * chargement sur `ERR_FAILED`, systématiquement, dès le deuxième fichier.
   * C'est le défaut noté depuis des semaines dans le LISEZ-MOI —
   * « fabriquer-icones.mjs échoue au-delà de la première image » — et c'est le
   * même : ce n'est pas le chemin qui est en cause, c'est la fenêtre.
   *
   * *Première hypothèse, fausse : l'URL. `loadFile` produit bien sous Windows
   * une adresse mêlant `file:///` et des antislashs. Corrigée avec
   * `pathToFileURL`, elle n'a rien changé — l'erreur est restée identique. On
   * garde la correction, qui est juste, mais elle n'explique rien.*
   */
  const fenetre = new BrowserWindow({ show: false, width: 1000, height: 1400 })

  for (const [source, cible] of PAGES) {
    await fenetre.loadURL(pathToFileURL(join(PROJET, source)).href)
    await fenetre.webContents.insertCSS(STYLE_PDF)

    // Les révélations au défilement laissent les blocs invisibles tant qu'on
    // n'a pas fait défiler. Sans ce coup de pouce, le PDF sortirait vide —
    // panne silencieuse, la pire espèce : le fichier existe et ne contient rien.
    await fenetre.webContents.executeJavaScript(`
      document.querySelectorAll('.reveal').forEach((e) => e.classList.add('vu'));
      document.body.classList.add('charge');
      true
    `)
    await new Promise((r) => setTimeout(r, 400))

    const pdf = await fenetre.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }
    })
    writeFileSync(join(PROJET, cible), pdf)

    // Un PDF vide pèse quelques kilooctets et s'ouvre sans erreur. On refuse
    // de livrer ça : mieux vaut un échec bruyant qu'un guide blanc dans une
    // release.
    const taille = readFileSync(join(PROJET, cible)).length
    if (taille < 20000) {
      console.error(`${cible} ne pèse que ${taille} octets — la page ne s'est pas rendue.`)
      app.exit(1)
      return
    }
    console.log(`${cible} écrit — ${Math.round(taille / 1024)} Ko`)
  }

  fenetre.destroy()

  app.quit()
})
