import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { Game, GameAttempt } from '../../../../core/types/game.types';

@Injectable({
  providedIn: 'root',
})
export class GameInfrastructure {
  private readonly supabase = inject(SupabaseService);

  async loadGame(gameId: string): Promise<Game | null> {
    const { data, error } = await this.supabase.client
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error) throw error;
    return data;
  }

  async loadGamesByCategory(categoryId: string): Promise<Game[]> {
    const { data, error } = await this.supabase.client
      .from('games')
      .select('*')
      .eq('subject_category_id', categoryId)
      .order('name');

    if (error) throw error;
    return data || [];
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

