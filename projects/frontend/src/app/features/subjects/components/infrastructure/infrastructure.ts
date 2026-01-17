import { inject, Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { CacheService } from '../../../../core/services/cache/cache.service';
import { ProgressionService } from '../../../../core/services/progression/progression.service';
import { Subject, SubjectCategory } from '../../types/subject.types';
import { SubjectCategoryProgress, SubjectProgress, Game } from '../../../../core/types/game.types';
import { normalizeGame } from '../../../../shared/utils/game-normalization.util';
import { shuffleArray } from '../../../../shared/utils/array.util';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class SubjectsInfrastructure {
  private readonly supabase = inject(SupabaseService);
  private readonly cache = inject(CacheService);
  private readonly progressionService = inject(ProgressionService);

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

  async loadSubjectCategories(subjectId: string, childId?: string | null): Promise<SubjectCategory[]> {
    // Si pas de childId, retourner toutes les catégories (comportement par défaut)
    if (!childId) {
      const { data, error } = await this.supabase.client
        .from('subject_categories')
        .select('*')
        .eq('subject_id', subjectId)
        .order('name');

      if (error) throw error;
      const allCategories = data || [];
      return allCategories;
    }

    // NE PAS utiliser de cache pour les catégories filtrées car elles dépendent des enrollments
    // qui peuvent changer fréquemment. Le cache pourrait contenir des données obsolètes.
    // On charge toujours depuis la base de données pour garantir la cohérence.

    // Filtrer les catégories par childId via la table child_subject_category_enrollments (comme pour les matières)
    // Récupérer les enrollments où selected = true (comme l'admin)
    const { data: enrollments, error: enrollmentsError } = await this.supabase.client
      .from('child_subject_category_enrollments')
      .select('subject_category_id')
      .eq('child_id', childId)
      .eq('selected', true);

    if (enrollmentsError) throw enrollmentsError;

    if (!enrollments || enrollments.length === 0) {
      return [];
    }

    // Extraire les IDs de catégories
    const categoryIds = enrollments
      .map((e: { subject_category_id: string }) => e.subject_category_id)
      .filter((id: string | undefined): id is string => id !== undefined);

    if (categoryIds.length === 0) {
      return [];
    }

    // Récupérer les catégories correspondantes ET qui appartiennent à la matière
    const { data, error } = await this.supabase.client
      .from('subject_categories')
      .select('*')
      .eq('subject_id', subjectId)
      .in('id', categoryIds)
      .order('name');

    if (error) throw error;
    const filteredCategories = data || [];
    // NE PAS mettre en cache les catégories filtrées car elles dépendent des enrollments
    // qui peuvent changer fréquemment. On charge toujours depuis la base de données.
    return filteredCategories;
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

  async loadSubjectWithCategories(subjectId: string, childId?: string | null): Promise<SubjectCategory[]> {
    return this.loadSubjectCategories(subjectId, childId);
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

  /**
   * Calcule le pourcentage de réussite précis pour un jeu en comptant toutes les questions
   * correctes et incorrectes de toutes les tentatives
   * @param childId - ID de l'enfant
   * @param gameId - ID du jeu
   * @returns Pourcentage de réussite (0-100) ou null si aucune tentative
   */
  async calculateGameSuccessRate(childId: string, gameId: string): Promise<number | null> {
    const { data, error } = await this.supabase.client
      .from('frontend_game_attempts')
      .select('score, responses_json')
      .eq('child_id', childId)
      .eq('game_id', gameId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return null;
    }

    // Pour les jeux avec questions (jeux génériques)
    // On peut calculer le pourcentage basé sur le score moyen ou le meilleur score
    // Mais pour être plus précis, on devrait compter toutes les questions répondues
    
    // Pour l'instant, on utilise le meilleur score comme indicateur
    // TODO: Améliorer pour compter précisément toutes les questions correctes/incorrectes
    let bestScore = 0;
    let totalQuestions = 0;
    
    for (const attempt of data) {
      // Le score dans la table est déjà un pourcentage (0-100)
      if (attempt.score > bestScore) {
        bestScore = attempt.score;
      }
      
      // Si on a des réponses JSON, on pourrait compter les questions
      if (attempt.responses_json && typeof attempt.responses_json === 'object') {
        const responses = attempt.responses_json as { questions?: unknown[] };
        if (responses.questions && Array.isArray(responses.questions)) {
          // Le nombre de questions dans cette tentative
          const questionsInAttempt = responses.questions.length;
          if (questionsInAttempt > totalQuestions) {
            totalQuestions = questionsInAttempt;
          }
        }
      }
    }

    // Si on a un meilleur score, on l'utilise
    // Sinon, on retourne null (aucune tentative valide)
    return bestScore > 0 ? bestScore : null;
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

  /**
   * Charge la progression d'une matière principale pour un enfant
   */
  async loadSubjectProgress(childId: string, subjectId: string): Promise<SubjectProgress | null> {
    const { data, error } = await this.supabase.client
      .from('frontend_subject_progress')
      .select('*')
      .eq('child_id', childId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erreur lors de la récupération de la progression de la matière: ${error.message}`);
    }

    return data || null;
  }

  /**
   * Charge les progressions de plusieurs matières pour un enfant
   */
  async loadSubjectsProgress(childId: string, subjectIds: string[]): Promise<SubjectProgress[]> {
    if (subjectIds.length === 0) return [];

    const { data, error } = await this.supabase.client
      .from('frontend_subject_progress')
      .select('*')
      .eq('child_id', childId)
      .in('subject_id', subjectIds);

    if (error) {
      throw new Error(`Erreur lors de la récupération des progressions des matières: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Met à jour la progression d'une matière principale
   */
  async updateSubjectProgress(
    childId: string,
    subjectId: string,
    updates: {
      completionPercentage?: number;
      completed?: boolean;
    }
  ): Promise<SubjectProgress> {
    return this.progressionService.updateSubjectProgress(childId, subjectId, updates);
  }

  /**
   * Récupère les professeurs associés à une matière via les affectations actives
   * @param subjectId - ID de la matière
   * @param childId - ID de l'enfant (optionnel, pour filtrer par école/niveau)
   * @returns Liste des noms des professeurs (fullname ou display_name)
   */
  async getTeachersForSubject(subjectId: string, childId?: string | null): Promise<string[]> {
    // Construire la requête de base avec filtres par école et niveau (nécessaires pour les RLS)
    let query = this.supabase.client
      .from('teacher_assignments')
      .select('teacher_id, school_id, school_level')
      .eq('subject_id', subjectId)
      .is('deleted_at', null);

    // Si on a un childId, récupérer ses informations pour filtrer par école et niveau
    if (childId) {
      const { data: childData, error: childError } = await this.supabase.client
        .from('children')
        .select('school_id, school_level')
        .eq('id', childId)
        .single();

      if (!childError && childData) {
        const schoolId = (childData as { school_id?: string | null }).school_id;
        const schoolLevel = (childData as { school_level?: string | null }).school_level;

        // Filtrer par école si disponible
        if (schoolId) {
          query = query.eq('school_id', schoolId);
        }

        // Filtrer par niveau scolaire si disponible
        if (schoolLevel) {
          query = query.eq('school_level', schoolLevel);
        }
      }
    }

    // Exécuter la requête
    const { data: assignments, error: assignmentsError } = await query;

    if (assignmentsError) {
      console.error('[getTeachersForSubject] Erreur lors de la récupération des affectations:', assignmentsError);
      return [];
    }

    if (!assignments || assignments.length === 0) {
      return [];
    }

    // Extraire les teacher_ids uniques
    const teacherIds = [...new Set(
      assignments
        .map((a: { teacher_id: string }) => a.teacher_id)
        .filter((id: string | null): id is string => id !== null)
    )];

    if (teacherIds.length === 0) {
      return [];
    }

    // Récupérer les informations des professeurs
    const { data: teachers, error: teachersError } = await this.supabase.client
      .from('teachers')
      .select('id, fullname, profile_id')
      .in('id', teacherIds);

    if (teachersError) {
      console.error('[getTeachersForSubject] Erreur lors de la récupération des professeurs:', teachersError);
      return [];
    }

    if (!teachers || teachers.length === 0) {
      return [];
    }

    // Extraire les profile_ids pour récupérer les display_name si fullname est null
    const profileIds = teachers
      .filter((t: { fullname?: string | null; profile_id?: string | null }) => !t.fullname && t.profile_id)
      .map((t: { profile_id?: string | null }) => t.profile_id)
      .filter((id: string | null | undefined): id is string => id !== null && id !== undefined);

    // Récupérer les display_name des profils si nécessaire
    let profilesMap = new Map<string, string>();
    if (profileIds.length > 0) {
      const { data: profiles, error: profilesError } = await this.supabase.client
        .from('profiles')
        .select('id, display_name')
        .in('id', profileIds);

      if (!profilesError && profiles) {
        for (const profile of profiles) {
          const profileId = (profile as { id: string }).id;
          const displayName = (profile as { display_name?: string | null }).display_name;
          if (displayName) {
            profilesMap.set(profileId, displayName);
          }
        }
      }
    }

    // Extraire les noms des professeurs (fullname en priorité, sinon display_name)
    const teacherNames: string[] = [];
    const seenNames = new Set<string>();

    for (const teacher of teachers) {
      const fullname = (teacher as { fullname?: string | null }).fullname;
      const profileId = (teacher as { profile_id?: string | null }).profile_id;
      const displayName = profileId ? profilesMap.get(profileId) : null;

      const name = fullname || displayName || null;
      
      if (name && !seenNames.has(name)) {
        teacherNames.push(name);
        seenNames.add(name);
      }
    }

    return teacherNames;
  }

  /**
   * Récupère les professeurs associés à plusieurs matières en une seule requête
   * @param subjectIds - IDs des matières
   * @param childId - ID de l'enfant (pour récupérer son école et niveau scolaire)
   * @returns Map<subjectId, string[]> des noms des professeurs par matière
   */
  async getTeachersForSubjects(subjectIds: string[], childId?: string | null): Promise<Map<string, string[]>> {
    if (subjectIds.length === 0) {
      return new Map();
    }

    // Utiliser la fonction RPC pour contourner les RLS (comme get_frontend_child_statistics)
    const { data: rpcResult, error: rpcError } = await this.supabase.client
      .rpc('get_teachers_for_subjects', {
        p_subject_ids: subjectIds,
        p_child_id: childId || null
      });

    if (rpcError) {
      console.error('[getTeachersForSubjects] Erreur lors de l\'appel RPC:', rpcError);
      return new Map();
    }

    if (!rpcResult || rpcResult.length === 0) {
      return new Map();
    }

    // Convertir le résultat RPC en Map
    const result = new Map<string, string[]>();
    for (const row of rpcResult) {
      const subjectId = (row as { subject_id: string }).subject_id;
      const teacherNames = (row as { teacher_names: string[] }).teacher_names;
      if (subjectId && teacherNames && teacherNames.length > 0) {
        result.set(subjectId, teacherNames);
      }
    }

    return result;
  }
}

