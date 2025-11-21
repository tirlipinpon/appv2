import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../../shared/services/supabase/supabase.service';
import type { GameType } from '../../types/game-type';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class GameTypeService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Récupère tous les types de jeux
   */
  getGameTypes(): Observable<{ gameTypes: GameType[]; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('game_types')
        .select('*')
        .order('name', { ascending: true })
    ).pipe(
      map(({ data, error }) => ({
        gameTypes: data || [],
        error: error || null,
      }))
    );
  }
}

