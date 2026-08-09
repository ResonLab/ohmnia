import { REGISTRE } from '../../serveur/registre'
import { appelerServeur } from './client'
import { lireConfigurationMultipostes } from './configuration'

/**
 * Le seul endroit qui décide : base locale, ou serveur.
 *
 * Les deux chemins exécutent **la même fonction métier**, celle de
 * `main/domaines/`. En local elle tourne dans ce processus ; en multi-postes
 * elle tourne sur le serveur et le résultat revient par le réseau. C'est
 * pourquoi les messages d'erreur sont identiques dans les deux modes : ils
 * viennent du même code.
 *
 * Les handlers de `main/ipc/` continuent d'appeler les domaines directement en
 * mode local — ce routeur ne sert qu'à ceux qui doivent marcher **dans les
 * deux modes** : impression, export CSV, lecture d'un relevé. Eux mélangent
 * une opération de la machine (choisir un fichier) et une donnée qui peut être
 * ailleurs.
 */

export function modeCourant(): 'local' | 'serveur' {
  return lireConfigurationMultipostes().mode
}

export function estModeServeur(): boolean {
  return modeCourant() === 'serveur'
}

export async function executer(canal: string, ...arguments_: unknown[]): Promise<unknown> {
  if (estModeServeur()) return appelerServeur(canal, arguments_)

  const operation = REGISTRE[canal]
  if (!operation) throw new Error(`L'opération « ${canal} » n'existe pas.`)
  return operation(...arguments_)
}

/**
 * Refus explicite pour ce qui n'a de sens que sur le poste qui détient les
 * données. Mieux vaut un message clair qu'une opération qui semble réussir et
 * ne sauvegarde rien.
 */
export function exigerModeLocal(action: string): void {
  if (!estModeServeur()) return
  throw new Error(
    `${action} n'est possible qu'en mode local. En multi-postes, les données, ` +
      'les sauvegardes et les fichiers joints vivent sur le serveur : ' +
      "c'est là qu'il faut faire cette opération."
  )
}
