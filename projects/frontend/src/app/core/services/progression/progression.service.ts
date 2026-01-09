import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { SubjectCategoryProgress } from '../../types/game.types';

@Injectable({
  providedIn: 'root',
})
export class ProgressionService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Calcule la progression par sous-matière pour un enfant
   */
  async getProgressForChild(childId: string): Promise<SubjectCategoryProgress[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_subject_category_progress')
      .select('*')
      .eq('child_id', childId);

    if (error) {
      throw new Error(`Erreur lors de la récupération de la progression: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Met à jour la progression d'une sous-matière
   */
  async updateProgress(
    childId: string,
    subjectCategoryId: string,
    updates: {
      completed?: boolean;
      starsCount?: number;
      completionPercentage?: number;
    }
  ): Promise<SubjectCategoryProgress> {
    // Vérifier si une progression existe déjà
    const { data: existing } = await this.supabase.client
      .from('frontend_subject_category_progress')
      .select('*')
      .eq('child_id', childId)
      .eq('subject_category_id', subjectCategoryId)
      .single();

    if (existing) {
      // Mettre à jour
      const { data, error } = await this.supabase.client
        .from('frontend_subject_category_progress')
        .update({
          completed: updates.completed ?? existing.completed,
          stars_count: updates.starsCount ?? existing.stars_count,
          completion_percentage: updates.completionPercentage ?? existing.completion_percentage,
          last_played_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Erreur lors de la mise à jour de la progression: ${error.message}`);
      }

      return data;
    } else {
      // Créer
      const { data, error } = await this.supabase.client
        .from('frontend_subject_category_progress')
        .insert({
          child_id: childId,
          subject_category_id: subjectCategoryId,
          completed: updates.completed ?? false,
          stars_count: updates.starsCount ?? 0,
          completion_percentage: updates.completionPercentage ?? 0,
          last_played_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erreur lors de la création de la progression: ${error.message}`);
      }

      return data;
    }
  }

  /**
   * Calcule les étoiles selon le score et le taux de réussite
   */
  calculateStars(score: number, maxScore: number, successRate: number): number {
    if (successRate === 1.0 && score === maxScore) {
      return 3; // Parfait
    } else if (successRate >= 0.8) {
      return 2; // Bien
    } else if (successRate >= 0.5) {
      return 1; // Passable
    }
    return 0; // À refaire
  }

  /**
   * Calcule le pourcentage de complétion d'une sous-matière
   * Basé sur le nombre de jeux résolus (score = 100%) par rapport au total de jeux
   */
  calculateCompletionPercentage(
    gamesPlayed: number,
    gamesSucceeded: number,
    totalGames: number
  ): number {
    if (totalGames === 0) return 0;
    return Math.round((gamesSucceeded / totalGames) * 100);
  }

  /**
   * Calcule le pourcentage de complétion basé sur les jeux résolus dans une catégorie
   * Un jeu est considéré résolu si son meilleur score = 100%
   */
  async calculateCategoryCompletionPercentage(
    childId: string,
    subjectCategoryId: string
  ): Promise<number> {
    // Récupérer tous les jeux de la catégorie
    const { data: games, error: gamesError } = await this.supabase.client
      .from('games')
      .select('id')
      .eq('subject_category_id', subjectCategoryId);

    if (gamesError) {
      throw new Error(`Erreur lors de la récupération des jeux: ${gamesError.message}`);
    }

    const totalGames = games?.length || 0;
    if (totalGames === 0) return 0;

    // Récupérer les scores de tous les jeux pour cet enfant
    const gameIds = games.map(g => g.id);
    const { data: attempts, error: attemptsError } = await this.supabase.client
      .from('frontend_game_attempts')
      .select('game_id, score')
      .eq('child_id', childId)
      .in('game_id', gameIds);

    if (attemptsError) {
      throw new Error(`Erreur lors de la récupération des tentatives: ${attemptsError.message}`);
    }

    // Compter les jeux résolus (meilleur score = 100%)
    const gameBestScores = new Map<string, number>();
    if (attempts) {
      for (const attempt of attempts) {
        const currentBest = gameBestScores.get(attempt.game_id) || 0;
        if (attempt.score > currentBest) {
          gameBestScores.set(attempt.game_id, attempt.score);
        }
      }
    }

    const completedGames = Array.from(gameBestScores.values()).filter(score => score === 100).length;
    
    return Math.round((completedGames / totalGames) * 100);
  }

  /**
   * Calcule le pourcentage de complétion basé sur les jeux résolus dans une matière principale
   * Un jeu est considéré résolu si son meilleur score = 100%
   */
  async calculateSubjectCompletionPercentage(
    childId: string,
    subjectId: string
  ): Promise<number> {
    // Récupérer tous les jeux de la matière principale (sans sous-catégorie)
    const { data: games, error: gamesError } = await this.supabase.client
      .from('games')
      .select('id')
      .eq('subject_id', subjectId)
      .is('subject_category_id', null);

    if (gamesError) {
      throw new Error(`Erreur lors de la récupération des jeux: ${gamesError.message}`);
    }

    const totalGames = games?.length || 0;
    if (totalGames === 0) return 0;

    // Récupérer les scores de tous les jeux pour cet enfant
    const gameIds = games.map(g => g.id);
    const { data: attempts, error: attemptsError } = await this.supabase.client
      .from('frontend_game_attempts')
      .select('game_id, score')
      .eq('child_id', childId)
      .in('game_id', gameIds);

    if (attemptsError) {
      throw new Error(`Erreur lors de la récupération des tentatives: ${attemptsError.message}`);
    }

    // Compter les jeux résolus (meilleur score = 100%)
    const gameBestScores = new Map<string, number>();
    if (attempts) {
      for (const attempt of attempts) {
        const currentBest = gameBestScores.get(attempt.game_id) || 0;
        if (attempt.score > currentBest) {
          gameBestScores.set(attempt.game_id, attempt.score);
        }
      }
    }

    const completedGames = Array.from(gameBestScores.values()).filter(score => score === 100).length;
    
    return Math.round((completedGames / totalGames) * 100);
  }

  /**
   * Détermine si une sous-matière est complétée
   */
  isSubjectCategoryCompleted(progress: SubjectCategoryProgress): boolean {
    return progress.completed || progress.completion_percentage >= 100;
  }

  /**
   * Calcule le score total (nombre de jeux résolus avec score 100%) pour toutes les matières et sous-matières
   * Ne compte que les jeux résolus pour la première fois (meilleur score = 100%)
   */
  async calculateTotalScore(childId: string): Promise<number> {
    // Récupérer toutes les tentatives de jeu pour cet enfant
    const { data: attempts, error: attemptsError } = await this.supabase.client
      .from('frontend_game_attempts')
      .select('game_id, score')
      .eq('child_id', childId);

    if (attemptsError) {
      throw new Error(`Erreur lors de la récupération des tentatives: ${attemptsError.message}`);
    }

    if (!attempts || attempts.length === 0) {
      return 0;
    }

    // Calculer le meilleur score pour chaque jeu
    const gameBestScores = new Map<string, number>();
    for (const attempt of attempts) {
      const currentBest = gameBestScores.get(attempt.game_id) || 0;
      if (attempt.score > currentBest) {
        gameBestScores.set(attempt.game_id, attempt.score);
      }
    }

    // Compter les jeux résolus (meilleur score = 100%)
    const completedGames = Array.from(gameBestScores.values()).filter(score => score === 100).length;
    
    return completedGames;
  }

  /**
   * Récupère les jeux non réussis pour répétition intelligente
   */
  async getFailedGames(childId: string, subjectCategoryId: string): Promise<string[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_game_attempts')
      .select('game_id')
      .eq('child_id', childId)
      .eq('success', false)
      .order('completed_at', { ascending: false });

    if (error) {
      throw new Error(`Erreur lors de la récupération des jeux échoués: ${error.message}`);
    }

    // Filtrer par sous-matière si nécessaire
    const gameIds = (data || []).map((attempt) => attempt.game_id);

    // Récupérer les jeux de cette sous-matière
    const { data: games } = await this.supabase.client
      .from('games')
      .select('id')
      .eq('subject_category_id', subjectCategoryId);

    const categoryGameIds = (games || []).map((g) => g.id);

    // Retourner l'intersection
    return gameIds.filter((id) => categoryGameIds.includes(id));
  }
}

