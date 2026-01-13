// Types pour le système de badges

export type BadgeType =
  | 'first_category_complete'
  | 'first_subject_complete'
  | 'first_game_perfect'
  | 'daily_streak_responses'
  | 'consecutive_correct'
  | 'perfect_games_count'
  | 'consecutive_game_days'
  | 'daily_activity';

export interface Badge {
  id: string;
  name: string;
  description?: string;
  badge_type: BadgeType;
  icon_url?: string;
  color_code?: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChildBadge {
  id: string;
  child_id: string;
  badge_id: string;
  unlocked_at: string;
  level: number;
  value?: number | object; // JSONB: peut être un nombre ou un objet (pour daily_activity)
  created_at: string;
}

export interface BadgeLevel {
  id: string;
  child_id: string;
  badge_type: string;
  current_level: number;
  last_unlocked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BadgeWithStatus extends Badge {
  isUnlocked: boolean;
  unlockedAt?: string;
  level?: number;
  value?: number | object; // JSONB: peut être un nombre ou un objet (pour daily_activity)
  currentThreshold?: number;
}

export interface NewlyUnlockedBadge {
  badge_id: string;
  badge_name: string;
  badge_type: BadgeType;
  level: number;
  value: number | object; // JSONB: peut être un nombre ou un objet (pour daily_activity)
  unlocked_at: string;
}
