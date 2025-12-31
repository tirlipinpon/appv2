import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { ChildStatistics } from '../../../../core/types/game.types';

@Injectable({
  providedIn: 'root',
})
export class SettingsInfrastructure {
  private readonly supabase = inject(SupabaseService);

  async loadChildStatistics(childId: string): Promise<ChildStatistics | null> {
    const { data, error } = await this.supabase.client
      .rpc('get_frontend_child_statistics', { p_child_id: childId })
      .single();

    if (error) throw error;
    return data as ChildStatistics | null;
  }
}

