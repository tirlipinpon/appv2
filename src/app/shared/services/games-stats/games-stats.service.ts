import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
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
   * Charge les stats de jeux pour plusieurs matières en parallèle
   */
  loadStatsForSubjects(subjectIds: string[]): void {
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

    // Créer un tableau d'observables pour charger les stats
    const statsObservables = idsToLoad.map(subjectId =>
      this.infrastructure.getGamesStatsBySubject(subjectId)
    );

    // Charger toutes les stats en parallèle
    forkJoin(statsObservables).subscribe({
      next: (results) => {
        const currentStats = this.statsCache();
        const newStats: Record<string, GamesStats> = { ...currentStats };
        
        idsToLoad.forEach((subjectId, index) => {
          const result = results[index];
          if (!result.error && result.total > 0) {
            newStats[subjectId] = {
              stats: result.stats,
              total: result.total
            };
          } else if (!result.error) {
            // Mettre en cache même si total = 0 pour éviter de recharger
            newStats[subjectId] = {
              stats: {},
              total: 0
            };
          }
        });

        this.statsCache.set(newStats);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des stats de jeux:', error);
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

    return `🎮 ${stats.total} jeu${stats.total > 1 ? 'x' : ''} : ${formattedTypes}`;
  }

  /**
   * Charge les stats de jeux pour plusieurs catégories en parallèle
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

    // Créer un tableau d'observables pour charger les stats
    // On utilise un subjectId vide car on charge uniquement par categoryId
    const statsObservables = idsToLoad.map(categoryId =>
      this.infrastructure.getGamesStatsBySubject('', categoryId)
    );

    // Charger toutes les stats en parallèle
    forkJoin(statsObservables).subscribe({
      next: (results) => {
        const currentStats = this.categoryStatsCache();
        const newStats: Record<string, GamesStats> = { ...currentStats };
        
        idsToLoad.forEach((categoryId, index) => {
          const result = results[index];
          const cacheKey = `${GamesStatsService.CATEGORY_CACHE_PREFIX}${categoryId}`;
          
          if (!result.error && result.total > 0) {
            newStats[cacheKey] = {
              stats: result.stats,
              total: result.total
            };
          } else if (!result.error) {
            // Mettre en cache même si total = 0 pour éviter de recharger
            newStats[cacheKey] = {
              stats: {},
              total: 0
            };
          }
        });

        this.categoryStatsCache.set(newStats);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des stats de jeux par catégorie:', error);
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

    return `🎮 ${stats.total} jeu${stats.total > 1 ? 'x' : ''} : ${formattedTypes}`;
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

