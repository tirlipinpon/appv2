import { BadgeWithStatus } from '../types/badge.types';
import { BadgeLevel } from '../types/badge.types';

/**
 * Valeurs de base pour chaque type de badge selon la formule : base × 1.3^(niveau-1)
 */
const BADGE_BASE_VALUES: Record<string, number> = {
  perfect_games_count: 10,
  daily_streak_responses: 5,
  consecutive_correct: 5,
};

/**
 * Calcule le seuil pour un niveau donné selon la formule : base × 1.3^(niveau-1)
 */
function calculateBadgeThreshold(baseValue: number, level: number): number {
  return Math.floor(baseValue * Math.pow(1.3, level - 1));
}

/**
 * Formate un message simple pour enfant indiquant le prochain niveau à atteindre
 * @param badge Le badge avec son statut actuel
 * @param badgeLevel Le niveau actuel du badge (optionnel, sera calculé si non fourni)
 * @param currentProgress La progression actuelle de l'enfant (optionnel, pour afficher ce qui reste à faire)
 * @returns Un message simple pour enfant ou null si pas de prochain niveau
 */
export function getNextLevelMessage(
  badge: BadgeWithStatus,
  badgeLevel?: BadgeLevel,
  currentProgress?: number | { minutes?: number; games?: number }
): string | null {
  // Badges sans niveaux progressifs (un seul niveau, pas de prochain)
  if (
    badge.badge_type === 'first_game_perfect' ||
    badge.badge_type === 'first_category_complete' ||
    badge.badge_type === 'first_subject_complete'
  ) {
    // Si déjà débloqué, pas de prochain niveau
    if (badge.isUnlocked) {
      return null;
    }
    // Si verrouillé, afficher l'objectif initial
    return `Objectif : ${badge.description || 'Débloquer ce badge'}`;
  }

  // Utiliser le niveau actuel du badge (débloqué ou non)
  const currentLevel = badgeLevel?.current_level ?? badge.currentThreshold ?? 1;

  // Déterminer si c'est un badge verrouillé (pas encore débloqué)
  const isLocked = !badge.isUnlocked;

  // Calculer le prochain niveau (niveau actuel + 1)
  const nextLevel = currentLevel + 1;

  // Préfixe du message : "Objectif" pour les badges verrouillés, "Prochain" pour les débloqués
  const prefix = isLocked ? 'Objectif' : 'Prochain';

  // Calculer le seuil pour le prochain niveau selon le type de badge
  switch (badge.badge_type) {
    case 'perfect_games_count': {
      const nextGamesThreshold = calculateBadgeThreshold(
        BADGE_BASE_VALUES['perfect_games_count'],
        nextLevel
      );
      if (currentProgress !== undefined && typeof currentProgress === 'number') {
        const remaining = nextGamesThreshold - currentProgress;
        if (remaining > 0) {
          return `Il te reste ${remaining} jeux parfaits`;
        }
        return `Objectif atteint ! 🎉`;
      }
      return `${prefix} : ${nextGamesThreshold} jeux parfaits`;
    }

    case 'daily_streak_responses': {
      const nextResponsesThreshold = calculateBadgeThreshold(
        BADGE_BASE_VALUES['daily_streak_responses'],
        nextLevel
      );
      if (currentProgress !== undefined && typeof currentProgress === 'number') {
        const remaining = nextResponsesThreshold - currentProgress;
        if (remaining > 0) {
          return `Il te reste ${remaining} bonnes réponses aujourd'hui`;
        }
        return `Objectif atteint ! 🎉`;
      }
      return `${prefix} : ${nextResponsesThreshold} bonnes réponses aujourd'hui`;
    }

    case 'consecutive_correct': {
      const nextConsecutiveThreshold = calculateBadgeThreshold(
        BADGE_BASE_VALUES['consecutive_correct'],
        nextLevel
      );
      if (currentProgress !== undefined && typeof currentProgress === 'number') {
        const remaining = nextConsecutiveThreshold - currentProgress;
        if (remaining > 0) {
          return `Il te reste ${remaining} réponses consécutives`;
        }
        return `Objectif atteint ! 🎉`;
      }
      return `${prefix} : ${nextConsecutiveThreshold} réponses consécutives`;
    }

    case 'consecutive_game_days': {
      // Pour consecutive_game_days, la formule est spéciale : Niveau = Jours - 1
      // Le prochain niveau nécessite (nextLevel + 1) jours consécutifs
      const nextDaysRequired = nextLevel + 1;
      if (currentProgress !== undefined && typeof currentProgress === 'number') {
        const remaining = nextDaysRequired - currentProgress;
        if (remaining > 0) {
          return `Il te reste ${remaining} jours consécutifs`;
        }
        return `Objectif atteint ! 🎉`;
      }
      return `${prefix} : ${nextDaysRequired} jours consécutifs`;
    }

    case 'daily_activity': {
      // Pour daily_activity, utiliser les formules : Temps = 5 + (N-1) × 2 et Jeux = 3 + (N-1) × 1
      const nextMinutesRequired = 5 + (nextLevel - 1) * 2;
      const nextGamesRequired = 3 + (nextLevel - 1) * 1;
      if (currentProgress !== undefined && typeof currentProgress === 'object' && currentProgress !== null) {
        const minutesRemaining = Math.max(0, nextMinutesRequired - (currentProgress.minutes || 0));
        const gamesRemaining = Math.max(0, nextGamesRequired - (currentProgress.games || 0));
        if (minutesRemaining > 0 || gamesRemaining > 0) {
          const parts: string[] = [];
          if (minutesRemaining > 0) {
            parts.push(`${minutesRemaining} minutes`);
          }
          if (gamesRemaining > 0) {
            parts.push(`${gamesRemaining} jeux`);
          }
          return `Il te reste ${parts.join(' ET ')}`;
        }
        return `Objectif atteint ! 🎉`;
      }
      return `${prefix} : ${nextMinutesRequired} minutes ET ${nextGamesRequired} jeux`;
    }

    default:
      // Pour les autres types de badges, ne rien afficher
      return null;
  }
}
