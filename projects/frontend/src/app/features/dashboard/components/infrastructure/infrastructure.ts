import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { ChildStatistics } from '../../../../core/types/game.types';
import { Collectible, ChildCollectible } from '../../../../core/types/game.types';

@Injectable({
  providedIn: 'root',
})
export class DashboardInfrastructure {
  private readonly supabase = inject(SupabaseService);

  async loadChildStatistics(childId: string): Promise<ChildStatistics | null> {
    const { data, error } = await this.supabase.client
      .rpc('get_frontend_child_statistics', { p_child_id: childId })
      .single();

    if (error) throw error;
    return data as ChildStatistics | null;
  }

  async loadRecentCollectibles(childId: string, limit: number = 5): Promise<any[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_collectibles')
      .select('*, frontend_collectibles(*)')
      .eq('child_id', childId)
      .order('unlocked_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
}

