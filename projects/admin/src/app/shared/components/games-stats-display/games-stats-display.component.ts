import { Component, Input, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
// import { GamesStatsService } from '../../services/games-stats/games-stats.service'; // Service déplacé vers admin

@Component({
  selector: 'app-games-stats-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="formattedStats()" class="games-stats">
      <span class="games-icon">🎮</span>
      <span class="games-text">{{ formattedStats() }}</span>
    </div>
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
    }
    .games-icon {
      font-size: 1rem;
      flex-shrink: 0;
    }
    .games-text {
      flex: 1;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GamesStatsDisplayComponent {
  @Input() subjectId?: string;
  @Input() categoryId?: string;
  
  // private readonly gamesStatsService = inject(GamesStatsService); // Service déplacé vers admin

  readonly formattedStats = computed(() => {
    // Note: Ce composant nécessite GamesStatsService qui doit être fourni depuis admin
    // Priorité à la catégorie si fournie
    // if (this.categoryId) {
    //   return this.gamesStatsService.formatCategoryStats(this.categoryId);
    // }
    // if (this.subjectId) {
    //   return this.gamesStatsService.formatStats(this.subjectId);
    // }
    return '';
  });
}

