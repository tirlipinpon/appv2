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
   * Efface le cache
   */
  clearCache(): void {
    this.statsCache.set({});
  }
}

