/**
 * Profils par pays.
 *
 * Chaque profil regroupe ce qui change d'un pays à l'autre sur une facture :
 * devise, taux de TVA, identifiant fiscal, mentions obligatoires.
 *
 * ATTENTION : ces valeurs sont des points de départ vérifiés à la rédaction,
 * mais les taux et surtout les seuils de franchise changent régulièrement.
 * Elles sont modifiables dans l'application et doivent être confirmées auprès
 * de l'administration fiscale ou d'un fiduciaire avant usage réel.
 *
 * Pour ajouter un pays : copier un bloc ci-dessous et l'ajouter à PROFILS_PAYS.
 */

export type CodePays = 'CH' | 'FR' | 'BE' | 'LU' | 'DE'

export interface TauxTva {
  libelle: string
  taux: number
}

export interface ProfilPays {
  code: CodePays
  nom: string
  devise: string
  /** Symbole ou code affiché après les montants. */
  symboleDevise: string
  /** Séparateur de milliers utilisé à l'affichage des montants. */
  locale: string

  /** Nom local de la taxe (TVA, USt…). */
  nomTaxe: string
  tauxTva: TauxTva[]
  tauxTvaParDefaut: number

  /** Nom et format de l'identifiant fiscal porté sur les factures. */
  libelleIdentifiant: string
  exempleIdentifiant: string
  /** Expression régulière de validation du format. */
  formatIdentifiant: RegExp
  aideIdentifiant: string

  /** Mention imprimée quand l'entreprise n'est pas assujettie à la taxe. */
  mentionNonAssujetti: string
  /** Seuil indicatif d'assujettissement obligatoire, à vérifier. */
  seuilAssujettissement: string
  /** Durée légale de conservation des pièces comptables, en années. */
  conservationAnnees: number
  /** Délai de paiement usuel, en jours. */
  delaiPaiementUsuel: number
}

