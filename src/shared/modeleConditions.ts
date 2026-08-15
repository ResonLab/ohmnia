/**
 * Le modèle de conditions générales, proposé comme point de départ.
 *
 * **Il vit ici et non dans l'écran, et c'est la raison d'être de ce fichier.**
 * Ce texte n'est pas de l'interface : il est inséré tel quel au bas de vraies
 * factures et de vrais devis. Il appartient donc à la même famille que la
 * mention de non-assujettissement de `pays.ts` — du texte de document, pas du
 * texte de lecteur.
 *
 * **Il reste en français, délibérément.** Le traduire mécaniquement produirait
 * un contrat que personne n'a relu, engageant l'utilisateur devant ses clients.
 * L'écran annonce sa langue et son cadre plutôt que de le cacher ou de le
 * transformer : c'est à l'utilisateur de décider s'il lui convient.
 *
 * Le sortir de l'écran a une seconde vertu, et elle vaut d'être dite : tant
 * qu'il y vivait, le contrôle du texte français en dur ne pouvait pas
 * distinguer ce contrat d'un libellé oublié. Il fallait soit lui accorder une
 * exception — la porte par laquelle un contrôle cesse de regarder — soit ranger
 * le texte selon sa nature. C'est la seconde qui a été choisie.
 *
 * *Réserve : ce modèle est générique et n'a pas été validé par un juriste. Il
 * doit être adapté à l'activité réelle avant d'être utilisé.*
 */

/**
 * Modèle de conditions générales fourni comme point de départ.
 * Volontairement générique : il doit être adapté à l'activité réelle et
 * relu par un juriste avant d'être utilisé sur de vraies factures.
 */
export function modeleConditions(nomEntreprise: string): string {
  const nom = nomEntreprise.trim() || "L'entreprise"
  return `1. Champ d'application
Les présentes conditions s'appliquent à toutes les prestations et livraisons de ${nom}, sauf accord écrit contraire.

2. Devis et commandes
Les devis sont valables durant la durée indiquée sur le document. Toute commande implique l'acceptation des présentes conditions.

3. Prix et paiement
Les prix s'entendent dans la devise indiquée sur la facture. Le paiement est dû dans le délai mentionné, sans escompte. Passé ce délai, un intérêt moratoire au taux légal peut être appliqué, ainsi que des frais de rappel.

4. Réserve de propriété
Les marchandises livrées restent la propriété de ${nom} jusqu'au paiement intégral.

5. Délais
Les délais annoncés sont indicatifs. Un retard ne donne pas droit à une réduction de prix ni à des dommages-intérêts, sauf accord écrit.

6. Garantie
Les défauts doivent être signalés par écrit dans les 8 jours suivant la livraison ou la fin de l'intervention. La garantie se limite à la réparation ou au remplacement des éléments défectueux. Sont exclus l'usure normale, les dommages consécutifs à une mauvaise utilisation, à une intervention d'un tiers, à une surtension ou à un défaut d'entretien.

7. Responsabilité
La responsabilité de ${nom} est limitée au montant de la prestation concernée. Elle ne couvre pas les dommages indirects tels que perte de données, perte d'exploitation ou manque à gagner. Il appartient au client de sauvegarder ses données avant toute intervention. Les limitations ci-dessus ne s'appliquent pas en cas de faute grave ou intentionnelle, ni dans les cas où la loi impose une responsabilité.

8. Données du client
Les données auxquelles ${nom} pourrait accéder dans le cadre d'une intervention sont traitées de manière confidentielle et ne sont pas conservées au-delà de ce qui est nécessaire.

9. Droit applicable et for
Le droit applicable et le for sont ceux du siège de ${nom}, sous réserve des dispositions impératives protégeant les consommateurs.`
}
