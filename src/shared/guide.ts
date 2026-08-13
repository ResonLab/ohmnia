/**
 * Le guide de prise en main — **comment on s'en sert**.
 *
 * Le site dit ce que fait Ohmnia. Il ne dit nulle part par où l'on commence.
 * Quelqu'un qui télécharge se retrouve devant une application vide sans savoir
 * quoi cliquer, et **c'est là qu'on perd les gens**, pas à la page d'accueil.
 *
 * Le texte vit ici, dans les deux langues, et **nulle part ailleurs** :
 * `scripts/publier-guide.mjs` en déduit les deux pages, `scripts/guide-pdf.mjs`
 * en tire le PDF joint aux releases.
 *
 * **L'ordre des étapes n'est pas décoratif.** On ne facture pas sans entreprise
 * configurée, on ne convertit pas un devis qui n'existe pas, on ne clôture pas
 * un exercice qu'on n'a pas rempli. Le guide suit l'ordre où l'application
 * refuse — le seul qui ne mène pas à un message d'erreur.
 */

export interface EtapeGuide {
  titre: { fr: string; en: string }
  texte: { fr: string; en: string }
  /** Ce qui coince à cette étape, et qu'on ne devine pas. */
  piege?: { fr: string; en: string }
}

export interface SectionGuide {
  titre: { fr: string; en: string }
  intro: { fr: string; en: string }
  etapes: EtapeGuide[]
}

