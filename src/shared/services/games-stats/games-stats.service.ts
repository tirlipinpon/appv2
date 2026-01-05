import { Injectable, inject } from '@angular/core';
import { GamesStatsStore } from '../../store/games-stats.store';
import { Observable } from 'rxjs';

export interface GameStatsData {
  stats: Record<string, number>;
  total: number;
}

/**
 * Service partagé pour accéder aux statistiques de jeux
 * Utilise GamesStatsStore avec cache intelligent
 * Utilisable par frontend et admin
 */
@Injectable({
  providedIn: 'root',
})
export class GamesStatsService {
  private readonly store = inject(GamesStatsStore);
  
  /**
   * Expose statsByKey pour permettre aux computed de lire directement avec untracked()
   * Cela évite les boucles infinies causées par l'appel à getStats depuis un computed
   */
  get statsByKey() {
    return this.store.statsByKey;
  }

  /**
   * Récupère les stats pour une matière
   * @param subjectId - ID de la matière
   * @param childId - ID de l'enfant (optionnel, pour frontend)
   * @returns Les stats ou null si non disponibles
   */
  getStatsForSubject(subjectId: string, childId?: string | null): GameStatsData | null {
    const key = this.store.getSubjectKey(childId, subjectId);
    const cached = this.store.getStats(key);
    if (cached) {
      return {
        stats: cached.stats,
        total: cached.total,
      };
    }
    return null;
  }

  /**
   * Récupère les stats pour une catégorie/sous-matière
   * @param categoryId - ID de la catégorie
   * @param childId - ID de l'enfant (optionnel, pour frontend)
   * @returns Les stats ou null si non disponibles
   */
  getStatsForCategory(categoryId: string, childId?: string | null): GameStatsData | null {
    const key = this.store.getCategoryKey(childId, categoryId);
    const cached = this.store.getStats(key);
    if (cached) {
      return {
        stats: cached.stats,
        total: cached.total,
      };
    }
    return null;
  }

  /**
   * Charge les stats pour une matière (si pas en cache)
   * @param subjectId - ID de la matière
   * @param childId - ID de l'enfant (optionnel)
   * @param loader - Fonction qui retourne un Observable avec les stats
   */
  loadStatsForSubject(
    subjectId: string,
    loader: () => Observable<{ stats: Record<string, number>; total: number; error: unknown | null }>,
    childId?: string | null
  ): void {
    this.store.loadStatsForSubject({ subjectId, childId, loader });
  }

  /**
   * Charge les stats pour une catégorie (si pas en cache)
   * @param categoryId - ID de la catégorie
   * @param childId - ID de l'enfant (optionnel)
   * @param loader - Fonction qui retourne un Observable avec les stats
   */
  loadStatsForCategory(
    categoryId: string,
    loader: () => Observable<{ stats: Record<string, number>; total: number; error: unknown | null }>,
    childId?: string | null
  ): void {
    this.store.loadStatsForCategory({ categoryId, childId, loader });
  }

  /**
   * Précharge les stats pour plusieurs matières et catégories en batch
   * @param subjectIds - IDs des matières à précharger
   * @param categoryIds - IDs des catégories à précharger
   * @param childId - ID de l'enfant (optionnel)
   * @param loaders - Objet avec les fonctions loader pour chaque type
   */
  preloadStats(
    subjectIds: string[],
    categoryIds: string[],
    loaders: {
      subjectLoader: (subjectId: string) => Observable<{ stats: Record<string, number>; total: number; error: unknown | null }>;
      categoryLoader: (categoryId: string) => Observable<{ stats: Record<string, number>; total: number; error: unknown | null }>;
    },
    childId?: string | null
  ): void {
    const requests = [
      ...subjectIds.map((id) => ({
        type: 'subject' as const,
        id,
        childId,
        loader: () => loaders.subjectLoader(id),
      })),
      ...categoryIds.map((id) => ({
        type: 'category' as const,
        id,
        childId,
        loader: () => loaders.categoryLoader(id),
      })),
    ];

    if (requests.length > 0) {
      this.store.loadStatsBatch({ requests });
    }
  }

  /**
   * Formate les stats pour l'affichage
   * Format: "🎮 25 jeux : memory (1) • click (18) • qcm (2) • case vide (2) • chronologie (1) • liens (1)"
   * @param stats - Les stats à formater
   * @returns La chaîne formatée ou une chaîne vide si pas de stats
   */
  formatStats(stats: GameStatsData | null): string {
    if (!stats || stats.total === 0) {
      return '';
    }

    // Mapper les noms de types de jeux pour l'affichage
    const typeNameMap: Record<string, string> = {
      'memory': 'memory',
      'Memory': 'memory',
      'click': 'click',
      'Click': 'click',
      'image_interactive': 'click',
      'Image Interactive': 'click',
      'qcm': 'qcm',
      'QCM': 'qcm',
      'case vide': 'case vide',
      'Case Vide': 'case vide',
      'chronologie': 'chronologie',
      'Chronologie': 'chronologie',
      'liens': 'liens',
      'Liens': 'liens',
    };

    const formattedTypes = Object.entries(stats.stats)
      .map(([type, count]) => {
        const displayName = typeNameMap[type] || type.toLowerCase();
        return `${displayName} (${count})`;
      })
      .join(' • ');

    return `🎮 ${stats.total} jeu${stats.total > 1 ? 'x' : ''} : ${formattedTypes}`;
  }

  /**
   * Invalide le cache pour une matière
   */
  invalidateSubjectCache(subjectId: string, childId?: string | null): void {
    this.store.invalidateCacheForSubject(subjectId, childId);
  }

  /**
   * Invalide le cache pour une catégorie
   */
  invalidateCategoryCache(categoryId: string, childId?: string | null): void {
    this.store.invalidateCacheForCategory(categoryId, childId);
  }

  /**
   * Invalide le cache pour un enfant (frontend)
   */
  invalidateChildCache(childId: string): void {
    this.store.invalidateCacheForChild(childId);
  }

  /**
   * Vide tout le cache
   */
  clearCache(): void {
    this.store.clearCache();
  }
}
