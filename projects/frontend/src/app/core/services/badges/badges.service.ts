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
      .single();

    if (error) {
      // Si pas de niveau trouvé, retourner null (pas une erreur)
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Erreur lors de la récupération du niveau du badge: ${error.message}`);
    }

    return data;
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
}
