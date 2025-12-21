import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from '../../../../shared/services/supabase/supabase.service';
import type { Game, GameCreate, GameUpdate } from '../../types/game';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class GameService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Récupère tous les jeux pour une matière donnée
   * Filtre uniquement les jeux dont la matière a au moins une affectation active (deleted_at IS NULL)
   */
  getGamesBySubject(subjectId: string): Observable<{ games: Game[]; error: PostgrestError | null }> {
    // D'abord vérifier s'il y a des affectations actives pour cette matière
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
   * Récupère les statistiques de jeux pour une matière (count par type)
   * Retourne un objet { typeName: count } et le total
   * Filtre uniquement les jeux dont la matière a au moins une affectation active (deleted_at IS NULL)
   */
  getGamesStatsBySubject(subjectId: string): Observable<{ 
    stats: Record<string, number>; 
    total: number;
    error: PostgrestError | null 
  }> {
    // D'abord vérifier s'il y a des affectations actives pour cette matière
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

            data.forEach((game: any) => {
              const typeName = game.game_type?.name || 'Inconnu';
              stats[typeName] = (stats[typeName] || 0) + 1;
              total++;
            });

            return { stats, total, error: null };
          })
        );
      })
    );
  }
}

