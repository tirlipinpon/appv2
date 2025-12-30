import { Injectable, inject } from '@angular/core';
import { GamesStore } from '../../../features/teacher/store/games.store';

export interface GameStats {
  stats: Record<string, number>;
  total: number;
}

/**
 * Service pour accéder aux statistiques de jeux depuis GamesStore
 * Fournit une interface simple pour les composants qui ont besoin des stats
 */
@Injectable({
  providedIn: 'root',
})
export class GamesStatsService {
  private readonly gamesStore = inject(GamesStore);

  /**
   * Charge les stats pour plusieurs matières
   */
  loadStatsForSubjects(subjectIds: string[], skipAssignmentCheck = false): void {
    this.gamesStore.loadStatsBySubjectsBatch({ subjectIds, skipAssignmentCheck });
  }

  /**
   * Charge les stats pour plusieurs catégories
   */
  loadStatsForCategories(categoryIds: string[]): void {
    this.gamesStore.loadStatsByCategoriesBatch(categoryIds);
  }

  /**
   * Récupère les stats pour une matière
   */
  getStats(subjectId: string): GameStats | null {
    const statsBySubject = this.gamesStore.statsBySubject();
    const stats = statsBySubject[subjectId];
    return stats || null;
  }

  /**
   * Récupère les stats pour une catégorie
   */
  getCategoryStats(categoryId: string): GameStats | null {
    const statsByCategory = this.gamesStore.statsByCategory();
    const stats = statsByCategory[categoryId];
    return stats || null;
  }

  /**
   * Efface le cache des stats
   */
  clearStatsCache(): void {
    this.gamesStore.clearStatsCache();
  }
}

