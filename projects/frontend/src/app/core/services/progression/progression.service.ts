import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { SubjectCategoryProgress, SubjectProgress } from '../../types/game.types';

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
      completionPercentage?: number;
    }
  ): Promise<SubjectCategoryProgress> {
    // Vérifier si une progression existe déjà
    const { data: existing } = await this.supabase.client
      .from('frontend_subject_category_progress')
      .select('*')
      .eq('child_id', childId)
      .eq('subject_category_id', subjectCategoryId)
      .maybeSingle();

    // Calculer le nouveau pourcentage si fourni
    const newCompletionPercentage = updates.completionPercentage ?? existing?.completion_percentage ?? 0;
    
    // Vérifier si c'est une nouvelle complétion (passe de < 100% à 100%)
    const wasCompleted = existing?.completion_percentage >= 100;
    const isNowCompleted = newCompletionPercentage >= 100;
    const isNewCompletion = !wasCompleted && isNowCompleted;

    // Préparer les données de mise à jour
    const updateData: any = {
      completed: updates.completed ?? existing?.completed ?? false,
      completion_percentage: newCompletionPercentage,
      last_played_at: new Date().toISOString(),
    };

    // Si nouvelle complétion, incrémenter completion_count
    if (isNewCompletion) {
      const currentCompletionCount = existing?.completion_count ?? 0;
      updateData.completion_count = currentCompletionCount + 1;
      updateData.stars_count = updateData.completion_count; // stars_count = completion_count
      updateData.last_completed_at = new Date().toISOString();
    } else {
      // Conserver les valeurs existantes si pas de nouvelle complétion
      updateData.completion_count = existing?.completion_count ?? 0;
      updateData.stars_count = updateData.completion_count; // stars_count doit toujours être égal à completion_count
      if (existing?.last_completed_at) {
        updateData.last_completed_at = existing.last_completed_at;
      }
    }

    if (existing) {
      // Mettre à jour
      const { data, error } = await this.supabase.client
        .from('frontend_subject_category_progress')
        .update(updateData)
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
          completed: updateData.completed,
          stars_count: updateData.stars_count,
          completion_percentage: updateData.completion_percentage,
          completion_count: updateData.completion_count,
          last_completed_at: updateData.last_completed_at,
          last_played_at: updateData.last_played_at,
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

  /**
   * Vérifie et incrémente le completion_count si c'est une nouvelle complétion.
   * Appelé après avoir calculé le nouveau completion_percentage.
   *
   * @param childId ID de l'enfant
   * @param subjectCategoryId ID de la sous-matière
   * @param newCompletionPercentage Nouveau pourcentage de complétion
   * @returns true si une nouvelle étoile a été gagnée
   */
  async checkAndIncrementCompletion(
    childId: string,
    subjectCategoryId: string,
    newCompletionPercentage: number
  ): Promise<boolean> {
    // Récupérer la progression actuelle
    const { data: existing } = await this.supabase.client
      .from('frontend_subject_category_progress')
      .select('completion_percentage, completion_count')
      .eq('child_id', childId)
      .eq('subject_category_id', subjectCategoryId)
      .maybeSingle();

    if (!existing) {
      return false;
    }

    // Vérifier si c'est une nouvelle complétion (passe de < 100% à 100%)
    const wasCompleted = existing.completion_percentage >= 100;
    const isNowCompleted = newCompletionPercentage >= 100;
    const isNewCompletion = !wasCompleted && isNowCompleted;

    if (isNewCompletion) {
      // Incrémenter completion_count et mettre à jour stars_count
      const newCompletionCount = (existing.completion_count ?? 0) + 1;
      
      const { error } = await this.supabase.client
        .from('frontend_subject_category_progress')
        .update({
          completion_count: newCompletionCount,
          stars_count: newCompletionCount,
          last_completed_at: new Date().toISOString(),
        })
        .eq('child_id', childId)
        .eq('subject_category_id', subjectCategoryId);

      if (error) {
        throw new Error(`Erreur lors de l'incrémentation du completion_count: ${error.message}`);
      }

      return true; // Nouvelle étoile gagnée
    }

    return false; // Pas de nouvelle étoile
  }

  /**
   * Récupère la progression d'une matière principale
   */
  async getSubjectProgress(childId: string, subjectId: string): Promise<SubjectProgress | null> {
    const { data, error } = await this.supabase.client
      .from('frontend_subject_progress')
      .select('*')
      .eq('child_id', childId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erreur lors de la récupération de la progression de la matière: ${error.message}`);
    }

    return data;
  }

  /**
   * Met à jour la progression d'une matière principale
   */
  async updateSubjectProgress(
    childId: string,
    subjectId: string,
    updates: {
      completionPercentage?: number;
    }
  ): Promise<SubjectProgress> {
    // Récupérer la progression existante
    const existing = await this.getSubjectProgress(childId, subjectId);

    // Calculer le nouveau pourcentage
    const newCompletionPercentage = updates.completionPercentage ?? existing?.completion_percentage ?? 0;
    
    // Vérifier si c'est une nouvelle complétion
    const wasCompleted = (existing?.completion_percentage ?? 0) >= 100;
    const isNowCompleted = newCompletionPercentage >= 100;
    const isNewCompletion = !wasCompleted && isNowCompleted;

    // Préparer les données de mise à jour
    const updateData: any = {
      completion_percentage: newCompletionPercentage,
      last_played_at: new Date().toISOString(),
    };

    // Si nouvelle complétion, incrémenter completion_count
    if (isNewCompletion) {
      const currentCompletionCount = existing?.completion_count ?? 0;
      updateData.completion_count = currentCompletionCount + 1;
      updateData.stars_count = updateData.completion_count;
      updateData.last_completed_at = new Date().toISOString();
    } else {
      updateData.completion_count = existing?.completion_count ?? 0;
      updateData.stars_count = updateData.completion_count;
      if (existing?.last_completed_at) {
        updateData.last_completed_at = existing.last_completed_at;
      }
    }

    if (existing) {
      // Mettre à jour
      const { data, error } = await this.supabase.client
        .from('frontend_subject_progress')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Erreur lors de la mise à jour de la progression de la matière: ${error.message}`);
      }

      return data;
    } else {
      // Créer
      const { data, error } = await this.supabase.client
        .from('frontend_subject_progress')
        .insert({
          child_id: childId,
          subject_id: subjectId,
          completion_count: updateData.completion_count,
          stars_count: updateData.stars_count,
          completion_percentage: updateData.completion_percentage,
          last_completed_at: updateData.last_completed_at,
          last_played_at: updateData.last_played_at,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erreur lors de la création de la progression de la matière: ${error.message}`);
      }

      return data;
    }
  }

  /**
   * Vérifie et incrémente le completion_count d'une matière si c'est une nouvelle complétion
   */
  async checkAndIncrementSubjectCompletion(
    childId: string,
    subjectId: string,
    newCompletionPercentage: number
  ): Promise<boolean> {
    const existing = await this.getSubjectProgress(childId, subjectId);

    if (!existing) {
      return false;
    }

    const wasCompleted = existing.completion_percentage >= 100;
    const isNowCompleted = newCompletionPercentage >= 100;
    const isNewCompletion = !wasCompleted && isNowCompleted;

    if (isNewCompletion) {
      const newCompletionCount = (existing.completion_count ?? 0) + 1;
      
      const { error } = await this.supabase.client
        .from('frontend_subject_progress')
        .update({
          completion_count: newCompletionCount,
          stars_count: newCompletionCount,
          last_completed_at: new Date().toISOString(),
        })
        .eq('child_id', childId)
        .eq('subject_id', subjectId);

      if (error) {
        throw new Error(`Erreur lors de l'incrémentation du completion_count de la matière: ${error.message}`);
      }

      return true;
    }

    return false;
  }
}

