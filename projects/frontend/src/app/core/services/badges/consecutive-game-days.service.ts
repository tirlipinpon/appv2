import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ConsecutiveGameDays,
  ConsecutiveGameDaysStatus,
  RecalculateConsecutiveDaysResult,
  UnlockedBadge,
} from '../../types/consecutive-game-days.types';

@Injectable({
  providedIn: 'root',
})
export class ConsecutiveGameDaysService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Récupère l'état actuel des jours consécutifs de jeu
   * @param childId ID de l'enfant
   * @returns L'état actuel ou null si pas encore de données
   */
  async getConsecutiveGameDays(
    childId: string
  ): Promise<ConsecutiveGameDays | null> {
    const { data, error } = await this.supabase.client
      .from('frontend_consecutive_game_days')
      .select('*')
      .eq('child_id', childId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Erreur lors de la récupération des jours consécutifs: ${error.message}`
      );
    }

    return data;
  }

  /**
   * Recalcule et retourne l'état frais immédiatement (pour UX)
   * Appelle la fonction RPC qui recalcule et retourne l'état avec badges débloqués
   * @param childId ID de l'enfant
   * @returns Le statut formaté avec badges débloqués
   */
  async recalculateAndGetStatus(
    childId: string
  ): Promise<ConsecutiveGameDaysStatus & { badgesUnlocked: UnlockedBadge[] }> {
    const { data, error } = await this.supabase.client.rpc(
      'recalculate_and_get_consecutive_days',
      {
        p_child_id: childId,
      }
    );

    if (error) {
      throw new Error(
        `Erreur lors du recalcul des jours consécutifs: ${error.message}`
      );
    }

    const result = data as RecalculateConsecutiveDaysResult;

    return this.transformToStatus(result);
  }

  /**
   * Récupère tous les niveaux de badge débloqués pour les jours consécutifs
   * @param childId ID de l'enfant
   * @returns Liste des badges débloqués avec leurs niveaux
   */
  async getBadgeUnlocks(childId: string): Promise<
    Array<{
      id: string;
      badge_id: string;
      level: number;
      value: number;
      unlocked_at: string;
    }>
  > {
    const { data, error } = await this.supabase.client
      .from('frontend_child_badges')
      .select(
        `
        id,
        badge_id,
        level,
        value,
        unlocked_at,
        badge:frontend_badges!inner(badge_type)
      `
      )
      .eq('child_id', childId)
      .eq('badge.badge_type', 'consecutive_game_days')
      .order('level', { ascending: true });

    if (error) {
      throw new Error(
        `Erreur lors de la récupération des badges débloqués: ${error.message}`
      );
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      badge_id: item.badge_id,
      level: item.level,
      value: item.value,
      unlocked_at: item.unlocked_at,
    }));
  }

  /**
   * Calcule combien de jours sont nécessaires pour le prochain niveau
   * @param currentStreak Série actuelle
   * @returns Nombre de jours nécessaires pour le prochain niveau
   */
  getNextLevelTarget(currentStreak: number): number {
    // Formule : Niveau = Jours - 1
    // Donc pour le prochain niveau, il faut currentStreak + 1 jours
    return currentStreak + 1;
  }

  /**
   * Vérifie si la série est active (dernière date = aujourd'hui ou hier)
   * @param lastGameDate Dernière date de jeu
   * @returns true si la série est active, false sinon
   */
  isStreakActive(lastGameDate: Date | string | null): boolean {
    if (!lastGameDate) {
      return false;
    }

    const lastDate = typeof lastGameDate === 'string' 
      ? new Date(lastGameDate) 
      : lastGameDate;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastDateOnly = new Date(lastDate);
    lastDateOnly.setHours(0, 0, 0, 0);

    // Série active si dernière date = aujourd'hui ou hier
    return (
      lastDateOnly.getTime() === today.getTime() ||
      lastDateOnly.getTime() === yesterday.getTime()
    );
  }

  /**
   * Réinitialise manuellement la série (pour debug/admin)
   * @param childId ID de l'enfant
   */
  async resetStreak(childId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('frontend_consecutive_game_days')
      .update({
        current_streak: 0,
        current_level: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('child_id', childId);

    if (error) {
      throw new Error(
        `Erreur lors de la réinitialisation de la série: ${error.message}`
      );
    }
  }

  /**
   * Transforme le résultat de la fonction RPC en statut formaté pour l'UI
   * @param result Résultat de la fonction RPC
   * @returns Statut formaté avec badges débloqués
   */
  private transformToStatus(
    result: RecalculateConsecutiveDaysResult
  ): ConsecutiveGameDaysStatus & { badgesUnlocked: UnlockedBadge[] } {
    const lastGameDate = result.last_game_date
      ? new Date(result.last_game_date)
      : null;

    return {
      currentStreak: result.current_streak,
      maxStreak: result.max_streak,
      currentLevel: result.current_level,
      isActive: this.isStreakActive(lastGameDate),
      nextLevelDays: result.next_level_days,
      lastGameDate,
      badgesUnlocked: result.badges_unlocked || [],
    };
  }

  /**
   * Récupère le statut formaté pour l'UI
   * @param childId ID de l'enfant
   * @returns Le statut formaté ou null si pas encore de données
   */
  async getConsecutiveGameDaysStatus(
    childId: string
  ): Promise<ConsecutiveGameDaysStatus | null> {
    const data = await this.getConsecutiveGameDays(childId);

    if (!data) {
      return null;
    }

    const lastGameDate = data.last_game_date
      ? new Date(data.last_game_date)
      : null;

    return {
      currentStreak: data.current_streak,
      maxStreak: data.max_streak,
      currentLevel: data.current_level,
      isActive: this.isStreakActive(lastGameDate),
      nextLevelDays: this.getNextLevelTarget(data.current_streak),
      lastGameDate,
    };
  }
}
