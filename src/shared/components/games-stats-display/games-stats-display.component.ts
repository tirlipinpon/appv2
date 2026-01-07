import { Component, input, inject, computed, effect, ChangeDetectionStrategy, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GamesStatsService } from '../../services/games-stats/games-stats.service';
import { GamesStatsStore } from '../../store/games-stats.store';
import { GameTypeStyleService } from '../../services/game-type-style/game-type-style.service';

/**
 * Composant réutilisable pour afficher les statistiques de jeux
 * Format: "🎮 25 jeux : memory (1) • click (18) • qcm (2)..."
 * 
 * Utilisable dans frontend et admin
 * - Frontend: détecte automatiquement l'enfant courant
 * - Admin: peut passer childId explicitement ou laisser null
 * 
 * Note: Le composant parent doit charger les stats via GamesStatsService
 * avant d'afficher ce composant, ou passer un loader via les inputs.
 */
@Component({
  selector: 'app-games-stats-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (formattedTypeStats(); as typeStats) {
      <div class="games-stats">
        <span class="games-icon">🎮</span>
        <span class="games-total">{{ typeStats.total }} jeu{{ typeStats.total > 1 ? 'x' : '' }} :</span>
        <span class="games-types">
          @for (typeStat of typeStats.types; track typeStat.type) {
            <span class="game-type-badge" [style.color]="typeStat.colorCode">
              <span class="game-type-icon">{{ typeStat.icon }}</span>
              <span class="game-type-name">{{ typeStat.name }} ({{ typeStat.count }})</span>
            </span>
          }
        </span>
      </div>
    }
  `,
  styles: [`
    .games-stats {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      font-size: 0.875rem;
      color: #555;
      font-weight: 500;
      flex-wrap: wrap;
    }
    .games-icon {
      font-size: 1rem;
      flex-shrink: 0;
    }
    .games-total {
      flex-shrink: 0;
    }
    .games-types {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .game-type-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .game-type-icon {
      font-size: 0.875rem;
      line-height: 1;
    }
    .game-type-name {
      font-size: 0.875rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GamesStatsDisplayComponent {
  subjectId = input<string | null>(null);
  categoryId = input<string | null>(null);
  childId = input<string | null>(null);
  showEmpty = input(false);
  
  private readonly gamesStatsService = inject(GamesStatsService);
  private readonly store = inject(GamesStatsStore);
  private readonly gameTypeStyleService = inject(GameTypeStyleService);
  private readonly loadingKeys = new Set<string>();

  // Computed key - source unique de vérité
  private readonly statsKey = computed(() => {
    const subjectId = this.subjectId();
    const categoryId = this.categoryId();
    const childId = this.childId();
    
    if (categoryId != null) {
      return childId ? `${childId}:category:${categoryId}` : `category:${categoryId}`;
    }
    if (subjectId) {
      return childId ? `${childId}:subject:${subjectId}` : `subject:${subjectId}`;
    }
    return null;
  });

  constructor() {
    // Un seul effet pour gérer le chargement
    effect(() => {
      const key = this.statsKey();
      if (!key) return;

      // ✅ SANS untracked() - maintenant l'effect se redéclenche quand statsByKey change
      const statsByKey = this.store.statsByKey();
      const cached = statsByKey[key];
      const DEFAULT_TTL = 5 * 60 * 1000;
      const now = Date.now();
      
      const needsLoading = !cached || (cached && (now - cached.timestamp >= DEFAULT_TTL));
      const notLoading = !this.loadingKeys.has(key);
      
      if (needsLoading && notLoading) {
        this.loadingKeys.add(key);
        
        // Charger les stats
        const subjectId = this.subjectId();
        const categoryId = this.categoryId();
        const service = this.gamesStatsService as any;
        
        if (categoryId != null && typeof service.loadStatsForCategories === 'function') {
          service.loadStatsForCategories([categoryId]);
        } else if (subjectId && typeof service.loadStatsForSubjects === 'function') {
          service.loadStatsForSubjects([subjectId]);
        }
        
        setTimeout(() => {
          this.loadingKeys.delete(key);
        }, 2000);
      }
    });
  }

  readonly formattedStats = computed(() => {
    const key = this.statsKey();
    if (!key) {
      return this.showEmpty() ? '🎮 0 jeu' : '';
    }

    // Lire le store de manière RÉACTIVE pour que le computed se mette à jour
    // quand les stats arrivent dans le store
    const statsByKey = this.store.statsByKey();
    const cached = statsByKey[key];
    
    if (!cached) {
      return this.showEmpty() ? '🎮 0 jeu' : '';
    }
    
    // Vérifier si le cache n'a pas expiré (TTL: 5 minutes)
    const now = Date.now();
    const DEFAULT_TTL = 5 * 60 * 1000;
    if (now - cached.timestamp >= DEFAULT_TTL) {
      return this.showEmpty() ? '🎮 0 jeu' : '';
    }
    
    if (cached.total === 0 && !this.showEmpty()) {
      return '';
    }
    
    return this.gamesStatsService.formatStats({
      stats: cached.stats,
      total: cached.total,
    });
  });

  readonly formattedTypeStats = computed(() => {
    const key = this.statsKey();
    if (!key) {
      if (this.showEmpty()) {
        return { total: 0, types: [] };
      }
      return null;
    }

    // Lire le store de manière RÉACTIVE pour que le computed se mette à jour
    // quand les stats arrivent dans le store
    const statsByKey = this.store.statsByKey();
    const cached = statsByKey[key];
    
    if (!cached) {
      if (this.showEmpty()) {
        return { total: 0, types: [] };
      }
      return null;
    }
    
    const now = Date.now();
    const DEFAULT_TTL = 5 * 60 * 1000;
    if (now - cached.timestamp >= DEFAULT_TTL) {
      if (this.showEmpty()) {
        return { total: 0, types: [] };
      }
      return null;
    }
    
    if (cached.total === 0 && !this.showEmpty()) {
      return null;
    }

    // Formater les stats avec les icônes et couleurs
    const types = Object.entries(cached.stats).map(([type, count]) => {
      const style = this.gameTypeStyleService.getGameTypeStyleSync(type);
      return {
        type,
        name: type,
        count,
        icon: style.icon,
        colorCode: style.colorCode,
      };
    });

    return {
      total: cached.total,
      types,
    };
  });
}