const PROFILS: Record<CodePays, ProfilPays> = {
  CH: {
    code: 'CH',
    nom: 'Suisse',
    devise: 'CHF',
    symboleDevise: 'CHF',
    locale: 'fr-CH',
    nomTaxe: 'TVA',
    tauxTva: [
      { libelle: 'Taux normal', taux: 8.1 },
      { libelle: 'Taux réduit', taux: 2.6 },
      { libelle: 'Taux hébergement', taux: 3.8 },
      { libelle: 'Exonéré', taux: 0 }
    ],
    tauxTvaParDefaut: 8.1,
    libelleIdentifiant: 'Numéro IDE',
    exempleIdentifiant: 'CHE-123.456.789',
    formatIdentifiant: /^CHE-\d{3}\.\d{3}\.\d{3}(\s?(TVA|MWST|IVA))?$/,
    aideIdentifiant: "Format CHE-123.456.789, suivi de « TVA » si vous êtes assujetti.",
    mentionNonAssujetti: "Non assujetti à la TVA (art. 10 al. 2 LTVA).",
    seuilAssujettissement: "100 000 CHF de chiffre d'affaires annuel",
    conservationAnnees: 10,
    delaiPaiementUsuel: 30
  },

  FR: {
    code: 'FR',
    nom: 'France',
    devise: 'EUR',
    symboleDevise: '€',
    locale: 'fr-FR',
    nomTaxe: 'TVA',
    tauxTva: [
      { libelle: 'Taux normal', taux: 20 },
      { libelle: 'Taux intermédiaire', taux: 10 },
      { libelle: 'Taux réduit', taux: 5.5 },
      { libelle: 'Taux particulier', taux: 2.1 },
      { libelle: 'Exonéré', taux: 0 }
    ],
    tauxTvaParDefaut: 20,
    libelleIdentifiant: 'Numéro SIRET',
    exempleIdentifiant: '123 456 789 00012',
    formatIdentifiant: /^\d{3}\s?\d{3}\s?\d{3}\s?\d{5}$/,
    aideIdentifiant: 'SIRET à 14 chiffres. Ajoutez votre numéro de TVA intracommunautaire dans les mentions de pied si vous êtes assujetti.',
    mentionNonAssujetti: 'TVA non applicable, art. 293 B du CGI.',
    seuilAssujettissement: "seuils de franchise en base variables selon l'activité, à vérifier",
    conservationAnnees: 10,
    delaiPaiementUsuel: 30
  },

  BE: {
    code: 'BE',
    nom: 'Belgique',
    devise: 'EUR',
    symboleDevise: '€',
    locale: 'fr-BE',
    nomTaxe: 'TVA',
    tauxTva: [
      { libelle: 'Taux normal', taux: 21 },
      { libelle: 'Taux intermédiaire', taux: 12 },
      { libelle: 'Taux réduit', taux: 6 },
      { libelle: 'Exonéré', taux: 0 }
    ],
    tauxTvaParDefaut: 21,
    libelleIdentifiant: "Numéro d'entreprise (BCE)",
    exempleIdentifiant: 'BE 0123.456.789',
    formatIdentifiant: /^BE\s?0\d{3}\.\d{3}\.\d{3}$/,
    aideIdentifiant: 'Format BE 0123.456.789.',
    mentionNonAssujetti: "Régime de la franchise de taxe. TVA non applicable (art. 56bis du Code de la TVA).",
    seuilAssujettissement: "25 000 € de chiffre d'affaires annuel",
    conservationAnnees: 10,
    delaiPaiementUsuel: 30
  },

  LU: {
    code: 'LU',
    nom: 'Luxembourg',
    devise: 'EUR',
    symboleDevise: '€',
    locale: 'fr-LU',
    nomTaxe: 'TVA',
    tauxTva: [
      { libelle: 'Taux normal', taux: 17 },
      { libelle: 'Taux intermédiaire', taux: 14 },
      { libelle: 'Taux réduit', taux: 8 },
      { libelle: 'Taux super-réduit', taux: 3 },
      { libelle: 'Exonéré', taux: 0 }
    ],
    tauxTvaParDefaut: 17,
    libelleIdentifiant: 'Numéro de TVA',
    exempleIdentifiant: 'LU12345678',
    formatIdentifiant: /^LU\s?\d{8}$/,
    aideIdentifiant: 'Format LU suivi de 8 chiffres.',
    mentionNonAssujetti: 'Régime de franchise pour petites entreprises. TVA non applicable.',
    seuilAssujettissement: "35 000 € de chiffre d'affaires annuel",
    conservationAnnees: 10,
    delaiPaiementUsuel: 30
  },

  DE: {
    code: 'DE',
    nom: 'Allemagne',
    devise: 'EUR',
    symboleDevise: '€',
    locale: 'de-DE',
    nomTaxe: 'USt',
    tauxTva: [
      { libelle: 'Taux normal', taux: 19 },
      { libelle: 'Taux réduit', taux: 7 },
      { libelle: 'Exonéré', taux: 0 }
    ],
    tauxTvaParDefaut: 19,
    libelleIdentifiant: 'USt-IdNr.',
    exempleIdentifiant: 'DE123456789',
    formatIdentifiant: /^DE\s?\d{9}$/,
    aideIdentifiant: 'Format DE suivi de 9 chiffres.',
    mentionNonAssujetti:
      'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (régime des petites entreprises).',
    seuilAssujettissement: "22 000 € de chiffre d'affaires l'année précédente",
    conservationAnnees: 10,
    delaiPaiementUsuel: 14
  }
}

export const PROFILS_PAYS = PROFILS

export const PAYS_PAR_DEFAUT: CodePays = 'CH'

export function profilPays(code: string | null | undefined): ProfilPays {
  return PROFILS[(code as CodePays) ?? PAYS_PAR_DEFAUT] ?? PROFILS[PAYS_PAR_DEFAUT]
}

export function listePays(): ProfilPays[] {
  return Object.values(PROFILS)
}

/** Formate un montant avec la devise du pays, sans jamais produire « NaN ». */
export function formaterMontant(valeur: number, code: string | null | undefined): string {
  const profil = profilPays(code)
  const nombre = Number.isFinite(valeur) ? valeur : 0
  return `${nombre.toFixed(2)} ${profil.symboleDevise}`
}
