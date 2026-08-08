import { dossierDonnees } from '../contexte'
import { cpSync, existsSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ANCIEN_NOM_DOSSIER = 'gestion-electronicien'

/**
 * L'application s'appelait "gestion-electronicien" avant d'être renommée Ohmnia.
 * Si l'ancien dossier de données existe encore et que le nouveau n'a pas été créé,
 * on le déplace pour que l'utilisateur retrouve sa base, ses sauvegardes et son logo.
 *
 * À appeler une seule fois, AVANT toute lecture de la base.
 */
export function migrerAncienDossierDonnees(): void {
  const nouveauDossier = dossierDonnees()
  const ancienDossier = join(dirname(nouveauDossier), ANCIEN_NOM_DOSSIER)

  if (ancienDossier === nouveauDossier) return
  if (!existsSync(ancienDossier)) return
  if (existsSync(join(nouveauDossier, 'gestion.sqlite'))) return

  try {
    if (!existsSync(nouveauDossier)) {
      renameSync(ancienDossier, nouveauDossier)
    } else {
      // Le nouveau dossier existe déjà (créé par Electron) mais sans base :
      // on recopie le contenu de l'ancien par-dessus.
      cpSync(ancienDossier, nouveauDossier, { recursive: true })
    }
    console.log(`Données reprises depuis l'ancien dossier : ${ancienDossier}`)
  } catch (erreur) {
    // Une migration échouée ne doit jamais empêcher l'app de démarrer :
    // l'utilisateur repartira sur une base vide, l'ancienne reste intacte sur le disque.
    console.error('Reprise des anciennes données impossible :', erreur)
  }
}
