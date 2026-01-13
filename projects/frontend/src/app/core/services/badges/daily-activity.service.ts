import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import {
  DailyActivityStatus,
  DailyActivityLevel,
  DailyActivityStatusRPC,
} from '../../types/daily-activity.types';

@Injectable({
  providedIn: 'root',
})
export class DailyActivityService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Récupère l'état du badge Activité Quotidienne pour un jour donné
   * @param childId ID de l'enfant
   * @param gameDate Date du jour (optionnel, par défaut aujourd'hui)
   * @returns L'état formaté du badge
   */
  async getDailyActivityStatus(
    childId: string,
    gameDate?: Date
  ): Promise<DailyActivityStatus> {
    const dateParam = gameDate
      ? gameDate.toISOString().split('T')[0]
      : undefined;

    const { data, error } = await this.supabase.client.rpc(
      'get_daily_activity_status',
      {
        p_child_id: childId,
        p_game_date: dateParam,
      }
    );

    if (error) {
      throw new Error(
        `Erreur lors de la récupération du statut d'activité quotidienne: ${error.message}`
      );
    }

    return this.transformRPCToStatus(data as DailyActivityStatusRPC);
  }

  /**
   * Recalcule et retourne l'état frais pour le jour actuel
   * Force le recalcul même si déjà calculé aujourd'hui
   * @param childId ID de l'enfant
   * @returns L'état formaté avec les nouveaux niveaux débloqués
   */
  async recalculateAndGetStatus(
    childId: string
  ): Promise<DailyActivityStatus & { newLevelsUnlocked: number[] }> {
    const today = new Date().toISOString().split('T')[0];
    console.log('[DailyActivityService] Recalcul pour childId:', childId, 'date:', today);
    
    // D'abord, forcer le recalcul en appelant calculate_and_unlock_daily_activity_badge
    const { data: calcData, error: calcError } = await this.supabase.client.rpc(
      'calculate_and_unlock_daily_activity_badge',
      {
        p_child_id: childId,
        p_game_date: today,
      }
    );

    if (calcError) {
      console.error('[DailyActivityService] Erreur lors du recalcul:', calcError);
      throw new Error(
        `Erreur lors du recalcul du badge d'activité quotidienne: ${calcError.message}`
      );
    }

    console.log('[DailyActivityService] Résultat du calcul:', calcData);

    // La fonction RPC retourne une TABLE, donc calcData est un tableau
    // On prend le premier élément (il ne devrait y en avoir qu'un)
    const calcResult = Array.isArray(calcData) && calcData.length > 0 
      ? calcData[0] 
      : null;
    
    const newLevelsUnlocked = calcResult?.levels_unlocked || [];
    console.log('[DailyActivityService] Nouveaux niveaux débloqués:', newLevelsUnlocked);

    // Ensuite, récupérer l'état complet avec get_daily_activity_status
    const { data: statusData, error: statusError } = await this.supabase.client.rpc(
      'get_daily_activity_status',
      {
        p_child_id: childId,
        p_game_date: today,
      }
    );

    if (statusError) {
      console.error('[DailyActivityService] Erreur lors de la récupération du statut:', statusError);
      throw new Error(
        `Erreur lors de la récupération du statut d'activité quotidienne: ${statusError.message}`
      );
    }

    console.log('[DailyActivityService] Données du statut (brut):', JSON.stringify(statusData, null, 2));
    const status = this.transformRPCToStatus(statusData as DailyActivityStatusRPC);
    console.log('[DailyActivityService] Statut transformé:', status);
    console.log('[DailyActivityService] totalActiveMinutes:', status.totalActiveMinutes, 'type:', typeof status.totalActiveMinutes);

    return {
      ...status,
      newLevelsUnlocked: newLevelsUnlocked || [],
    };
  }

  /**
   * Calcule les exigences pour un niveau donné
   * @param level Niveau (1, 2, 3, ...)
   * @returns Les exigences en minutes et jeux
   */
  calculateLevelRequirements(level: number): DailyActivityLevel {
    return {
      level,
      minutesRequired: 10 + (level - 1) * 5,
      gamesRequired: 3 + (level - 1) * 1,
    };
  }

  /**
   * Transforme le résultat RPC en objet TypeScript typé
   * @param rpcData Données brutes de la RPC
   * @returns Objet formaté pour l'UI
   */
  private transformRPCToStatus(
    rpcData: DailyActivityStatusRPC
  ): DailyActivityStatus {
    console.log('[DailyActivityService] transformRPCToStatus - rpcData:', rpcData);
    console.log('[DailyActivityService] transformRPCToStatus - total_active_minutes:', rpcData?.total_active_minutes, 'type:', typeof rpcData?.total_active_minutes);
    
    const result = {
      activityDate: new Date(rpcData.activity_date),
      totalActiveMinutes: rpcData.total_active_minutes,
      totalGamesCompleted: rpcData.total_games_completed,
      maxLevelToday: rpcData.max_level_today,
      levelsUnlockedToday: rpcData.levels_unlocked_today || [],
      newLevelsUnlocked: rpcData.new_levels_unlocked || [],
      nextLevelTarget: {
        level: rpcData.next_level_target.level,
        minutesRequired: rpcData.next_level_target.minutes_required,
        minutesRemaining: rpcData.next_level_target.minutes_remaining,
        gamesRequired: rpcData.next_level_target.games_required,
        gamesRemaining: rpcData.next_level_target.games_remaining,
      },
      progressPercentage: rpcData.progress_percentage,
      status: rpcData.status as 'active' | 'in_progress' | 'not_started',
    };
    
    console.log('[DailyActivityService] transformRPCToStatus - result:', result);
    
    return result;
  }
}
