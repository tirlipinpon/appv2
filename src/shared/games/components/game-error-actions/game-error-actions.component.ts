import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-game-error-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-error-actions.component.html',
  styleUrl: './game-error-actions.component.scss',
})
export class GameErrorActionsComponent {
  @Input() isSubmitted = false;
  @Input() isCorrect: boolean | null = null;
  @Input() hideActions = false; // Pour masquer les actions quand un modal est affiché

  @Output() resetRequested = new EventEmitter<void>();
  @Output() nextRequested = new EventEmitter<void>();

  /**
   * Vérifie si les boutons doivent être affichés
   * (seulement si soumis ET incorrect ET pas masqué)
   */
  shouldShowActions(): boolean {
    return !this.hideActions && this.isSubmitted && this.isCorrect === false;
  }

  onReset(): void {
    this.resetRequested.emit();
  }

  onNext(): void {
    this.nextRequested.emit();
  }
}
