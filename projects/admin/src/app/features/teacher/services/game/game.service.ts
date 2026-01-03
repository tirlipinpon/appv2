import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from '../../../../shared';
import type { Game, GameCreate, GameUpdate } from '../../types/game';
import type { PostgrestError } from '@supabase/supabase-js';

// Types pour les résultats de requêtes Supabase avec jointures
interface GameWithTypeName {
  id: string;
  subject_id?: string | null;
  subject_category_id?: string | null;
  game_type: {
    name: string;
  } | null | {
    name: string;
  }[];
}

interface TeacherAssignmentWithSubjectId {
  subject_id: string;
}

@Injectable({
  providedIn: 'root',
})
export class GameService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Récupère tous les jeux pour une matière donnée ou une sous-catégorie
   * Filtre uniquement les jeux dont la matière a au moins une affectation active (deleted_at IS NULL)
   */
  getGamesBySubject(subjectId: string, subjectCategoryId?: string): Observable<{ games: Game[]; error: PostgrestError | null }> {
    // Si on a une sous-catégorie, récupérer directement les jeux de cette sous-catégorie
    if (subjectCategoryId) {
      return from(
        this.supabaseService.client
          .from('games')
          .select('*')
          .eq('subject_category_id', subjectCategoryId)
          .order('created_at', { ascending: false })
      ).pipe(
        map(({ data, error }) => ({
          games: (data || []) as Game[],
          error: error || null,
        }))
      );
    }

    // Sinon, récupérer les jeux de la matière (vérifier d'abord les affectations actives)
    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .select('id')
        .eq('subject_id', subjectId)
        .is('deleted_at', null)
        .limit(1)
    ).pipe(
      switchMap(({ data: assignments, error: assignmentsError }) => {
        // Si pas d'affectation active, retourner une liste vide
        if (assignmentsError || !assignments || assignments.length === 0) {
          return from(Promise.resolve({ games: [] as Game[], error: assignmentsError || null }));
        }

        // Si au moins une affectation active existe, récupérer les jeux
        // Récupérer les jeux directement liés à la matière (subject_id)
        return from(
          this.supabaseService.client
            .from('games')
            .select('*')
            .eq('subject_id', subjectId)
            .order('created_at', { ascending: false })
        ).pipe(
          map(({ data, error }) => ({
            games: (data || []) as Game[],
            error: error || null,
          }))
        );
      })
    );
  }

  /**
   * Crée un nouveau jeu
   */
  createGame(gameData: GameCreate): Observable<{ game: Game | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('games')
        .insert(gameData)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        game: data,
        error: error || null,
      }))
    );
  }

  /**
   * Met à jour un jeu existant
   */
  updateGame(id: string, updates: GameUpdate): Observable<{ game: Game | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('games')
        .update(updates)
        .eq('id', id)
        .select()
        .limit(1)
    ).pipe(
      map(({ data, error }) => {
        const rows = (data as Game[] | null) || [];
        const logicalError = (rows.length === 0 && !error)
          ? ({ message: 'Aucune ligne mise à jour' } as PostgrestError)
          : null;
        return {
          game: rows[0] || null,
          error: (error || logicalError) as PostgrestError | null,
        };
      })
    );
  }

  /**
   * Supprime un jeu
   */
  deleteGame(id: string): Observable<{ error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('games')
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => ({
        error: error || null,
      }))
    );
  }

  /**
   * Récupère les statistiques de jeux pour une matière ou une sous-catégorie (count par type)
   * Retourne un objet { typeName: count } et le total
   * Filtre uniquement les jeux dont la matière a au moins une affectation active (deleted_at IS NULL)
   * 
   * @param subjectId - ID de la matière (peut être vide si subjectCategoryId est fourni)
   * @param subjectCategoryId - ID de la sous-catégorie (optionnel)
   * @param skipAssignmentCheck - Si true, skip la vérification d'assignments (optimisation)
   */
  getGamesStatsBySubject(subjectId: string, subjectCategoryId?: string, skipAssignmentCheck = false): Observable<{ 
    stats: Record<string, number>; 
    total: number;
    error: PostgrestError | null 
  }> {
    // Si on a une sous-catégorie, récupérer directement les stats de cette sous-catégorie
    // (subjectId peut être vide dans ce cas)
    if (subjectCategoryId) {
      return from(
        this.supabaseService.client
          .from('games')
          .select('id, game_type:game_types(name)')
          .eq('subject_category_id', subjectCategoryId)
      ).pipe(
        map(({ data, error }) => {
          if (error || !data) {
            return { stats: {}, total: 0, error: error || null };
          }

          // Grouper et compter par type
          const stats: Record<string, number> = {};
          let total = 0;

          data.forEach((game: unknown) => {
            const gameData = game as GameWithTypeName;
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

    // Sinon, récupérer les stats de la matière (vérifier d'abord les affectations actives sauf si skip)
    if (skipAssignmentCheck) {
      // Skip la vérification d'assignments - on sait qu'ils existent
      return from(
        this.supabaseService.client
          .from('games')
          .select('id, game_type:game_types(name)')
          .eq('subject_id', subjectId)
      ).pipe(
        map(({ data, error }) => {
          if (error || !data) {
            return { stats: {}, total: 0, error: error || null };
          }

          // Grouper et compter par type
          const stats: Record<string, number> = {};
          let total = 0;

          data.forEach((game: unknown) => {
            const gameData = game as GameWithTypeName;
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

    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .select('id')
        .eq('subject_id', subjectId)
        .is('deleted_at', null)
        .limit(1)
    ).pipe(
      switchMap(({ data: assignments, error: assignmentsError }) => {
        // Si pas d'affectation active, retourner des stats vides
        if (assignmentsError || !assignments || assignments.length === 0) {
          return from(Promise.resolve({ stats: {}, total: 0, error: assignmentsError || null }));
        }

        // Si au moins une affectation active existe, récupérer les stats des jeux
        // Récupérer les jeux directement liés à la matière
        return from(
          this.supabaseService.client
            .from('games')
            .select('id, game_type:game_types(name)')
            .eq('subject_id', subjectId)
        ).pipe(
          map(({ data, error }) => {
            if (error || !data) {
              return { stats: {}, total: 0, error: error || null };
            }

            // Grouper et compter par type
            const stats: Record<string, number> = {};
            let total = 0;

            data.forEach((game: unknown) => {
              const gameData = game as GameWithTypeName;
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
      })
    );
  }

  /**
   * Récupère les statistiques de jeux pour plusieurs matières en batch (optimisation)
   * Retourne un Map<subjectId, { stats: Record<string, number>, total: number }>
   */
  getGamesStatsBySubjectsBatch(subjectIds: string[], skipAssignmentCheck = false): Observable<{ 
    statsBySubject: Map<string, { stats: Record<string, number>, total: number }>;
    error: PostgrestError | null 
  }> {
    if (subjectIds.length === 0) {
      return from(Promise.resolve({ statsBySubject: new Map(), error: null }));
    }

    // Si on doit vérifier les assignments, récupérer d'abord les matières qui ont des assignments actifs
    if (skipAssignmentCheck) {
      // Récupérer tous les jeux pour ces matières en une seule requête
      return from(
        this.supabaseService.client
          .from('games')
          .select('id, subject_id, game_type:game_types(name)')
          .in('subject_id', subjectIds)
      ).pipe(
        map(({ data, error }) => {
          if (error || !data) {
            return { statsBySubject: new Map(), error: error || null };
          }

          // Grouper par matière et compter par type
          const statsBySubject = new Map<string, { stats: Record<string, number>, total: number }>();
          
          // Initialiser toutes les matières avec des stats vides
          subjectIds.forEach(subjectId => {
            statsBySubject.set(subjectId, { stats: {}, total: 0 });
          });

          // Grouper et compter
          data.forEach((game: unknown) => {
            const gameData = game as GameWithTypeName;
            const subjectId = gameData.subject_id;
            const gameType = Array.isArray(gameData.game_type) 
              ? gameData.game_type[0] 
              : gameData.game_type;
            const typeName = gameType?.name || 'Inconnu';
            
            const current = statsBySubject.get(subjectId || '');
            if (current) {
              current.stats[typeName] = (current.stats[typeName] || 0) + 1;
              current.total++;
            }
          });

          return { statsBySubject, error: null };
        })
      );
    }

    // Vérifier d'abord quelles matières ont des assignments actives
    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .select('subject_id')
        .in('subject_id', subjectIds)
        .is('deleted_at', null)
    ).pipe(
      switchMap(({ data: assignments, error: assignmentsError }) => {
        if (assignmentsError) {
          return from(Promise.resolve({ statsBySubject: new Map(), error: assignmentsError }));
        }

        // Extraire les subjectIds qui ont des assignments actives
        const subjectIdsWithAssignments = new Set(
          (assignments || []).map((a: TeacherAssignmentWithSubjectId) => a.subject_id)
        );

        if (subjectIdsWithAssignments.size === 0) {
          // Aucune matière n'a d'assignments actifs
          const statsBySubject = new Map<string, { stats: Record<string, number>, total: number }>();
          subjectIds.forEach(subjectId => {
            statsBySubject.set(subjectId, { stats: {}, total: 0 });
          });
          return from(Promise.resolve({ statsBySubject, error: null }));
        }

        // Récupérer tous les jeux pour les matières qui ont des assignments en une seule requête
        return from(
          this.supabaseService.client
            .from('games')
            .select('id, subject_id, game_type:game_types(name)')
            .in('subject_id', Array.from(subjectIdsWithAssignments))
        ).pipe(
          map(({ data, error }) => {
            if (error || !data) {
              return { statsBySubject: new Map(), error: error || null };
            }

            // Grouper par matière et compter par type
            const statsBySubject = new Map<string, { stats: Record<string, number>, total: number }>();
            
            // Initialiser toutes les matières avec des stats vides
            subjectIds.forEach(subjectId => {
              statsBySubject.set(subjectId, { stats: {}, total: 0 });
            });

            // Grouper et compter
            data.forEach((game: unknown) => {
              const gameData = game as GameWithTypeName;
              const subjectId = gameData.subject_id;
              const gameType = Array.isArray(gameData.game_type) 
                ? gameData.game_type[0] 
                : gameData.game_type;
              const typeName = gameType?.name || 'Inconnu';
              
              const current = statsBySubject.get(subjectId || '');
              if (current) {
                current.stats[typeName] = (current.stats[typeName] || 0) + 1;
                current.total++;
              }
            });

            return { statsBySubject, error: null };
          })
        );
      })
    );
  }

  /**
   * Récupère les statistiques de jeux pour plusieurs catégories en batch (optimisation)
   */
  getGamesStatsByCategoriesBatch(categoryIds: string[]): Observable<{ 
    statsByCategory: Map<string, { stats: Record<string, number>, total: number }>;
    error: PostgrestError | null 
  }> {
    if (categoryIds.length === 0) {
      return from(Promise.resolve({ statsByCategory: new Map(), error: null }));
    }

    // Récupérer tous les jeux pour ces catégories en une seule requête
    return from(
      this.supabaseService.client
        .from('games')
        .select('id, subject_category_id, game_type:game_types(name)')
        .in('subject_category_id', categoryIds)
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) {
          return { statsByCategory: new Map(), error: error || null };
        }

        // Grouper par catégorie et compter par type
        const statsByCategory = new Map<string, { stats: Record<string, number>, total: number }>();
        
        // Initialiser toutes les catégories avec des stats vides
        categoryIds.forEach(categoryId => {
          statsByCategory.set(categoryId, { stats: {}, total: 0 });
        });

        // Grouper et compter
        data.forEach((game: unknown) => {
          const gameData = game as GameWithTypeName;
          const categoryId = gameData.subject_category_id;
          const gameType = Array.isArray(gameData.game_type) 
            ? gameData.game_type[0] 
            : gameData.game_type;
          const typeName = gameType?.name || 'Inconnu';
          
          const current = statsByCategory.get(categoryId || '');
          if (current) {
            current.stats[typeName] = (current.stats[typeName] || 0) + 1;
            current.total++;
          }
        });

        return { statsByCategory, error: null };
      })
    );
  }
}

