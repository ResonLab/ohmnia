import { langue } from './i18n'

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
 * Pour ajouter un pays : copier un bloc ci-dessous et l'ajouter à PROFILS.
 */

export type CodePays = 'CH' | 'FR' | 'BE' | 'LU' | 'DE'

export interface TauxTva {
  libelle: string
  taux: number
}

/**
 * Ce qui suit la langue de l'interface — et **rien d'autre**.
 *
 * **La ligne de partage n'est pas le confort, c'est la destination.** Un texte
 * qui finit sur une facture appartient au pays d'émission ; un texte qui reste
 * à l'écran appartient au lecteur. `documents.ts` recopie `nomTaxe`,
 * `libelleIdentifiant` et `mentionNonAssujetti` dans le document imprimé : les
 * traduire produirait une facture allemande dont la taxe s'appellerait « VAT »,
 * ou une facture française portant une mention légale en anglais. Un défaut
 * pareil ne se découvre pas ici, il se découvre chez le client.
 *
 * Les champs ci-dessous ne partent nulle part : ils expliquent, ils situent, et
 * ils doivent suivre la langue de celui qui les lit.
 */
export interface EcranPays {
  /** Le nom du pays, tel qu'affiché dans la liste. */
  nom: string
  /** L'aide de saisie sous le champ d'identifiant. */
  aideIdentifiant: string
  /** Le seuil indicatif d'assujettissement, affiché à titre d'information. */
  seuilAssujettissement: string
  /** Les libellés des taux — « Taux normal », « Exonéré »… */
  libellesTaux: string[]
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

  /**
   * La version anglaise de ce qui reste à l'écran.
   *
   * **Il n'y a délibérément pas d'entrée pour `nomTaxe`, `libelleIdentifiant`
   * ni `mentionNonAssujetti`.** Ce n'est pas un oubli à combler : ces trois-là
   * partent sur le document et appartiennent au pays. `tests/pays.mjs` refuse
   * qu'on en ajoute une.
   */
  anglais: EcranPays
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
    delaiPaiementUsuel: 30,
    anglais: {
      nom: 'Switzerland',
      aideIdentifiant: 'Format CHE- followed by 9 digits, optionally VAT/MWST/IVA.',
      seuilAssujettissement: 'CHF 100,000 in annual turnover',
      libellesTaux: ['Standard rate', 'Reduced rate', 'Accommodation rate', 'Exempt']
    }
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
    delaiPaiementUsuel: 30,
    anglais: {
      nom: 'France',
      aideIdentifiant: '14 digits, in groups of 3, 3, 3 and 5.',
      seuilAssujettissement: 'base exemption thresholds vary by activity — check them',
      libellesTaux: ['Standard rate', 'Intermediate rate', 'Reduced rate', 'Special rate', 'Exempt']
    }
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
    delaiPaiementUsuel: 30,
    anglais: {
      nom: 'Belgium',
      aideIdentifiant: 'Format BE followed by 10 digits, starting with 0 or 1.',
      seuilAssujettissement: 'EUR 25,000 in annual turnover',
      libellesTaux: ['Standard rate', 'Intermediate rate', 'Reduced rate', 'Exempt']
    }
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
    delaiPaiementUsuel: 30,
    anglais: {
      nom: 'Luxembourg',
      aideIdentifiant: 'Format LU followed by 8 digits.',
      seuilAssujettissement: 'EUR 35,000 in annual turnover',
      libellesTaux: ['Standard rate', 'Intermediate rate', 'Reduced rate', 'Super-reduced rate', 'Exempt']
    }
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
    /**
     * **Cette mention part sur la facture, elle est donc en allemand — et rien
     * qu'en allemand.** Elle portait « (régime des petites entreprises) » en
     * français : une glose utile à qui règle l'application, imprimée telle
     * quelle sur un document destiné à un client allemand et à son
     * administration fiscale. L'explication a sa place à l'écran, pas sur la
     * facture.
     */
    mentionNonAssujetti: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
    seuilAssujettissement: "22 000 € de chiffre d'affaires l'année précédente",
    conservationAnnees: 10,
    delaiPaiementUsuel: 14,
    anglais: {
      nom: 'Germany',
      aideIdentifiant: 'Format DE followed by 9 digits.',
      seuilAssujettissement: 'EUR 22,000 in turnover in the previous year',
      libellesTaux: ['Standard rate', 'Reduced rate', 'Exempt']
    }
  }
}

export const PAYS_PAR_DEFAUT: CodePays = 'CH'

export function profilPays(code: string | null | undefined): ProfilPays {
  return PROFILS[(code as CodePays) ?? PAYS_PAR_DEFAUT] ?? PROFILS[PAYS_PAR_DEFAUT]
}

export function listePays(): ProfilPays[] {
  return Object.values(PROFILS)
}

/**
 * Ce qui s'affiche à l'écran pour un pays, dans la langue de l'interface.
 *
 * **Le seul point de passage, et il ne donne accès qu'à ce qui a le droit de
 * changer de langue.** Un appelant qui voudrait traduire `nomTaxe` ou
 * `mentionNonAssujetti` ne trouvera pas où : ces champs ne sont pas dans
 * `EcranPays`, et c'est le type qui le refuse, pas une consigne.
 */
export function ecranPays(profil: ProfilPays): EcranPays {
  return langue() === 'en'
    ? profil.anglais
    : {
        nom: profil.nom,
        aideIdentifiant: profil.aideIdentifiant,
        seuilAssujettissement: profil.seuilAssujettissement,
        libellesTaux: profil.tauxTva.map((t) => t.libelle)
      }
}

/** Formate un montant avec la devise du pays, sans jamais produire « NaN ». */
export function formaterMontant(valeur: number, code: string | null | undefined): string {
  const profil = profilPays(code)
  const nombre = Number.isFinite(valeur) ? valeur : 0
  return `${nombre.toFixed(2)} ${profil.symboleDevise}`
}
