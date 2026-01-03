import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class DashboardInfrastructure {
  private readonly supabase = inject(SupabaseService);

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

