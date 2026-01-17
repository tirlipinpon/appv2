import { Component, Input, inject, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubjectTotalGamesService } from '../../services/subject-total-games/subject-total-games.service';

@Component({
  selector: 'app-subject-total-games-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <p *ngIf="totalGames() !== null" class="total-games">
      🎮 {{ totalGames() }} jeu{{ totalGames()! > 1 ? 'x' : '' }}
    </p>
  `,
  styles: [`
    .total-games {
      margin: 0;
      font-size: 0.875rem;
      color: #555;
      font-weight: 500;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubjectTotalGamesDisplayComponent {
  @Input() subjectId?: string;
  @Input() skipAssignmentCheck = false;

  private readonly subjectTotalGamesService = inject(SubjectTotalGamesService);

  readonly totalGames = signal<number | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly hasError = signal<boolean>(false);

  constructor() {
    // Effect pour charger le total quand subjectId change
    effect(() => {
      const subjectId = this.subjectId;
      if (!subjectId) {
        this.totalGames.set(null);
        this.isLoading.set(false);
        this.hasError.set(false);
        return;
      }

      this.isLoading.set(true);
      this.hasError.set(false);

      this.subjectTotalGamesService
        .getTotalGamesCount(subjectId, this.skipAssignmentCheck)
        .subscribe({
          next: ({ total, error }) => {
            if (error) {
              this.hasError.set(true);
              this.totalGames.set(null);
            } else {
              this.totalGames.set(total);
              this.hasError.set(false);
            }
            this.isLoading.set(false);
          },
          error: () => {
            this.hasError.set(true);
            this.totalGames.set(null);
            this.isLoading.set(false);
          },
        });
    });
  }
}
