import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { GameVariant } from '../../types/game.types';

@Injectable({
  providedIn: 'root',
})
export class AdaptiveDifficultyService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Calcule le niveau de difficulté selon le taux de réussite
   */
  calculateDifficultyLevel(successRate: number): number {
    if (successRate >= 0.9) {
      return 5; // Très difficile
    } else if (successRate >= 0.75) {
      return 4; // Difficile
    } else if (successRate >= 0.5) {
      return 3; // Moyen
    } else if (successRate >= 0.25) {
      return 2; // Facile
    }
    return 1; // Très facile
  }

  /**
   * Sélectionne une variante de jeu aléatoire selon le niveau de difficulté
   */
  async getRandomVariant(gameId: string, difficultyLevel: number): Promise<GameVariant | null> {
    const { data, error } = await this.supabase.client
      .from('frontend_game_variants')
      .select('*')
      .eq('game_id', gameId)
      .eq('difficulty_level', difficultyLevel)
      .eq('is_active', true);

    if (error || !data || data.length === 0) {
      return null;
    }

    // Sélectionner une variante aléatoire
    const randomIndex = Math.floor(Math.random() * data.length);
    return data[randomIndex];
  }

  /**
   * Calcule le taux de réussite d'un enfant pour un jeu
   */
  async getSuccessRateForGame(childId: string, gameId: string): Promise<number> {
    const { data, error } = await this.supabase.client
      .from('frontend_game_attempts')
      .select('success')
      .eq('child_id', childId)
      .eq('game_id', gameId);

    if (error || !data || data.length === 0) {
      return 0;
    }

    const successfulAttempts = data.filter((attempt) => attempt.success).length;
    return successfulAttempts / data.length;
  }

  /**
   * Calcule le taux de réussite global d'un enfant pour une sous-matière
   */
  async getSuccessRateForSubjectCategory(
    childId: string,
    subjectCategoryId: string
  ): Promise<number> {
    // Récupérer tous les jeux de cette sous-matière
    const { data: games } = await this.supabase.client
      .from('games')
      .select('id')
      .eq('subject_category_id', subjectCategoryId);

    if (!games || games.length === 0) {
      return 0;
    }

    const gameIds = games.map((g) => g.id);

    // Récupérer toutes les tentatives pour ces jeux
    const { data: attempts } = await this.supabase.client
      .from('frontend_game_attempts')
      .select('success')
      .eq('child_id', childId)
      .in('game_id', gameIds);

    if (!attempts || attempts.length === 0) {
      return 0;
    }

    const successfulAttempts = attempts.filter((attempt) => attempt.success).length;
    return successfulAttempts / attempts.length;
  }

  /**
   * Adapte l'ordre des jeux selon la performance
   * Retourne les jeux triés : échecs d'abord, puis réussis
   */
  async getAdaptiveGameOrder(
    childId: string,
    subjectCategoryId: string
  ): Promise<string[]> {
    // Récupérer tous les jeux de cette sous-matière
    const { data: games } = await this.supabase.client
      .from('games')
      .select('id')
      .eq('subject_category_id', subjectCategoryId);

    if (!games || games.length === 0) {
      return [];
    }

    const gameIds = games.map((g) => g.id);

    // Récupérer les tentatives pour ces jeux
    const { data: attempts } = await this.supabase.client
      .from('frontend_game_attempts')
      .select('game_id, success')
      .eq('child_id', childId)
      .in('game_id', gameIds)
      .order('completed_at', { ascending: false });

    // Séparer les jeux réussis et échoués
    const failedGames = new Set<string>();
    const succeededGames = new Set<string>();

    (attempts || []).forEach((attempt) => {
      if (attempt.success) {
        succeededGames.add(attempt.game_id);
      } else {
        failedGames.add(attempt.game_id);
      }
    });

    // Jeux jamais joués
    const neverPlayed = gameIds.filter(
      (id) => !failedGames.has(id) && !succeededGames.has(id)
    );

    // Ordre : échecs, jamais joués, réussis
    return [...Array.from(failedGames), ...neverPlayed, ...Array.from(succeededGames)];
  }
}

