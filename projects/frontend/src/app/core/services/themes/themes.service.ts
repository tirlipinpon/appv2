import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { Theme, ChildTheme } from '../../types/game.types';

@Injectable({
  providedIn: 'root',
})
export class ThemesService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Récupère tous les thèmes disponibles selon le niveau scolaire
   */
  async getAvailableThemes(schoolLevel: string | null): Promise<Theme[]> {
    let query = this.supabase.client
      .from('frontend_themes')
      .select('*')
      .eq('is_active', true);

    // Filtrer par niveau scolaire si spécifié et valide
    if (schoolLevel) {
      const level = parseInt(schoolLevel, 10);
      // Vérifier que le niveau est un nombre valide
      if (!isNaN(level) && level > 0) {
        query = query.or(
          `school_level_min.is.null,school_level_min.lte.${level},school_level_max.is.null,school_level_max.gte.${level}`
        );
      }
    }

    const { data, error } = await query.order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Erreur lors de la récupération des thèmes: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Récupère les thèmes débloqués par un enfant
   */
  async getUnlockedThemes(childId: string): Promise<ChildTheme[]> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_themes')
      .select('*')
      .eq('child_id', childId)
      .order('unlocked_at', { ascending: false });

    if (error) {
      throw new Error(`Erreur lors de la récupération des thèmes débloqués: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Récupère le thème sélectionné par un enfant
   */
  async getSelectedTheme(childId: string): Promise<ChildTheme | null> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_themes')
      .select('*')
      .eq('child_id', childId)
      .eq('is_selected', true)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle no results gracefully

    if (error) {
      console.error('Erreur lors de la récupération du thème sélectionné:', error);
      return null;
    }

    return data;
  }

  /**
   * Débloque un thème pour un enfant
   */
  async unlockTheme(childId: string, themeId: string): Promise<ChildTheme> {
    const { data, error } = await this.supabase.client
      .from('frontend_child_themes')
      .insert({
        child_id: childId,
        theme_id: themeId,
        is_selected: false,
        unlocked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors du déblocage du thème: ${error.message}`);
    }

    return data;
  }

  /**
   * Sélectionne un thème pour un enfant
   */
  async selectTheme(childId: string, themeId: string): Promise<void> {
    // Désélectionner tous les autres thèmes
    await this.supabase.client
      .from('frontend_child_themes')
      .update({ is_selected: false })
      .eq('child_id', childId)
      .eq('is_selected', true);

    // Vérifier si le thème est déjà débloqué
    const { data: existing } = await this.supabase.client
      .from('frontend_child_themes')
      .select('id')
      .eq('child_id', childId)
      .eq('theme_id', themeId)
      .single();

    if (existing) {
      // Mettre à jour
      const { error } = await this.supabase.client
        .from('frontend_child_themes')
        .update({ is_selected: true })
        .eq('id', existing.id);

      if (error) {
        throw new Error(`Erreur lors de la sélection du thème: ${error.message}`);
      }
    } else {
      // Créer et sélectionner
      const { error } = await this.supabase.client
        .from('frontend_child_themes')
        .insert({
          child_id: childId,
          theme_id: themeId,
          is_selected: true,
          unlocked_at: new Date().toISOString(),
        });

      if (error) {
        throw new Error(`Erreur lors de la sélection du thème: ${error.message}`);
      }
    }
  }

  /**
   * Vérifie les conditions de déblocage d'un thème
   */
  async checkUnlockCondition(childId: string, theme: Theme): Promise<boolean> {
    // Thèmes par défaut sont toujours disponibles
    if (theme.is_default) {
      return true;
    }

    if (!theme.unlock_condition_json) {
      return false;
    }

    const condition = theme.unlock_condition_json;

    // Condition: par niveau (min_stars)
    if (condition['type'] === 'by_level' && condition['min_stars']) {
      const { data: stats } = await this.supabase.client
        .rpc('get_frontend_child_statistics', { p_child_id: childId })
        .single();

      if (!stats || typeof stats !== 'object') {
        return false;
      }

      const statsObj = stats as { total_stars?: number };
      return (statsObj.total_stars ?? 0) >= (condition['min_stars'] as number);
    }

    return false;
  }
}

