import { Injectable, inject } from '@angular/core';
import { GamesStatsService, GameStatsData } from '@shared/services/games-stats/games-stats.service';
import { Infrastructure } from '../../../features/teacher/components/infrastructure/infrastructure';

/**
 * Service wrapper pour admin qui étend GamesStatsService
 * et fournit les loaders depuis l'infrastructure admin
 */
@Injectable({
  providedIn: 'root',
})
export class GamesStatsWrapperService extends GamesStatsService {
  private readonly infrastructure = inject(Infrastructure);

  /**
   * Charge les stats pour plusieurs matières (compatibilité avec l'ancien code)
   */
  loadStatsForSubjects(subjectIds: string[], skipAssignmentCheck = false): void {
    this.preloadStats(
      subjectIds,
      [],
      {
        subjectLoader: (subjectId: string) =>
          this.infrastructure.getGamesStatsBySubject(subjectId, undefined, skipAssignmentCheck),
        categoryLoader: () => {
          throw new Error('Category loader not used');
        }
      }
    );
  }

  /**
   * Charge les stats pour plusieurs catégories (compatibilité avec l'ancien code)
   */
  loadStatsForCategories(categoryIds: string[]): void {
    this.preloadStats(
      [],
      categoryIds,
      {
        subjectLoader: () => {
          throw new Error('Subject loader not used');
        },
        categoryLoader: (categoryId: string) =>
          this.infrastructure.getGamesStatsByCategory(categoryId)
      }
    );
  }

  /**
   * Récupère les stats pour une matière (compatibilité avec l'ancien code)
   */
  getStats(subjectId: string): GameStatsData | null {
    return this.getStatsForSubject(subjectId);
  }

  /**
   * Récupère les stats pour une catégorie (compatibilité avec l'ancien code)
   */
  getCategoryStats(categoryId: string): GameStatsData | null {
    return this.getStatsForCategory(categoryId);
  }
}
