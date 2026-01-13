// Types pour le système de badge Activité Quotidienne

/**
 * Interface représentant l'état complet du badge Activité Quotidienne
 */
export interface DailyActivityStatus {
  activityDate: Date;
  totalActiveMinutes: number;
  totalGamesCompleted: number;
  maxLevelToday: number;
  levelsUnlockedToday: number[];
  newLevelsUnlocked: number[];
  nextLevelTarget: {
    level: number;
    minutesRequired: number;
    minutesRemaining: number;
    gamesRequired: number;
    gamesRemaining: number;
  };
  progressPercentage: number;
  status: 'active' | 'in_progress' | 'not_started';
}

/**
 * Interface représentant les exigences d'un niveau
 */
export interface DailyActivityLevel {
  level: number;
  minutesRequired: number;
  gamesRequired: number;
}

/**
 * Résultat de la fonction RPC get_daily_activity_status (format brut de la DB)
 */
export interface DailyActivityStatusRPC {
  activity_date: string;
  total_active_minutes: number;
  total_games_completed: number;
  max_level_today: number;
  levels_unlocked_today: number[];
  new_levels_unlocked: number[];
  next_level_target: {
    level: number;
    minutes_required: number;
    minutes_remaining: number;
    games_required: number;
    games_remaining: number;
  };
  progress_percentage: number;
  status: string;
}
