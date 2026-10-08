import type { StatutLocation } from './types'

/**
 * Calcul pur de l'agenda : dates, chevauchements, totaux, grille du mois.
 * Aucun accès à la base ni à la fenêtre : l'écran et le main process font
 * exactement les mêmes calculs.
 *
 * Les dates se manipulent comme des chaînes `YYYY-MM-DD`, jamais comme des
 * `Date` locales : un calcul en heure locale se décale d'un jour au passage à
 * l'heure d'été. On compte les jours en UTC, et on compare les chaînes (l'ordre
 * alphabétique des dates ISO est l'ordre chronologique).
 */

/**
 * Les valeurs stockées en base, nommées une fois. Un écran les compare à ces
 * constantes plutôt qu'à un mot français écrit en dur, que le contrôle de
 * traduction prendrait pour du texte d'interface.
 */
export const STATUT_LOCATION_RESERVEE: StatutLocation = 'Réservée'
export const STATUT_LOCATION_RENDUE: StatutLocation = 'Rendue'
export const STATUT_LOCATION_ANNULEE: StatutLocation = 'Annulée'

const FORMAT_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PAR_JOUR = 24 * 60 * 60 * 1000
const auCentime = (montant: number): number => Math.round(montant * 100 + 1e-9) / 100

function enJours(iso: string): number {
  const m = FORMAT_DATE.exec(iso)
  if (!m) throw new Error(`Date invalide : « ${iso} » (attendu AAAA-MM-JJ).`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PAR_JOUR
}

/** Nombre de jours d'une location, bornes comprises : du 10 au 12, c'est 3 jours. */
export function nombreDeJours(debut: string, fin: string): number {
  const jours = enJours(fin) - enJours(debut)
  if (jours < 0) throw new Error('La date de fin ne peut pas précéder la date de début.')
  return jours + 1
}

/** Deux périodes se chevauchent dès qu'elles ont un jour en commun, bornes comprises. */
export function periodesSeChevauchent(
  a: { debut: string; fin: string },
  b: { debut: string; fin: string }
): boolean {
  return a.debut <= b.fin && b.debut <= a.fin
}

export function totalLigneLocation(ligne: { quantite: number; prixParJour: number }, jours: number): number {
  return auCentime(ligne.quantite * ligne.prixParJour * jours)
}

export function totalLocation(lignes: { quantite: number; prixParJour: number }[], jours: number): number {
  return auCentime(lignes.reduce((somme, l) => somme + totalLigneLocation(l, jours), 0))
}

/** `2026-10-08` devient `08.10.2026`. */
export function formaterDateCourte(iso: string): string {
  const m = FORMAT_DATE.exec(iso)
  if (!m) throw new Error(`Date invalide : « ${iso} » (attendu AAAA-MM-JJ).`)
  return `${m[3]}.${m[2]}.${m[1]}`
}

/**
 * Les 42 jours (6 semaines, du lundi au dimanche) qui remplissent la grille d'un
 * mois. `mois` va de 1 à 12. La première semaine commence le lundi qui contient
 * le 1er du mois.
 */
export function grilleDuMois(annee: number, mois: number): string[] {
  const premier = Date.UTC(annee, mois - 1, 1)
  const jourSemaine = new Date(premier).getUTCDay() // 0 = dimanche
  const decalage = (jourSemaine + 6) % 7 // jours depuis le lundi
  const jours: string[] = []
  for (let i = 0; i < 42; i++) {
    jours.push(new Date(premier + (i - decalage) * MS_PAR_JOUR).toISOString().slice(0, 10))
  }
  return jours
}
