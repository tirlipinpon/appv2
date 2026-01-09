import { inject, Injectable } from '@angular/core';
import { BadgesService } from '../../../../core/services/badges/badges.service';
import { Badge, ChildBadge, BadgeLevel, NewlyUnlockedBadge } from '../../../../core/types/badge.types';

@Injectable({
  providedIn: 'root',
})
export class BadgesInfrastructure {
  private readonly badgesService = inject(BadgesService);

  /**
   * Charge tous les badges actifs
   */
  async loadAllBadges(): Promise<Badge[]> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'infrastructure.ts:14',message:'loadAllBadges ENTRY',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    try {
      const result = await this.badgesService.getAllBadges();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'infrastructure.ts:17',message:'loadAllBadges SUCCESS',data:{count:result.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      return result;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'infrastructure.ts:20',message:'loadAllBadges ERROR',data:{errorMessage:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      console.error('[BadgesInfrastructure] Erreur lors du chargement des badges:', error);
      throw error;
    }
  }

  /**
   * Charge les badges débloqués par un enfant
   */
  async loadChildBadges(childId: string): Promise<ChildBadge[]> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'infrastructure.ts:26',message:'loadChildBadges ENTRY',data:{childId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    try {
      const result = await this.badgesService.getChildBadges(childId);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'infrastructure.ts:29',message:'loadChildBadges SUCCESS',data:{count:result.length,childId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      return result;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'infrastructure.ts:34',message:'loadChildBadges ERROR',data:{errorMessage:error instanceof Error?error.message:String(error),childId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      console.error(
        '[BadgesInfrastructure] Erreur lors du chargement des badges de l\'enfant:',
        error
      );
      throw error;
    }
  }

  /**
   * Vérifie les nouveaux badges débloqués après une tentative de jeu
   */
  async checkNewBadges(
    childId: string,
    gameAttemptId: string
  ): Promise<NewlyUnlockedBadge[]> {
    try {
      return await this.badgesService.getNewlyUnlockedBadges(childId, gameAttemptId);
    } catch (error) {
      console.error(
        '[BadgesInfrastructure] Erreur lors de la vérification des nouveaux badges:',
        error
      );
      throw error;
    }
  }

  /**
   * Charge les niveaux de badges pour un enfant
   */
  async loadBadgeLevels(childId: string): Promise<BadgeLevel[]> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'infrastructure.ts:59',message:'loadBadgeLevels ENTRY',data:{childId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    try {
      const result = await this.badgesService.getAllBadgeLevels(childId);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'infrastructure.ts:62',message:'loadBadgeLevels SUCCESS',data:{count:result.length,childId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      return result;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'infrastructure.ts:67',message:'loadBadgeLevels ERROR',data:{errorMessage:error instanceof Error?error.message:String(error),childId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      console.error(
        '[BadgesInfrastructure] Erreur lors du chargement des niveaux de badges:',
        error
      );
      throw error;
    }
  }

  /**
   * Récupère le niveau d'un badge spécifique
   */
  async getBadgeLevel(childId: string, badgeType: string): Promise<BadgeLevel | null> {
    try {
      return await this.badgesService.getBadgeLevel(childId, badgeType);
    } catch (error) {
      console.error(
        '[BadgesInfrastructure] Erreur lors de la récupération du niveau du badge:',
        error
      );
      throw error;
    }
  }
}
