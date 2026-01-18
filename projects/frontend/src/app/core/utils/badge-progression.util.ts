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
 * Calcule le niveau actuel à partir de la progression actuelle
 * Trouve le plus haut niveau pour lequel la progression >= seuil(niveau)
 */
function calculateCurrentLevelFromProgress(
  badgeType: string,
  currentProgress: number
): number {
  const baseValue = BADGE_BASE_VALUES[badgeType];
  if (!baseValue) return 1;

  // Chercher le plus haut niveau atteint
  let level = 1;
  let threshold = calculateBadgeThreshold(baseValue, level);
  
  // Itérer jusqu'à trouver le niveau maximal atteint
  while (currentProgress >= threshold) {
    level++;
    threshold = calculateBadgeThreshold(baseValue, level);
    // Limite de sécurité pour éviter les boucles infinies
    if (level > 100) break;
  }
  
  // Retourner le niveau précédent (celui effectivement atteint)
  return Math.max(1, level - 1);
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badge-progression.util.ts:27',message:'getNextLevelMessage entry',data:{badgeType:badge.badge_type,isUnlocked:badge.isUnlocked,badgeLevel_current_level:badgeLevel?.current_level,badge_currentThreshold:badge.currentThreshold,badge_level:badge.level,currentProgress:currentProgress},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
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

  // Calculer le niveau actuel du badge
  // Si on a la progression actuelle, l'utiliser pour calculer le niveau réel (plus fiable que les valeurs stockées)
  // Sinon, utiliser badge.level (dernier niveau débloqué) > badgeLevel.current_level > badge.currentThreshold > 1
  let currentLevel: number;
  if (currentProgress !== undefined && typeof currentProgress === 'number') {
    // Calculer le niveau à partir de la progression actuelle pour avoir le niveau réel
    // C'est la source de vérité la plus fiable car elle reflète la progression actuelle
    currentLevel = calculateCurrentLevelFromProgress(badge.badge_type, currentProgress);
    
    // #region agent log
    const storedLevel = badge.level ?? badgeLevel?.current_level ?? badge.currentThreshold ?? 1;
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badge-progression.util.ts:83',message:'calculateCurrentLevelFromProgress result',data:{badgeType:badge.badge_type,currentProgress:currentProgress,calculatedLevel:currentLevel,storedLevel:storedLevel,finalCurrentLevel:currentLevel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
  } else {
    // Si pas de progression disponible, utiliser les valeurs stockées
    currentLevel = badge.level ?? badgeLevel?.current_level ?? badge.currentThreshold ?? 1;
  }

  // Déterminer si c'est un badge verrouillé (pas encore débloqué)
  const isLocked = !badge.isUnlocked;

  // Calculer le prochain niveau (niveau actuel + 1)
  const nextLevel = currentLevel + 1;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badge-progression.util.ts:53',message:'currentLevel and nextLevel calculated',data:{badgeType:badge.badge_type,currentLevel:currentLevel,nextLevel:nextLevel,isLocked:isLocked},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

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
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badge-progression.util.ts:67',message:'perfect_games_count remaining calculation',data:{nextGamesThreshold:nextGamesThreshold,currentProgress:currentProgress,remaining:remaining},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
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
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badge-progression.util.ts:96',message:'consecutive_correct remaining calculation',data:{nextConsecutiveThreshold:nextConsecutiveThreshold,currentProgress:currentProgress,remaining:remaining,currentLevel:currentLevel,nextLevel:nextLevel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
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
