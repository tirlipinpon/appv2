// Types pour les jeux et la progression

export interface Game {
  id: string;
  name: string;
  description?: string;
  subject_id?: string;
  subject_category_id?: string;
  game_type: string;
  game_data_json: Record<string, unknown>;
  image_url?: string;
  created_at: string;
  updated_at: string;
  // Champs pour la structure ancienne (rétrocompatibilité)
  question?: string;
  instructions?: string;
  reponses?: Record<string, unknown>;
  aides?: string[];
  metadata?: Record<string, unknown>;
}

export interface GameAttempt {
  id: string;
  child_id: string;
  game_id: string;
  success: boolean;
  score: number;
  duration_ms?: number;
  responses_json?: Record<string, unknown>;
  difficulty_level: number;
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SubjectCategoryProgress {
  id: string;
  child_id: string;
  subject_category_id: string;
  completed: boolean;
  stars_count: number;
  completion_percentage: number;
  last_played_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Collectible {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  subject_category_id?: string;
  unlock_condition_json?: Record<string, unknown>;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChildCollectible {
  id: string;
  child_id: string;
  collectible_id: string;
  unlocked_at: string;
  created_at: string;
}

export interface BonusGame {
  id: string;
  name: string;
  description?: string;
  subject_id?: string;
  unlock_condition_json: Record<string, unknown>;
  game_data_json: Record<string, unknown>;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChildBonusGameUnlock {
  id: string;
  child_id: string;
  bonus_game_id: string;
  unlocked_at: string;
  played_count: number;
  last_played_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Theme {
  id: string;
  name: string;
  school_level_min?: number;
  school_level_max?: number;
  shapes_colors_json: Record<string, unknown>;
  unlock_condition_json?: Record<string, unknown>;
  is_default: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChildTheme {
  id: string;
  child_id: string;
  theme_id: string;
  is_selected: boolean;
  unlocked_at: string;
  created_at: string;
  updated_at: string;
}

export interface MascotState {
  id: string;
  child_id: string;
  level: number;
  xp: number;
  current_appearance_json?: Record<string, unknown>;
  evolution_stage: number;
  last_xp_gain_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GameVariant {
  id: string;
  game_id: string;
  variant_data_json: Record<string, unknown>;
  difficulty_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChildCheckpoint {
  id: string;
  child_id: string;
  checkpoint_type: 'game_end' | 'subject_category_end' | 'manual';
  checkpoint_data_json: Record<string, unknown>;
  created_at: string;
}

export interface ChildStatistics {
  child_id: string;
  total_games_played: number;
  total_games_succeeded: number;
  success_rate: number;
  total_stars: number;
  completed_subject_categories_count: number;
  collectibles_count: number;
  bonus_games_unlocked_count: number;
  last_game_played_at?: string;
  last_subject_category_played_at?: string;
}

