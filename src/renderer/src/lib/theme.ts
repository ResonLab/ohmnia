import type { Theme } from '../../../shared/types'

/** Éclaircit ou assombrit une couleur hexadécimale (facteur > 1 = plus clair). */
function ajusterLuminosite(hex: string, facteur: number): string {
  const nombre = parseInt(hex.slice(1), 16)
  const composantes = [(nombre >> 16) & 255, (nombre >> 8) & 255, nombre & 255]
  const ajustees = composantes.map((c) => Math.max(0, Math.min(255, Math.round(c * facteur))))
  return '#' + ajustees.map((c) => c.toString(16).padStart(2, '0')).join('')
}

const PALETTE_CLAIRE = {
  '--fond': '#f4f6f9',
  '--fond-panneau': '#ffffff',
  '--fond-carte': '#ffffff',
  '--fond-champ': '#f7f9fb',
  '--bordure': '#e2e6ec',
  '--bordure-claire': '#cfd6e0',
  '--texte': '#16202b',
  '--texte-doux': '#4d5b6b',
  '--texte-faible': '#8492a3',
  '--ombre': '0 1px 3px rgba(16, 32, 48, 0.08)'
}

/**
 * Applique le thème et la couleur d'accent en écrivant les variables CSS
 * sur l'élément racine. Le reste de la feuille de style suit automatiquement.
 */
export function appliquerTheme(theme: Theme, couleurAccent: string): void {
  const racine = document.documentElement

  const sombreSouhaite =
    theme === 'sombre' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (sombreSouhaite) {
    for (const cle of Object.keys(PALETTE_CLAIRE)) racine.style.removeProperty(cle)
  } else {
    for (const [cle, valeur] of Object.entries(PALETTE_CLAIRE)) racine.style.setProperty(cle, valeur)
  }

  racine.style.setProperty('--accent', couleurAccent)
  racine.style.setProperty('--accent-fonce', ajusterLuminosite(couleurAccent, 0.72))
  racine.style.setProperty('--accent-sombre', sombreSouhaite ? '#062b33' : '#0b2027')
  racine.style.setProperty(
    '--degrade-accent',
    `linear-gradient(135deg, ${couleurAccent}, ${ajusterLuminosite(couleurAccent, 0.72)})`
  )
}
