import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { Game, GameAttempt } from '../../../../core/types/game.types';
import { normalizeGame } from '../../../../shared/utils/game-normalization.util';

@Injectable({
  providedIn: 'root',
})
export class GameInfrastructure {
  private readonly supabase = inject(SupabaseService);

  async loadGame(gameId: string): Promise<Game | null> {
    const { data, error } = await this.supabase.client
      .from('games')
      .select(`
        *,
        game_types!inner(name)
      `)
      .eq('id', gameId)
      .single();

    if (error) throw error;
    
    if (!data) return null;
    
    // Normaliser les données : convertir la structure ancienne en nouvelle si nécessaire
    return normalizeGame(data);
  }

  async saveGameAttempt(attempt: Partial<GameAttempt>): Promise<GameAttempt> {
    const { data, error } = await this.supabase.client
      .from('frontend_game_attempts')
      .insert(attempt)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

