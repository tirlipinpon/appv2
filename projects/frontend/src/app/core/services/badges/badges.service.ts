import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { Badge, ChildBadge, BadgeLevel, NewlyUnlockedBadge } from '../../types/badge.types';
import {
  ConsecutiveGameDaysStatus,
} from '../../types/consecutive-game-days.types';
import { ConsecutiveGameDaysService } from './consecutive-game-days.service';

@Injectable({
  providedIn: 'root',
})
export class BadgesService {
  private readonly supabase = inject(SupabaseService);
  private readonly consecutiveGameDaysService = inject(ConsecutiveGameDaysService);

  /**
   * Récupère tous les badges actifs
   */
  async getAllBadges(): Promise<Badge[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_badges')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Erreur lors de la récupération des badges: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Récupère les badges débloqués par un enfant
   */
  async getChildBadges(childId: string): Promise<ChildBadge[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_badges')
      .select('*')
      .eq('child_id', childId)
      .order('unlocked_at', { ascending: false });

    if (error) {
      throw new Error(`Erreur lors de la récupération des badges de l'enfant: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Récupère les badges débloqués lors d'une tentative de jeu spécifique
   * Utilise la fonction RPC get_newly_unlocked_badges
   */
  async getNewlyUnlockedBadges(
    childId: string,
    gameAttemptId: string
  ): Promise<NewlyUnlockedBadge[]> {
    const { data, error } = await this.supabase.client.rpc('get_newly_unlocked_badges', {
      p_child_id: childId,
      p_game_attempt_id: gameAttemptId,
    });

    if (error) {
      throw new Error(
        `Erreur lors de la récupération des nouveaux badges: ${error.message}`
      );
    }

    return data || [];
  }

  /**
   * Récupère le niveau actuel d'un badge pour un enfant
   */
  async getBadgeLevel(childId: string, badgeType: string): Promise<BadgeLevel | null> {
    const { data, error } = await this.supabase.client
      .from('frontend_badge_levels')
      .select('*')
      .eq('child_id', childId)
      .eq('badge_type', badgeType)
      .maybeSingle();

    if (error) {
      throw new Error(`Erreur lors de la récupération du niveau du badge: ${error.message}`);
    }

    // maybeSingle() retourne null automatiquement si 0 lignes, pas besoin de gérer PGRST116
    return data ?? null;
  }

  /**
   * Récupère tous les niveaux de badges pour un enfant
   */
  async getAllBadgeLevels(childId: string): Promise<BadgeLevel[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_badge_levels')
      .select('*')
      .eq('child_id', childId);

    if (error) {
      throw new Error(
        `Erreur lors de la récupération des niveaux de badges: ${error.message}`
      );
    }

    return data || [];
  }

  /**
   * Calcule le seuil dynamique pour un badge selon son niveau
   * Formule: base × 1.3^(niveau-1)
   */
  calculateBadgeThreshold(baseValue: number, level: number): number {
    return Math.floor(baseValue * Math.pow(1.3, level - 1));
  }

  /**
   * Récupère le statut des jours consécutifs de jeu
   * @param childId ID de l'enfant
   * @returns Le statut formaté ou null si pas encore de données
   */
  async getConsecutiveGameDaysStatus(
    childId: string
  ): Promise<ConsecutiveGameDaysStatus | null> {
    return this.consecutiveGameDaysService.getConsecutiveGameDaysStatus(childId);
  }

  /**
   * Récupère la progression actuelle pour un type de badge
   * @param childId ID de l'enfant
   * @param badgeType Type de badge
   * @returns La progression actuelle (nombre ou objet pour daily_activity) ou null
   */
  async getCurrentProgress(
    childId: string,
    badgeType: string
  ): Promise<number | { minutes: number; games: number } | null> {
    switch (badgeType) {
      case 'perfect_games_count': {
        const { data, error } = await this.supabase.client
          .from('frontend_perfect_games_count')
          .select('count')
          .eq('child_id', childId)
          .maybeSingle();
        
        if (error) {
          console.error('[BadgesService] Erreur lors de la récupération de perfect_games_count:', error);
          return null;
        }
        // Si pas de données (pas encore de jeux parfaits), retourner 0
        return data?.count ?? 0;
      }

      case 'daily_streak_responses': {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await this.supabase.client
          .from('frontend_daily_responses')
          .select('correct_responses_count')
          .eq('child_id', childId)
          .eq('response_date', today)
          .maybeSingle();
        
        if (error) {
          console.error('[BadgesService] Erreur lors de la récupération de daily_streak_responses:', error);
          return null;
        }
        // Si pas de données (pas encore de réponses aujourd'hui), retourner 0
        return data?.correct_responses_count ?? 0;
      }

      case 'consecutive_correct': {
        const { data, error } = await this.supabase.client
          .from('frontend_consecutive_responses')
          .select('consecutive_count')
          .eq('child_id', childId)
          .maybeSingle();
        
        if (error) {
          console.error('[BadgesService] Erreur lors de la récupération de consecutive_correct:', error);
          return null;
        }
        // Si pas de données (pas encore de série), retourner 0
        return data?.consecutive_count ?? 0;
      }

      default:
        return null;
    }
  }
}
