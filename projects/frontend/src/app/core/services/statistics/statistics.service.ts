import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { ChildStatistics } from '../../types/game.types';

/**
 * Service pour la gestion des statistiques des enfants
 * Centralise les appels RPC pour les statistiques
 */
@Injectable({
  providedIn: 'root',
})
export class StatisticsService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Charge les statistiques d'un enfant
   * 
   * @param childId - L'ID de l'enfant
   * @returns Les statistiques de l'enfant ou null si erreur
   * @throws Error si la requête échoue
   */
  async loadChildStatistics(childId: string): Promise<ChildStatistics | null> {
    const { data, error } = await this.supabase.client
      .rpc('get_frontend_child_statistics', { p_child_id: childId })
      .single();

    if (error) throw error;
    return data as ChildStatistics | null;
  }
}
