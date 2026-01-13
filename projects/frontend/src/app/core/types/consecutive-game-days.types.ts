// Types pour le système de jours consécutifs de jeu

/**
 * Interface représentant l'état stocké dans la base de données
 */
export interface ConsecutiveGameDays {
  id: string;
  child_id: string;
  current_streak: number;
  max_streak: number;
  current_level: number;
  last_game_date: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Interface représentant le statut formaté pour l'UI
 */
export interface ConsecutiveGameDaysStatus {
  currentStreak: number;
  maxStreak: number;
  currentLevel: number;
  isActive: boolean;
  nextLevelDays: number;
  lastGameDate: Date | null;
}

/**
 * Interface pour les badges débloqués lors d'un recalcul
 */
export interface UnlockedBadge {
  badge_id: string;
  level: number;
  value: number;
  unlocked_at: string;
}

/**
 * Résultat de la fonction RPC recalculate_and_get_consecutive_days
 */
export interface RecalculateConsecutiveDaysResult {
  current_streak: number;
  max_streak: number;
  current_level: number;
  next_level_days: number;
  last_game_date: string | null;
  badges_unlocked: UnlockedBadge[];
}
