import { Injectable } from '@angular/core';
import { BadgeType } from '../../types/badge.types';

export interface BadgeDesign {
  shape: string;
  color: string;
  icon: string;
  size: number;
}

@Injectable({
  providedIn: 'root',
})
export class BadgeDesignService {
  // Palette de couleurs par type de badge avec progression par niveau
  private readonly COLOR_PALETTES: Record<
    string,
    { base: string; levels: string[] }
  > = {
    perfect_games_count: {
      base: '#4ECDC4',
      levels: ['#4ECDC4', '#3DA39C', '#2E7A75', '#1F5250', '#0F2A29'],
    },
    daily_streak_responses: {
      base: '#95E1D3',
      levels: ['#95E1D3', '#7BC4B5', '#5FA798', '#438A7B', '#276D5E'],
    },
    consecutive_correct: {
      base: '#54A0FF',
      levels: ['#54A0FF', '#4280CC', '#306099', '#1E4066', '#0C2033'],
    },
    first_category_complete: {
      base: '#FFD700',
      levels: ['#FFD700'],
    },
    first_subject_complete: {
      base: '#FF6B6B',
      levels: ['#FF6B6B'],
    },
    first_game_perfect: {
      base: '#4ECDC4',
      levels: ['#4ECDC4'],
    },
    consecutive_game_days: {
      base: '#4CAF50',
      levels: ['#4CAF50', '#3E8E41', '#2E6B32', '#1F4A23', '#0F2914'],
    },
    daily_activity: {
      base: '#FF6B6B',
      levels: ['#FF6B6B', '#E55555', '#CC4040', '#B32B2B', '#991616'],
    },
  };

  // Icônes par type de badge
  private readonly BADGE_ICONS: Record<BadgeType, string> = {
    perfect_games_count: '🚀',
    daily_streak_responses: '🎯',
    consecutive_correct: '✨',
    first_category_complete: '🏆',
    first_subject_complete: '⭐',
    first_game_perfect: '💯',
    consecutive_game_days: '🔥',
    daily_activity: '🎯',
  };

  /**
   * Génère la configuration visuelle complète d'un badge
   */
  generateBadgeDesign(
    badgeType: BadgeType,
    level: number = 1,
    value?: number
  ): BadgeDesign {
    return {
      shape: this.getShapeForBadge(badgeType),
      color: this.getColorForLevel(badgeType, level),
      icon: this.getIconForBadge(badgeType),
      size: 120, // Taille par défaut
    };
  }

  /**
   * Calcule la couleur selon le niveau
   */
  getColorForLevel(badgeType: BadgeType, level: number): string {
    const palette = this.COLOR_PALETTES[badgeType];
    if (!palette) {
      return '#667eea'; // Couleur par défaut
    }

    // Pour les badges à un seul niveau, toujours retourner la couleur de base
    if (palette.levels.length === 1) {
      return palette.levels[0];
    }

    // Pour les badges avec progression, utiliser le niveau (max niveau 5)
    const levelIndex = Math.min(level - 1, palette.levels.length - 1);
    return palette.levels[levelIndex] || palette.base;
  }

  /**
   * Retourne la forme géométrique CSS selon le type de badge
   */
  getShapeForBadge(badgeType: BadgeType): string {
    const shapes: Record<BadgeType, string> = {
      perfect_games_count: 'star', // Étoile à 5 branches
      daily_streak_responses: 'circle', // Cercle avec bordure
      consecutive_correct: 'hexagon', // Hexagone
      first_category_complete: 'medal', // Médaille circulaire
      first_subject_complete: 'crown', // Couronne
      first_game_perfect: 'diamond', // Diamant
      consecutive_game_days: 'circle', // Cercle avec bordure
      daily_activity: 'medal', // Médaille circulaire
    };

    return shapes[badgeType] || 'circle';
  }

  /**
   * Retourne l'emoji ou icône selon le type de badge
   */
  getIconForBadge(badgeType: BadgeType): string {
    return this.BADGE_ICONS[badgeType] || '🏅';
  }

  /**
   * Calcule la couleur évolutive selon le niveau
   * Formule : Assombrissement progressif de 15% par niveau
   */
  calculateColorProgression(baseColor: string, level: number): string {
    // Convertir hex en RGB
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculer le facteur d'assombrissement (15% par niveau, max 60%)
    const darkenFactor = Math.min((level - 1) * 0.15, 0.6);

    // Appliquer l'assombrissement
    const newR = Math.floor(r * (1 - darkenFactor));
    const newG = Math.floor(g * (1 - darkenFactor));
    const newB = Math.floor(b * (1 - darkenFactor));

    // Convertir en hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }
}
