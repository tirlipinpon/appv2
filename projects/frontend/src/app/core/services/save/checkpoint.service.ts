import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { ChildCheckpoint } from '../../types/game.types';

@Injectable({
  providedIn: 'root',
})
export class CheckpointService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Crée un checkpoint à la fin d'un jeu
   */
  async createGameEndCheckpoint(
    childId: string,
    checkpointData: Record<string, unknown>
  ): Promise<ChildCheckpoint> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_checkpoints')
      .insert({
        child_id: childId,
        checkpoint_type: 'game_end',
        checkpoint_data_json: checkpointData,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de la création du checkpoint: ${error.message}`);
    }

    return data;
  }

  /**
   * Crée un checkpoint à la fin d'une sous-matière
   */
  async createSubjectCategoryEndCheckpoint(
    childId: string,
    checkpointData: Record<string, unknown>
  ): Promise<ChildCheckpoint> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_checkpoints')
      .insert({
        child_id: childId,
        checkpoint_type: 'subject_category_end',
        checkpoint_data_json: checkpointData,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de la création du checkpoint: ${error.message}`);
    }

    return data;
  }

  /**
   * Récupère le dernier checkpoint d'un enfant
   */
  async getLastCheckpoint(childId: string): Promise<ChildCheckpoint | null> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_checkpoints')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  /**
   * Supprime les anciens checkpoints (nettoyage)
   */
  async cleanupOldCheckpoints(childId: string, keepLast: number = 10): Promise<void> {
    // Récupérer tous les checkpoints
    const { data: checkpoints } = await this.supabase.client
      .from('frontend_child_checkpoints')
      .select('id')
      .eq('child_id', childId)
      .order('created_at', { ascending: false });

    if (!checkpoints || checkpoints.length <= keepLast) {
      return;
    }

    // Supprimer les anciens
    const toDelete = checkpoints.slice(keepLast);
    const idsToDelete = toDelete.map((c) => c.id);

    const { error } = await this.supabase.client
      .from('frontend_child_checkpoints')
      .delete()
      .in('id', idsToDelete);

    if (error) {
      console.error('Erreur lors du nettoyage des checkpoints:', error);
    }
  }
}