export const GUIDE: SectionGuide[] = [
  {
    titre: { fr: '1. Configurer votre entreprise', en: '1. Set up your business' },
    intro: {
      fr: 'On commence toujours par là. Sans entreprise renseignée, une facture sort sans en-tête, sans identifiant fiscal et sans mentions légales — donc inutilisable.',
      en: 'Always start here. With no business details, an invoice comes out with no header, no tax number and no legal wording — therefore unusable.'
    },
    etapes: [
      {
        titre: { fr: 'Vos coordonnées et votre pays', en: 'Your details and your country' },
        texte: {
          fr: 'Écran Mon entreprise. Nom, adresse, contact, logo. Puis le pays : Suisse, France, Belgique, Luxembourg ou Allemagne. Le pays fixe la devise, le format d’identifiant fiscal, la durée de conservation et les mentions obligatoires.',
          en: 'My business screen. Name, address, contact, logo. Then the country: Switzerland, France, Belgium, Luxembourg or Germany. The country sets the currency, the tax-number format, the retention period and the mandatory wording.'
        },
        piege: {
          fr: 'Les taux et surtout les seuils fournis sont des **points de départ à vérifier**, pas une certification. Ils changent, et Ohmnia ne les met pas à jour toute seule. C’est écrit dans le fichier et dans l’interface.',
          en: 'The rates and above all the thresholds provided are **starting points to check**, not a certification. They change, and Ohmnia does not update them by itself. This is written in the file and in the interface.'
        }
      },
      {
        titre: { fr: 'La case « assujetti à la TVA »', en: 'The "VAT registered" box' },
        texte: {
          fr: 'Si vous n’êtes pas assujetti, décochez-la : aucun montant de taxe ne sera facturé, le taux est forcé à zéro, et la mention légale de non-assujettissement s’imprime automatiquement sur vos documents.',
          en: 'If you are not registered, untick it: no tax is charged, the rate is forced to zero, and the legal wording about non-registration prints automatically on your documents.'
        },
        piege: {
          fr: 'Vos conditions générales sont modifiables, avec un modèle de départ. **Une clause ne peut pas exclure votre responsabilité en cas de faute grave ou intentionnelle** — article 100 CO en Suisse. Faites relire ce texte par un juriste : Ohmnia ne fournit qu’un point de départ.',
          en: 'Your terms of sale are editable, with a starting template. **A clause cannot exclude your liability for gross negligence or intent** — article 100 CO in Switzerland. Have that text reviewed by a lawyer: Ohmnia only provides a starting point.'
        }
      }
    ]
  },
  {
    titre: { fr: '2. Vos clients et vos prestations', en: '2. Your customers and your services' },
    intro: {
      fr: 'Ce qu’on saisit une fois et qu’on réutilise cent fois. Cinq minutes ici en font gagner beaucoup à chaque facture.',
      en: 'What you enter once and reuse a hundred times. Five minutes here saves a lot on every invoice.'
    },
    etapes: [
      {
        titre: { fr: 'Les clients', en: 'Customers' },
        texte: {
          fr: 'Écran Clients. Chaque fiche garde l’historique de ses factures : ce qui est payé, ce qui est en retard, ce qu’il vous doit au total.',
          en: 'Customers screen. Each record keeps the history of its invoices: what is paid, what is overdue, what they owe you in total.'
        }
      },
      {
        titre: { fr: 'Les modèles de prestations', en: 'Service templates' },
        texte: {
          fr: 'Écran Modèles de prestations. Une désignation, un prix, une unité. Ensuite, une ligne de facture se remplit en un clic au lieu d’être retapée — et retapée, elle finit par varier d’une facture à l’autre.',
          en: 'Service templates screen. A description, a price, a unit. After that an invoice line fills in with one click instead of being retyped — and retyped, it eventually varies from one invoice to the next.'
        },
        piege: {
          fr: 'L’inventaire sert aussi de source pour les lignes : facturer un article le décrémente automatiquement. Un article absent de l’inventaire reste facturable — vous aurez seulement un avertissement, pas un refus. C’est délibéré : on ne bloque pas une facture parce qu’un stock n’est pas à jour.',
          en: 'The inventory also feeds invoice lines: invoicing an item decrements it automatically. An item missing from the inventory can still be invoiced — you only get a warning, not a refusal. This is deliberate: an invoice is not blocked because a stock figure is stale.'
        }
      }
    ]
  },
  {
    titre: { fr: '3. Devis, factures, rappels', en: '3. Quotes, invoices, reminders' },
    intro: {
      fr: 'Le cœur du métier. Un devis accepté devient une facture sans qu’on retape quoi que ce soit.',
      en: 'The heart of the job. An accepted quote becomes an invoice without retyping anything.'
    },
    etapes: [
      {
        titre: { fr: 'Du devis à la facture', en: 'From quote to invoice' },
        texte: {
          fr: 'Écran Devis pour établir, puis conversion en facture d’un bouton. La numérotation est continue et unique : c’est ce que contrôle le panneau de conformité.',
          en: 'Quotes screen to draft, then conversion to an invoice with one button. Numbering is continuous and unique: that is what the compliance panel checks.'
        },
        piege: {
          fr: 'Le PDF ne contient **aucune information interne** : ni vos notes de travail, ni la case « à imprimer », ni vos marges. Ce que vous voyez à l’écran et ce que reçoit le client ne sont pas la même chose, et c’est voulu.',
          en: 'The PDF contains **no internal information**: not your working notes, not the "to print" flag, not your margins. What you see on screen and what the customer receives are not the same thing, and that is intended.'
        }
      },
      {
        titre: { fr: 'Le suivi du temps', en: 'Time tracking' },
        texte: {
          fr: 'Écran Suivi du temps. Un chronomètre par intervention, qui se transforme ensuite en lignes de facture. C’est ce qui évite de facturer de mémoire une semaine après.',
          en: 'Time tracking screen. A stopwatch per job, which then turns into invoice lines. It is what keeps you from invoicing from memory a week later.'
        }
      },
      {
        titre: { fr: 'Les rappels', en: 'Reminders' },
        texte: {
          fr: 'Depuis une facture en retard, Ohmnia produit un rappel daté. Les modèles se dupliquent : une facture récurrente se refait en quelques secondes.',
          en: 'From an overdue invoice, Ohmnia produces a dated reminder. Invoices duplicate: a recurring invoice is redone in seconds.'
        }
      }
    ]
  },
  {
    titre: { fr: '4. La comptabilité, sans y passer ses soirées', en: '4. Bookkeeping, without losing your evenings' },
    intro: {
      fr: 'Le journal, l’import bancaire et le résumé annuel. C’est la partie qu’on repousse, et celle qui coûte le plus cher quand on la repousse.',
      en: 'The journal, the bank import and the annual summary. It is the part people put off, and the one that costs most when put off.'
    },
    etapes: [
      {
        titre: { fr: 'Importer un relevé bancaire', en: 'Import a bank statement' },
        texte: {
          fr: 'Écran Import/Export comptable. CSV ou CAMT.053. Ohmnia rapproche les mouvements de vos factures : ce qui correspond est pointé, le reste vous est présenté.',
          en: 'Accounting import/export screen. CSV or CAMT.053. Ohmnia reconciles the movements against your invoices: what matches is ticked, the rest is shown to you.'
        },
        piege: {
          fr: 'Un import bancaire lisait autrefois la colonne **Solde** au lieu du **Montant** — bug réel, corrigé, et la leçon est restée : Ohmnia lit maintenant les en-têtes (Débit, Crédit, Montant, Solde). Vérifiez tout de même les premières lignes d’un relevé d’une banque que vous importez pour la première fois.',
          en: 'A bank import once read the **Balance** column instead of the **Amount** — a real bug, fixed, and the lesson stuck: Ohmnia now reads the headers (Debit, Credit, Amount, Balance). Still, check the first few lines of a statement from a bank you are importing for the first time.'
        }
      },
      {
        titre: { fr: 'Les justificatifs', en: 'Receipts' },
        texte: {
          fr: 'Chaque écriture du journal accepte une photo de justificatif. Prise au moment de l’achat, elle ne se perd pas — contrairement au ticket dans la poche.',
          en: 'Each journal entry accepts a photo of the receipt. Taken at the moment of purchase, it does not get lost — unlike the slip in your pocket.'
        }
      },
      {
        titre: { fr: 'Clôturer un exercice', en: 'Close a financial year' },
        texte: {
          fr: 'Écran Audit & clôtures. Le panneau de conformité contrôle les mentions obligatoires, la continuité et l’unicité de la numérotation. Une fois l’exercice clôturé, il est verrouillé.',
          en: 'Audit & closing screen. The compliance panel checks mandatory wording, and the continuity and uniqueness of numbering. Once a year is closed, it is locked.'
        },
        piege: {
          fr: 'Le panneau de conformité **ne certifie rien**. Il vérifie ce qu’un programme peut vérifier — des mentions présentes, des numéros qui se suivent — et rien de ce qui relève du jugement. Votre comptable reste votre comptable.',
          en: 'The compliance panel **certifies nothing**. It checks what a program can check — wording present, numbers in sequence — and nothing that requires judgement. Your accountant remains your accountant.'
        }
      }
    ]
  },
  {
    titre: { fr: '5. Protéger vos données', en: '5. Protect your data' },
    intro: {
      fr: 'Tout est sur votre machine, et rien n’en sort. C’est la promesse d’Ohmnia — c’est aussi ce qui rend les sauvegardes entièrement votre affaire.',
      en: 'Everything is on your machine, and nothing leaves it. That is Ohmnia’s promise — it is also what makes backups entirely your responsibility.'
    },
    etapes: [
      {
        titre: { fr: 'Les sauvegardes', en: 'Backups' },
        texte: {
          fr: 'Écran Paramètres de l’app. Sauvegardes locales horodatées avec rotation, et sauvegarde externe chiffrée en AES-256 pour ce qui sort de la machine.',
          en: 'App settings screen. Timestamped local backups with rotation, and an AES-256 encrypted external backup for whatever leaves the machine.'
        },
        piege: {
          fr: 'Le mot de passe d’une sauvegarde chiffrée n’est enregistré nulle part, **par choix**. Perdu, il rend la sauvegarde définitivement illisible : personne ne peut le retrouver pour vous, et c’est précisément ce qui la protège.',
          en: 'The password of an encrypted backup is stored nowhere, **by choice**. Lost, it makes the backup permanently unreadable: nobody can recover it for you, and that is exactly what protects it.'
        }
      },
      {
        titre: { fr: 'Travailler à plusieurs', en: 'Working as a team' },
        texte: {
          fr: 'Paramètres de l’app → Mode multi-postes. Les postes parlent alors à un serveur Nexika que vous installez vous-même, sur votre réseau. Le mode local reste le défaut : sans choix explicite, rien ne change.',
          en: 'App settings → Multi-workstation mode. The machines then talk to a Nexika server you install yourself, on your network. Local mode stays the default: without an explicit choice, nothing changes.'
        },
        piege: {
          fr: 'En multi-postes, quatre opérations sont refusées avec un message qui dit pourquoi : sauvegardes locales, export global, choix du logo, justificatifs. Elles écriraient sur votre poste alors que les données sont sur le serveur — et un justificatif qu’on croit rangé mais qui n’existe nulle part est pire que pas de justificatif.',
          en: 'In multi-workstation mode, four operations are refused with a message explaining why: local backups, global export, logo selection, receipts. They would write to your machine while the data lives on the server — and a receipt you believe is filed but that exists nowhere is worse than no receipt at all.'
        }
      }
    ]
  }
]

/** Ce qu'on retient, en tête du guide. */
export const RESUME_GUIDE = {
  fr: 'Entreprise, clients et prestations, devis et factures, comptabilité, sauvegardes. Cet ordre-là, et pas un autre : c’est celui dans lequel l’application ne refuse rien.',
  en: 'Business, customers and services, quotes and invoices, bookkeeping, backups. That order and no other: it is the one in which the application refuses nothing.'
}
