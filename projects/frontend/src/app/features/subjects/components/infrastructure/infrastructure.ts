import { inject, Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { CacheService } from '../../../../core/services/cache/cache.service';
import { Subject, SubjectCategory } from '../../types/subject.types';
import { SubjectCategoryProgress, Game } from '../../../../core/types/game.types';
import { normalizeGame } from '../../../../shared/utils/game-normalization.util';
import { shuffleArray } from '../../../../shared/utils/array.util';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class SubjectsInfrastructure {
  private readonly supabase = inject(SupabaseService);
  private readonly cache = inject(CacheService);

  async loadSubjects(childId: string | null = null): Promise<Subject[]> {
    if (!childId) {
      // Si pas de childId, retourner tous les sujets (comportement par défaut)
      const cacheKey = 'subjects:all';
      const cached = this.cache.get<Subject[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const { data, error } = await this.supabase.client
        .from('subjects')
        .select('*')
        .order('name');

      if (error) throw error;
      const subjects = data || [];
      this.cache.set(cacheKey, subjects, 10 * 60 * 1000); // Cache 10 minutes
      return subjects;
    }

    // Filtrer les sujets par childId via la table child_subject_enrollments (comme l'admin)
    // L'admin utilise child_subject_enrollments avec selected=true pour déterminer les matières activées
    const cacheKey = `subjects:child:${childId}`;
    const cached = this.cache.get<Subject[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Récupérer les enrollments où selected = true (comme l'admin)
    const { data: enrollments, error: enrollmentsError } = await this.supabase.client
      .from('child_subject_enrollments')
      .select('subject_id')
      .eq('child_id', childId)
      .eq('selected', true);

    if (enrollmentsError) throw enrollmentsError;

    if (!enrollments || enrollments.length === 0) {
      return [];
    }

    // Extraire les IDs de sujets
    const subjectIds = enrollments
      .map((e: { subject_id: string }) => e.subject_id)
      .filter((id: string | undefined): id is string => id !== undefined);

    if (subjectIds.length === 0) {
      return [];
    }

    // Récupérer les sujets correspondants
    const { data, error } = await this.supabase.client
      .from('subjects')
      .select('*')
      .in('id', subjectIds)
      .order('name');

    if (error) throw error;
    const subjects = data || [];
    this.cache.set(cacheKey, subjects, 10 * 60 * 1000); // Cache 10 minutes
    return subjects;
  }

  async loadSubjectCategories(subjectId: string): Promise<SubjectCategory[]> {
    const { data, error } = await this.supabase.client
      .from('subject_categories')
      .select('*')
      .eq('subject_id', subjectId)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async loadChildProgress(childId: string, categoryIds: string[]): Promise<SubjectCategoryProgress[]> {
    if (categoryIds.length === 0) return [];

    const { data, error } = await this.supabase.client
      .from('frontend_subject_category_progress')
      .select('*')
      .eq('child_id', childId)
      .in('subject_category_id', categoryIds);

    if (error) throw error;
    return data || [];
  }

  async loadSubjectWithCategories(subjectId: string): Promise<SubjectCategory[]> {
    return this.loadSubjectCategories(subjectId);
  }

  /**
   * Récupère les scores des jeux pour un enfant donné
   * Retourne une Map<gameId, score> avec le meilleur score pour chaque jeu
   */
  async getGameScores(childId: string, gameIds: string[]): Promise<Map<string, number>> {
    if (gameIds.length === 0) return new Map();

    const { data, error } = await this.supabase.client
      .from('frontend_game_attempts')
      .select('game_id, score')
      .eq('child_id', childId)
      .in('game_id', gameIds);

    if (error) throw error;
    
    // Créer une Map avec le meilleur score pour chaque jeu
    const scoresMap = new Map<string, number>();
    if (data) {
      for (const attempt of data) {
        const currentScore = scoresMap.get(attempt.game_id) || 0;
        if (attempt.score > currentScore) {
          scoresMap.set(attempt.game_id, attempt.score);
        }
      }
    }
    
    return scoresMap;
  }


  async loadGamesByCategory(categoryId: string, childId?: string): Promise<Game[]> {
    const { data, error } = await this.supabase.client
      .from('games')
      .select(`
        *,
        game_types!inner(name)
      `)
      .eq('subject_category_id', categoryId);

    if (error) throw error;
    if (!data) return [];
    
    // Normaliser les jeux
    const games = data.map((game) => normalizeGame(game));
    
    // Mélanger aléatoirement les jeux (on affiche tous les jeux maintenant)
    return shuffleArray(games);
  }

  async loadGamesBySubject(subjectId: string, childId?: string): Promise<Game[]> {
    const { data, error } = await this.supabase.client
      .from('games')
      .select(`
        *,
        game_types!inner(name)
      `)
      .eq('subject_id', subjectId)
      .is('subject_category_id', null);

    if (error) throw error;
    if (!data) return [];
    
    // Normaliser les jeux
    const games = data.map((game) => normalizeGame(game));
    
    // Mélanger aléatoirement les jeux (on affiche tous les jeux maintenant)
    return shuffleArray(games);
  }

  /**
   * Récupère les statistiques de jeux pour une matière (avec filtre enfant via RLS)
   * @param childId - ID de l'enfant (obligatoire pour frontend)
   * @param subjectId - ID de la matière
   * @returns Observable avec les stats ou une erreur
   */
  getGamesStatsForChildSubject(
    childId: string,
    subjectId: string
  ): Observable<{ stats: Record<string, number>; total: number; error: PostgrestError | null }> {
    // Les RLS policies filtrent automatiquement les jeux selon les permissions de l'enfant
    return from(
      this.supabase.client
        .from('games')
        .select('id, game_type:game_types(name)')
        .eq('subject_id', subjectId)
        .is('subject_category_id', null)
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) {
          return { stats: {}, total: 0, error: error || null };
        }

        // Grouper et compter par type
        const stats: Record<string, number> = {};
        let total = 0;

        data.forEach((game: unknown) => {
          const gameData = game as { game_type: { name: string } | { name: string }[] | null };
          const gameType = Array.isArray(gameData.game_type) 
            ? gameData.game_type[0] 
            : gameData.game_type;
          const typeName = gameType?.name || 'Inconnu';
          stats[typeName] = (stats[typeName] || 0) + 1;
          total++;
        });

        return { stats, total, error: null };
      })
    );
  }

  /**
   * Récupère les statistiques de jeux pour une catégorie (avec filtre enfant via RLS)
   * @param childId - ID de l'enfant (obligatoire pour frontend)
   * @param categoryId - ID de la catégorie
   * @returns Observable avec les stats ou une erreur
   */
  getGamesStatsForChildCategory(
    childId: string,
    categoryId: string
  ): Observable<{ stats: Record<string, number>; total: number; error: PostgrestError | null }> {
    // Les RLS policies filtrent automatiquement les jeux selon les permissions de l'enfant
    return from(
      this.supabase.client
        .from('games')
        .select('id, game_type:game_types(name)')
        .eq('subject_category_id', categoryId)
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) {
          return { stats: {}, total: 0, error: error || null };
        }

        // Grouper et compter par type
        const stats: Record<string, number> = {};
        let total = 0;

        data.forEach((game: unknown) => {
          const gameData = game as { game_type: { name: string } | { name: string }[] | null };
          const gameType = Array.isArray(gameData.game_type) 
            ? gameData.game_type[0] 
            : gameData.game_type;
          const typeName = gameType?.name || 'Inconnu';
          stats[typeName] = (stats[typeName] || 0) + 1;
          total++;
        });

        return { stats, total, error: null };
      })
    );
  }
}

