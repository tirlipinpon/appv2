import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { MascotState } from '../../types/game.types';

@Injectable({
  providedIn: 'root',
})
export class MascotService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Récupère l'état de la mascotte pour un enfant
   */
  async getMascotState(childId: string): Promise<MascotState | null> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_mascot_state')
      .select('*')
      .eq('child_id', childId)
      .single();

    if (error || !data) {
      // Créer un état par défaut si inexistant
      return this.createDefaultMascotState(childId);
    }

    return data;
  }

  /**
   * Crée un état de mascotte par défaut
   */
  async createDefaultMascotState(childId: string): Promise<MascotState> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_mascot_state')
      .insert({
        child_id: childId,
        level: 1,
        xp: 0,
        evolution_stage: 1,
        current_appearance_json: {
          color: '#FFD700',
          accessories: [],
        },
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de la création de la mascotte: ${error.message}`);
    }

    return data;
  }

  /**
   * Calcule le niveau de la mascotte selon l'XP
   */
  calculateLevel(xp: number): number {
    // Formule: niveau = floor(sqrt(xp / 100)) + 1
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }

  /**
   * Calcule l'XP nécessaire pour le prochain niveau
   */
  getXpForNextLevel(currentLevel: number): number {
    return Math.pow(currentLevel, 2) * 100;
  }

  /**
   * Ajoute de l'XP à la mascotte
   */
  async addXp(childId: string, xpGained: number): Promise<MascotState> {
    const currentState = await this.getMascotState(childId);
    if (!currentState) {
      throw new Error('État de la mascotte introuvable');
    }

    const newXp = currentState.xp + xpGained;
    const newLevel = this.calculateLevel(newXp);
    const newEvolutionStage = this.calculateEvolutionStage(newLevel);

    const { data, error } = await this.supabase.client
      .from('frontend_child_mascot_state')
      .update({
        xp: newXp,
        level: newLevel,
        evolution_stage: newEvolutionStage,
        last_xp_gain_at: new Date().toISOString(),
      })
      .eq('child_id', childId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de la mise à jour de la mascotte: ${error.message}`);
    }

    return data;
  }

  /**
   * Calcule le stage d'évolution selon le niveau
   */
  calculateEvolutionStage(level: number): number {
    if (level >= 20) return 5;
    if (level >= 15) return 4;
    if (level >= 10) return 3;
    if (level >= 5) return 2;
    return 1;
  }

  /**
   * Calcule l'XP gagnée après un jeu réussi
   */
  calculateXpGain(score: number, maxScore: number, success: boolean): number {
    if (!success) return 0;

    const scoreRatio = score / maxScore;
    // Base XP: 10 points
    // Bonus selon le score: jusqu'à 20 points supplémentaires
    return Math.round(10 + scoreRatio * 20);
  }

  /**
   * Met à jour l'apparence de la mascotte
   */
  async updateAppearance(
    childId: string,
    appearance: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from('frontend_child_mascot_state')
      .update({
        current_appearance_json: appearance,
      })
      .eq('child_id', childId);

    if (error) {
      throw new Error(`Erreur lors de la mise à jour de l'apparence: ${error.message}`);
    }
  }
}

