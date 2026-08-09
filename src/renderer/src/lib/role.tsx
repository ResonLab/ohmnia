import { createContext, useContext } from 'react'
import type { RoleMultipostes } from '../../../shared/types'

/**
 * Le rôle de la session en cours, à disposition de tous les écrans.
 *
 * `null` en mode local : il n'y a pas de comptes, donc pas de restriction —
 * l'application se comporte exactement comme avant.
 *
 * **Pourquoi masquer plutôt que laisser échouer.** Le serveur refuse déjà toute
 * écriture à un rôle `lecture`, avec un message clair : rien ne peut passer.
 * Mais un bouton qui échoue systématiquement est une mauvaise interface — il
 * fait croire à une panne au lieu d'annoncer une limite. On le retire donc de
 * l'écran, et le refus du serveur reste le vrai garde-fou derrière.
 */
const RoleContexte = createContext<RoleMultipostes | null>(null)

export const FournisseurRole = RoleContexte.Provider

export function useRole(): RoleMultipostes | null {
  return useContext(RoleContexte)
}

/** Ce compte peut-il modifier les données métier ? */
export function usePeutEcrire(): boolean {
  const role = useRole()
  return role === null || role === 'ecriture' || role === 'administration'
}

/** Ce compte peut-il toucher à ce qui engage l'entreprise ou le serveur ? */
export function usePeutAdministrer(): boolean {
  const role = useRole()
  return role === null || role === 'administration'
}

/**
 * N'affiche ses enfants que si le compte peut écrire.
 * `administration` restreint davantage : réservé aux administrateurs.
 */
export function SiAutorise({
  administration = false,
  children
}: {
  administration?: boolean
  children: React.ReactNode
}): React.JSX.Element | null {
  const peutEcrire = usePeutEcrire()
  const peutAdministrer = usePeutAdministrer()
  const autorise = administration ? peutAdministrer : peutEcrire
  return autorise ? <>{children}</> : null
}
