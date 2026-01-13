/**
 * Utilitaires pour le badge Activité Quotidienne
 */

/**
 * Formate les minutes pour l'affichage
 * @param minutes Nombre de minutes
 * @returns Chaîne formatée (ex: "45 min")
 */
export function formatMinutes(minutes: number): string {
  return `${minutes} min`;
}

/**
 * Formate le nombre de jeux pour l'affichage
 * @param games Nombre de jeux
 * @returns Chaîne formatée (ex: "5 jeux" ou "1 jeu")
 */
export function formatGames(games: number): string {
  return games === 1 ? '1 jeu' : `${games} jeux`;
}

/**
 * Retourne le label français pour un statut
 * @param status Statut ('active' | 'in_progress' | 'not_started')
 * @returns Label en français
 */
export function getStatusLabel(
  status: 'active' | 'in_progress' | 'not_started'
): string {
  switch (status) {
    case 'active':
      return 'Actif';
    case 'in_progress':
      return 'En cours';
    case 'not_started':
      return 'Pas encore commencé';
    default:
      return 'Inconnu';
  }
}

/**
 * Calcule les exigences pour un niveau donné
 * @param level Niveau (1, 2, 3, ...)
 * @returns Objet avec minutes et jeux requis
 */
export function calculateLevelRequirements(level: number): {
  minutes: number;
  games: number;
} {
  return {
    minutes: 5 + (level - 1) * 2,
    games: 3 + (level - 1) * 1,
  };
}
