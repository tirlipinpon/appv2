import { inject, Injectable } from '@angular/core';
import { BadgesService } from '../../../../core/services/badges/badges.service';
import { Badge, ChildBadge, BadgeLevel, NewlyUnlockedBadge } from '../../../../core/types/badge.types';

@Injectable({
  providedIn: 'root',
})
export class BadgesInfrastructure {
  private readonly badgesService = inject(BadgesService);

  /**
   * Charge tous les badges actifs
   */
  async loadAllBadges(): Promise<Badge[]> {
    try {
      return await this.badgesService.getAllBadges();
    } catch (error) {
      console.error('[BadgesInfrastructure] Erreur lors du chargement des badges:', error);
      throw error;
    }
  }

  /**
   * Charge les badges débloqués par un enfant
   */
  async loadChildBadges(childId: string): Promise<ChildBadge[]> {
    try {
      return await this.badgesService.getChildBadges(childId);
    } catch (error) {
      console.error(
        '[BadgesInfrastructure] Erreur lors du chargement des badges de l\'enfant:',
        error
      );
      throw error;
    }
  }

  /**
   * Vérifie les nouveaux badges débloqués après une tentative de jeu
   */
  async checkNewBadges(
    childId: string,
    gameAttemptId: string
  ): Promise<NewlyUnlockedBadge[]> {
    try {
      return await this.badgesService.getNewlyUnlockedBadges(childId, gameAttemptId);
    } catch (error) {
      console.error(
        '[BadgesInfrastructure] Erreur lors de la vérification des nouveaux badges:',
        error
      );
      throw error;
    }
  }

  /**
   * Charge les niveaux de badges pour un enfant
   */
  async loadBadgeLevels(childId: string): Promise<BadgeLevel[]> {
    try {
      return await this.badgesService.getAllBadgeLevels(childId);
    } catch (error) {
      console.error(
        '[BadgesInfrastructure] Erreur lors du chargement des niveaux de badges:',
        error
      );
      throw error;
    }
  }

  /**
   * Récupère le niveau d'un badge spécifique
   */
  async getBadgeLevel(childId: string, badgeType: string): Promise<BadgeLevel | null> {
    try {
      return await this.badgesService.getBadgeLevel(childId, badgeType);
    } catch (error) {
      console.error(
        '[BadgesInfrastructure] Erreur lors de la récupération du niveau du badge:',
        error
      );
      throw error;
    }
  }
}
