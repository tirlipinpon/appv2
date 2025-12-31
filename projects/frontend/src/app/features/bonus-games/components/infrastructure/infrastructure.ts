import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { BonusGame, ChildBonusGameUnlock } from '../../../../core/types/game.types';

@Injectable({
  providedIn: 'root',
})
export class BonusGamesInfrastructure {
  private readonly supabase = inject(SupabaseService);

  async loadAllBonusGames(): Promise<BonusGame[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_bonus_games')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async loadUnlockedBonusGames(childId: string): Promise<ChildBonusGameUnlock[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_bonus_game_unlocks')
      .select('*')
      .eq('child_id', childId)
      .order('unlocked_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

