import { Component, Input, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GamesStatsService } from '../../services/games-stats/games-stats.service';

@Component({
  selector: 'app-games-stats-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <p *ngIf="formattedStats()" class="games-stats">
      {{ formattedStats() }}
    </p>
  `,
  styles: [`
    .games-stats {
      margin: 8px 0 0 0;
      font-size: 0.875rem;
      color: #666;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GamesStatsDisplayComponent {
  @Input() subjectId?: string;
  @Input() categoryId?: string;
  
  private readonly gamesStatsService = inject(GamesStatsService);

  readonly formattedStats = computed(() => {
    // Priorité à la catégorie si fournie
    if (this.categoryId) {
      return this.gamesStatsService.formatCategoryStats(this.categoryId);
    }
    if (this.subjectId) {
      return this.gamesStatsService.formatStats(this.subjectId);
    }
    return '';
  });
}

