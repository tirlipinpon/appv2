import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { Collectible, ChildCollectible } from '../../types/game.types';

@Injectable({
  providedIn: 'root',
})
export class CollectionService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Récupère tous les collectibles disponibles
   */
  async getAllCollectibles(): Promise<Collectible[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_collectibles')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Erreur lors de la récupération des collectibles: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Récupère les collectibles débloqués par un enfant
   */
  async getUnlockedCollectibles(childId: string): Promise<ChildCollectible[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_collectibles')
      .select('*')
      .eq('child_id', childId)
      .order('unlocked_at', { ascending: false });

    if (error) {
      throw new Error(`Erreur lors de la récupération des collectibles débloqués: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Débloque un collectible pour un enfant
   */
  async unlockCollectible(childId: string, collectibleId: string): Promise<ChildCollectible> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_collectibles')
      .insert({
        child_id: childId,
        collectible_id: collectibleId,
        unlocked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors du déblocage du collectible: ${error.message}`);
    }

    return data;
  }

  /**
   * Vérifie si un collectible est débloqué
   */
  async isCollectibleUnlocked(childId: string, collectibleId: string): Promise<boolean> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_collectibles')
      .select('id')
      .eq('child_id', childId)
      .eq('collectible_id', collectibleId)
      .single();

    return !error && data !== null;
  }

  /**
   * Vérifie les conditions de déblocage d'un collectible
   */
  async checkUnlockCondition(
    childId: string,
    collectible: Collectible
  ): Promise<boolean> {
    if (!collectible.unlock_condition_json) {
      return false;
    }

    const condition = collectible.unlock_condition_json;

    // Condition: compléter une sous-matière
    if (condition['type'] === 'complete_subject_category' && condition['subject_category_id']) {
      const { data } = await this.supabase.client
        .from('frontend_subject_category_progress')
        .select('completed')
        .eq('child_id', childId)
        .eq('subject_category_id', condition['subject_category_id'])
        .eq('completed', true)
        .single();

      return data !== null;
    }

    // Ajouter d'autres conditions selon les besoins
    return false;
  }
}

