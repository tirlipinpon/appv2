import { Component, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GamesStatsService } from '../../services/games-stats/games-stats.service';

/**
 * Composant partagé pour afficher le compteur de jeux restants
 * Affiche "X/Y jeux restants" pour une matière ou une sous-matière
 * 
 * Pour une matière : compte tous les jeux directs + tous les jeux de ses sous-matières
 * Pour une sous-matière : compte les jeux de cette sous-matière
 */
@Component({
  selector: 'app-games-counter',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (counterText()) {
      <div class="games-counter">
        {{ counterText() }}
      </div>
    }
  `,
  styles: [`
    .games-counter {
      background: var(--theme-primary-color, #4CAF50);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      display: inline-block;
    }
  `]
})
export class GamesCounterComponent {
  private readonly gamesStatsService = inject(GamesStatsService);

  // Inputs optionnels : soit subjectId, soit categoryId
  readonly subjectId = input<string | null>(null);
  readonly categoryId = input<string | null>(null);
  readonly childId = input<string | null>(null);
  
  // Pour une matière : liste des IDs de sous-matières (optionnel)
  // Si fourni, le compteur additionnera les jeux directs + jeux des sous-matières
  readonly categoryIds = input<string[]>([]);

  // Inputs optionnels pour passer directement les valeurs calculées
  // Si fournis, ces valeurs sont utilisées au lieu de calculer depuis les stats
  readonly remaining = input<number | null>(null);
  readonly total = input<number | null>(null);

  // Texte du compteur calculé
  readonly counterText = computed(() => {
    // Si les valeurs sont directement fournies, les utiliser
    const remaining = this.remaining();
    const total = this.total();
    if (remaining !== null && total !== null && total > 0) {
      return `${remaining}/${total} jeux restants`;
    }

    const subjectId = this.subjectId();
    const categoryId = this.categoryId();
    const childId = this.childId();
    const categoryIds = this.categoryIds();

    // Si c'est une sous-matière
    if (categoryId) {
      const stats = this.gamesStatsService.getStatsForCategory(categoryId, childId);
      if (!stats || stats.total === 0) {
        return null;
      }
      
      // Pour l'instant, on affiche juste le total si on n'a pas les valeurs calculées
      return `${stats.total} jeu${stats.total > 1 ? 'x' : ''}`;
    }

    // Si c'est une matière
    if (subjectId) {
      // Compter les jeux directs de la matière
      const subjectStats = this.gamesStatsService.getStatsForSubject(subjectId, childId);
      let totalGames = subjectStats?.total || 0;

      // Ajouter les jeux des sous-matières si categoryIds est fourni
      if (categoryIds.length > 0) {
        for (const catId of categoryIds) {
          const catStats = this.gamesStatsService.getStatsForCategory(catId, childId);
          if (catStats) {
            totalGames += catStats.total;
          }
        }
      }

      if (totalGames === 0) {
        return null;
      }

      return `${totalGames} jeu${totalGames > 1 ? 'x' : ''}`;
    }

    return null;
  });
}
