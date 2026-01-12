import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { Game, GameAttempt } from '../../../../core/types/game.types';
import { normalizeGame } from '../../../../shared/utils/game-normalization.util';

@Injectable({
  providedIn: 'root',
})
export class GameInfrastructure {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.client;

  async loadGame(gameId: string): Promise<Game | null> {
    const { data, error } = await this.supabase
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
    // Utiliser executeWithErrorHandling pour gérer les erreurs d'authentification de manière appropriée
    const result = await this.supabaseService.executeWithErrorHandling(async () => {
      return await this.supabase
        .from('frontend_game_attempts')
        .insert(attempt)
        .select()
        .single();
    });

    if (result.error) {
      console.error('[GameInfrastructure] Erreur lors de la sauvegarde de la tentative:', result.error);
      throw result.error;
    }

    if (!result.data) {
      throw new Error('Aucune donnée retournée lors de la sauvegarde de la tentative');
    }

    return result.data;
  }
}

