import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { normalizeGameTypeName } from '../../../features/teacher/utils/game-type.util';
import {
  getGameTypeVariations,
  GAME_TYPE_QCM,
  GAME_TYPE_MEMORY,
  GAME_TYPE_CHRONOLOGIE,
  GAME_TYPE_SIMON,
  GAME_TYPE_IMAGE_INTERACTIVE,
  GAME_TYPE_REPONSE_LIBRE,
  GAME_TYPE_VRAI_FAUX,
  GAME_TYPE_LIENS,
  GAME_TYPE_CASE_VIDE,
} from '@shared/utils/game-type.constants';

export interface GameTypeStyle {
  icon: string;
  colorCode: string;
}

interface GameTypeFromDB {
  id: string;
  name: string;
  icon: string | null;
  color_code: string | null;
}

/**
 * Service pour récupérer les styles (icône et couleur) des types de jeux depuis la DB
 * Avec fallback vers les valeurs codées en dur si non trouvé en DB
 */
@Injectable({
  providedIn: 'root',
})
export class GameTypeStyleService {
  private readonly supabase = inject(SupabaseService);
  private readonly gameTypesCache = signal<Map<string, GameTypeStyle>>(new Map());
  private loadingPromise: Promise<void> | null = null;

  /**
   * Récupère le style (icône et couleur) pour un type de jeu
   * @param gameTypeName - Nom du type de jeu (peut être normalisé ou non)
   * @returns Style avec icon et colorCode
   */
  async getGameTypeStyle(gameTypeName: string | undefined): Promise<GameTypeStyle> {
    if (!gameTypeName) {
      return this.getDefaultStyle();
    }

    // Charger les types depuis la DB si pas encore chargés
    if (this.gameTypesCache().size === 0 && !this.loadingPromise) {
      this.loadingPromise = this.loadGameTypesFromDB();
    }

    if (this.loadingPromise) {
      await this.loadingPromise;
    }

    // Normaliser le nom du type
    const normalizedType = normalizeGameTypeName(gameTypeName);

    // Chercher dans le cache
    const cached = this.gameTypesCache().get(normalizedType);
    if (cached) {
      return cached;
    }

    // Chercher avec les variations
    for (const [cachedName, style] of this.gameTypesCache().entries()) {
      const variations = getGameTypeVariations(cachedName);
      if (variations.some(v => normalizeGameTypeName(v) === normalizedType)) {
        return style;
      }
    }

    // Fallback vers les valeurs codées en dur
    return this.getFallbackStyle(gameTypeName);
  }

  /**
   * Récupère le style de manière synchrone (utilise le cache)
   * Retourne le fallback si pas encore chargé
   */
  getGameTypeStyleSync(gameTypeName: string | undefined): GameTypeStyle {
    if (!gameTypeName) {
      return this.getDefaultStyle();
    }

    const normalizedType = normalizeGameTypeName(gameTypeName);
    const cached = this.gameTypesCache().get(normalizedType);
    if (cached) {
      return cached;
    }

    // Chercher avec les variations
    for (const [cachedName, style] of this.gameTypesCache().entries()) {
      const variations = getGameTypeVariations(cachedName);
      if (variations.some(v => normalizeGameTypeName(v) === normalizedType)) {
        return style;
      }
    }

    // Fallback vers les valeurs codées en dur
    return this.getFallbackStyle(gameTypeName);
  }

  /**
   * Charge les types de jeux depuis la DB
   */
  private async loadGameTypesFromDB(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client
        .from('game_types')
        .select('id, name, icon, color_code')
        .order('name');

      if (error) {
        console.error('Erreur lors du chargement des types de jeux:', error);
        return;
      }

      const cache = new Map<string, GameTypeStyle>();
      const gameTypes = (data || []) as GameTypeFromDB[];

      for (const gameType of gameTypes) {
        if (gameType.icon && gameType.color_code) {
          const normalizedName = normalizeGameTypeName(gameType.name);
          cache.set(normalizedName, {
            icon: gameType.icon,
            colorCode: gameType.color_code,
          });
        }
      }

      this.gameTypesCache.set(cache);
    } catch (error) {
      console.error('Erreur lors du chargement des types de jeux:', error);
    } finally {
      this.loadingPromise = null;
    }
  }

  /**
   * Retourne le style par défaut
   */
  private getDefaultStyle(): GameTypeStyle {
    return { icon: '❓', colorCode: '#666' };
  }

  /**
   * Retourne le style de fallback basé sur les valeurs codées en dur
   */
  private getFallbackStyle(gameTypeName: string): GameTypeStyle {
    const normalizedType = normalizeGameTypeName(gameTypeName);

    const fallbackStyles: Record<string, GameTypeStyle> = {
      [normalizeGameTypeName(GAME_TYPE_QCM)]: { icon: '📝', colorCode: '#2196f3' },
      [normalizeGameTypeName(GAME_TYPE_MEMORY)]: { icon: '🧠', colorCode: '#ff5722' },
      [normalizeGameTypeName(GAME_TYPE_CHRONOLOGIE)]: { icon: '⏱️', colorCode: '#00bcd4' },
      [normalizeGameTypeName(GAME_TYPE_SIMON)]: { icon: '🎮', colorCode: '#9e9e9e' },
      [normalizeGameTypeName(GAME_TYPE_IMAGE_INTERACTIVE)]: { icon: '🖼️', colorCode: '#c2185b' },
      [normalizeGameTypeName(GAME_TYPE_REPONSE_LIBRE)]: { icon: '✍️', colorCode: '#4caf50' },
      [normalizeGameTypeName(GAME_TYPE_VRAI_FAUX)]: { icon: '✓✗', colorCode: '#f44336' },
      [normalizeGameTypeName(GAME_TYPE_LIENS)]: { icon: '🔗', colorCode: '#ff9800' },
      [normalizeGameTypeName(GAME_TYPE_CASE_VIDE)]: { icon: '📋', colorCode: '#9c27b0' },
    };

    // Chercher dans les constantes
    for (const [constantType, style] of Object.entries(fallbackStyles)) {
      if (normalizedType === constantType) {
        return style;
      }
      const variations = getGameTypeVariations(constantType);
      if (variations.some(v => normalizeGameTypeName(v) === normalizedType)) {
        return style;
      }
    }

    // Vérifier aussi 'click' qui est une variation de image_interactive
    if (normalizedType === normalizeGameTypeName('click')) {
      return fallbackStyles[normalizeGameTypeName(GAME_TYPE_IMAGE_INTERACTIVE)];
    }

    return this.getDefaultStyle();
  }
}
