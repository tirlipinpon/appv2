import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { Badge, ChildBadge, BadgeLevel, NewlyUnlockedBadge } from '../../types/badge.types';

@Injectable({
  providedIn: 'root',
})
export class BadgesService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Récupère tous les badges actifs
   */
  async getAllBadges(): Promise<Badge[]> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badges.service.ts:14',message:'getAllBadges ENTRY',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    const { data, error } = await this.supabase.client
      .from('frontend_badges')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badges.service.ts:20',message:'getAllBadges RESULT',data:{hasError:!!error,errorMessage:error?.message,dataCount:data?.length||0,data:data?.slice(0,2)||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    if (error) {
      throw new Error(`Erreur lors de la récupération des badges: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Récupère les badges débloqués par un enfant
   */
  async getChildBadges(childId: string): Promise<ChildBadge[]> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badges.service.ts:31',message:'getChildBadges ENTRY',data:{childId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    const { data, error } = await this.supabase.client
      .from('frontend_child_badges')
      .select('*')
      .eq('child_id', childId)
      .order('unlocked_at', { ascending: false });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badges.service.ts:37',message:'getChildBadges RESULT',data:{hasError:!!error,errorMessage:error?.message,dataCount:data?.length||0,childId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badges.service.ts:49',message:'getNewlyUnlockedBadges ENTRY',data:{childId,gameAttemptId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    const { data, error } = await this.supabase.client.rpc('get_newly_unlocked_badges', {
      p_child_id: childId,
      p_game_attempt_id: gameAttemptId,
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badges.service.ts:56',message:'getNewlyUnlockedBadges RESULT',data:{hasError:!!error,errorMessage:error?.message,errorCode:error?.code,dataCount:data?.length||0,data:data||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badges.service.ts:92',message:'getAllBadgeLevels ENTRY',data:{childId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    const { data, error } = await this.supabase.client
      .from('frontend_badge_levels')
      .select('*')
      .eq('child_id', childId);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badges.service.ts:98',message:'getAllBadgeLevels RESULT',data:{hasError:!!error,errorMessage:error?.message,dataCount:data?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

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
}
