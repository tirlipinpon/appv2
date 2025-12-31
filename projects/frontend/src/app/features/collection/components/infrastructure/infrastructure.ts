import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { Collectible, ChildCollectible } from '../../../../core/types/game.types';

@Injectable({
  providedIn: 'root',
})
export class CollectionInfrastructure {
  private readonly supabase = inject(SupabaseService);

  async loadAllCollectibles(): Promise<Collectible[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_collectibles')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async loadUnlockedCollectibles(childId: string): Promise<ChildCollectible[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_collectibles')
      .select('*')
      .eq('child_id', childId)
      .order('unlocked_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

