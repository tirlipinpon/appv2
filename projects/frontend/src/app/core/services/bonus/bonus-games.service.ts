import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { BonusGame, ChildBonusGameUnlock } from '../../types/game.types';

@Injectable({
  providedIn: 'root',
})
export class BonusGamesService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Récupère tous les mini-jeux bonus disponibles
   */
  async getAllBonusGames(): Promise<BonusGame[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_bonus_games')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Erreur lors de la récupération des mini-jeux bonus: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Récupère les mini-jeux bonus débloqués par un enfant
   */
  async getUnlockedBonusGames(childId: string): Promise<ChildBonusGameUnlock[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_bonus_game_unlocks')
      .select('*')
      .eq('child_id', childId)
      .order('unlocked_at', { ascending: false });

    if (error) {
      throw new Error(`Erreur lors de la récupération des mini-jeux débloqués: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Débloque un mini-jeu bonus pour un enfant
   */
  async unlockBonusGame(childId: string, bonusGameId: string): Promise<ChildBonusGameUnlock> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_bonus_game_unlocks')
      .insert({
        child_id: childId,
        bonus_game_id: bonusGameId,
        unlocked_at: new Date().toISOString(),
        played_count: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors du déblocage du mini-jeu: ${error.message}`);
    }

    return data;
  }

  /**
   * Incrémente le compteur de parties jouées
   */
  async incrementPlayCount(childId: string, bonusGameId: string): Promise<void> {
    const { data: existing } = await this.supabase.client
      .from('frontend_child_bonus_game_unlocks')
      .select('played_count')
      .eq('child_id', childId)
      .eq('bonus_game_id', bonusGameId)
      .single();

    if (existing) {
      const { error } = await this.supabase.client
        .from('frontend_child_bonus_game_unlocks')
        .update({
          played_count: existing.played_count + 1,
          last_played_at: new Date().toISOString(),
        })
        .eq('child_id', childId)
        .eq('bonus_game_id', bonusGameId);

      if (error) {
        throw new Error(`Erreur lors de la mise à jour du compteur: ${error.message}`);
      }
    }
  }

  /**
   * Vérifie les conditions de déblocage d'un mini-jeu
   */
  async checkUnlockCondition(childId: string, bonusGame: BonusGame): Promise<boolean> {
    if (!bonusGame.unlock_condition_json) {
      return false;
    }

    const condition = bonusGame.unlock_condition_json;

    // Condition: compléter une matière
    if (condition['type'] === 'complete_subject' && condition['subject_id']) {
      // Récupérer toutes les sous-matières de cette matière
      const { data: categories } = await this.supabase.client
        .from('subject_categories')
        .select('id')
        .eq('subject_id', condition['subject_id']);

      if (!categories || categories.length === 0) {
        return false;
      }

      const categoryIds = categories.map((c) => c.id);

      // Vérifier si toutes les sous-matières sont complétées
      const { data: progress } = await this.supabase.client
        .from('frontend_subject_category_progress')
        .select('completed')
        .eq('child_id', childId)
        .in('subject_category_id', categoryIds);

      if (!progress || progress.length !== categoryIds.length) {
        return false;
      }

      return progress.every((p) => p.completed === true);
    }

    return false;
  }
}

