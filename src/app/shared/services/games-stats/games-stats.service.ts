import { Injectable, inject, signal } from '@angular/core';
import { Infrastructure } from '../../../features/teacher/components/infrastructure/infrastructure';

export interface GamesStats {
  stats: Record<string, number>;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class GamesStatsService {
  private readonly infrastructure = inject(Infrastructure);
  
  // Store global des stats par subject_id
  private readonly statsCache = signal<Record<string, GamesStats>>({});
  
  // Store global des stats par category_id (clé: "category:{categoryId}")
  private readonly categoryStatsCache = signal<Record<string, GamesStats>>({});
  
  // Constante pour le préfixe des clés de cache de catégories
  private static readonly CATEGORY_CACHE_PREFIX = 'category:';
  
  /**
   * Charge les stats de jeux pour plusieurs matières en batch (optimisation - une seule requête)
   * @param skipAssignmentCheck - Si true, skip la vérification d'assignments (optimisation quand on sait qu'ils existent)
   */
  loadStatsForSubjects(subjectIds: string[], skipAssignmentCheck = false): void {
    if (subjectIds.length === 0) {
      this.statsCache.set({});
      return;
    }

    // Filtrer les IDs qui ne sont pas déjà en cache
    const cachedIds = new Set(Object.keys(this.statsCache()));
    const idsToLoad = subjectIds.filter(id => !cachedIds.has(id));

    if (idsToLoad.length === 0) {
      // Toutes les stats sont déjà en cache
      return;
    }

    // Utiliser la méthode batch pour charger toutes les stats en une seule requête
    this.infrastructure.getGamesStatsBySubjectsBatch(idsToLoad, skipAssignmentCheck).subscribe({
      next: ({ statsBySubject, error }) => {
        if (error) {
          console.error('Erreur lors du chargement des stats de jeux en batch:', error);
          return;
        }

        const currentStats = this.statsCache();
        const newStats: Record<string, GamesStats> = { ...currentStats };
        
        // Mettre à jour le cache avec les stats de chaque matière
        statsBySubject.forEach((statsData, subjectId) => {
          newStats[subjectId] = {
            stats: statsData.stats,
            total: statsData.total
          };
        });

        this.statsCache.set(newStats);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des stats de jeux en batch:', error);
      }
    });
  }

  /**
   * Récupère les stats pour une matière
   */
  getStats(subjectId: string): GamesStats | null {
    return this.statsCache()[subjectId] || null;
  }

  /**
   * Formate les stats pour l'affichage
   */
  formatStats(subjectId: string): string {
    const stats = this.getStats(subjectId);
    if (!stats || stats.total === 0) {
      return '';
    }

    // Formater : "qcm (2) • liens (2) • Memory (2)"
    const formattedTypes = Object.entries(stats.stats)
      .map(([type, count]) => `${type.toLowerCase()} (${count})`)
      .join(' • ');

    return `${stats.total} jeu${stats.total > 1 ? 'x' : ''} : ${formattedTypes}`;
  }

  /**
   * Charge les stats de jeux pour plusieurs catégories en batch (optimisation - une seule requête)
   */
  loadStatsForCategories(categoryIds: string[]): void {
    if (categoryIds.length === 0) {
      return;
    }

    // Filtrer les IDs qui ne sont pas déjà en cache
    const cachedKeys = new Set(Object.keys(this.categoryStatsCache()));
    const idsToLoad = categoryIds.filter(id => {
      const cacheKey = `${GamesStatsService.CATEGORY_CACHE_PREFIX}${id}`;
      return !cachedKeys.has(cacheKey);
    });

    if (idsToLoad.length === 0) {
      // Toutes les stats sont déjà en cache
      return;
    }

    // Utiliser la méthode batch pour charger toutes les stats en une seule requête
    this.infrastructure.getGamesStatsByCategoriesBatch(idsToLoad).subscribe({
      next: ({ statsByCategory, error }) => {
        if (error) {
          console.error('Erreur lors du chargement des stats de jeux par catégorie en batch:', error);
          return;
        }

        const currentStats = this.categoryStatsCache();
        const newStats: Record<string, GamesStats> = { ...currentStats };
        
        // Mettre à jour le cache avec les stats de chaque catégorie
        statsByCategory.forEach((statsData, categoryId) => {
          const cacheKey = `${GamesStatsService.CATEGORY_CACHE_PREFIX}${categoryId}`;
          newStats[cacheKey] = {
            stats: statsData.stats,
            total: statsData.total
          };
        });

        this.categoryStatsCache.set(newStats);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des stats de jeux par catégorie en batch:', error);
      }
    });
  }

  /**
   * Récupère les stats pour une catégorie
   */
  getCategoryStats(categoryId: string): GamesStats | null {
    const cacheKey = `${GamesStatsService.CATEGORY_CACHE_PREFIX}${categoryId}`;
    return this.categoryStatsCache()[cacheKey] || null;
  }

  /**
   * Formate les stats pour l'affichage d'une catégorie
   */
  formatCategoryStats(categoryId: string): string {
    const stats = this.getCategoryStats(categoryId);
    if (!stats || stats.total === 0) {
      return '';
    }

    // Formater : "qcm (2) • liens (2) • Memory (2)"
    const formattedTypes = Object.entries(stats.stats)
      .map(([type, count]) => `${type.toLowerCase()} (${count})`)
      .join(' • ');

    return `${stats.total} jeu${stats.total > 1 ? 'x' : ''} : ${formattedTypes}`;
  }

  /**
   * Efface le cache des matières
   */
  clearCache(): void {
    this.statsCache.set({});
  }

  /**
   * Efface le cache des catégories
   */
  clearCategoryCache(): void {
    this.categoryStatsCache.set({});
  }

  /**
   * Efface tous les caches
   */
  clearAllCaches(): void {
    this.clearCache();
    this.clearCategoryCache();
  }
}

