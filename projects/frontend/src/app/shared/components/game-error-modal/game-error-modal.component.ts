import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { ChildButtonComponent } from '../child-button/child-button.component';
import { GameFeedbackMessageComponent } from '../../../features/game/components/game-feedback-message/game-feedback-message.component';

@Component({
  selector: 'app-game-error-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChildButtonComponent, GameFeedbackMessageComponent],
  template: `
    @if (visible()) {
      <div class="modal-overlay" (click)="onOverlayClick()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <!-- Message de feedback -->
        <app-game-feedback-message
          [isCorrect]="isCorrect()"
          [successRate]="successRate()"
          [gameType]="gameType()"
          [explanation]="explanation()"
          [correctCount]="correctCount()"
          [incorrectCount]="incorrectCount()">
        </app-game-feedback-message>

        <!-- Boutons d'action -->
        <div class="modal-actions">
          <app-child-button
            (buttonClick)="onReset()"
            variant="secondary"
            size="large">
            Réessayer
          </app-child-button>
          <app-child-button
            (buttonClick)="onNext()"
            variant="primary"
            size="large">
            Passer au suivant
          </app-child-button>
        </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.3s ease;
      padding: 1rem;
      backdrop-filter: blur(4px);
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .modal-content {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 2rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease;
      position: relative;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .modal-actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-top: 2rem;
      flex-wrap: wrap;
    }

    @media (max-width: 480px) {
      .modal-content {
        padding: 1.5rem;
      }

      .modal-actions {
        flex-direction: column;
      }
    }
  `]
})
export class GameErrorModalComponent {
  visible = input<boolean>(false);
  isCorrect = input<boolean>(false);
  successRate = input<number | null>(null);
  gameType = input<string | null>(null);
  explanation = input<string | undefined>(undefined);
  correctCount = input<number>(0);
  incorrectCount = input<number>(0);
  closeOnOverlayClick = input<boolean>(false);

  resetRequested = output<void>();
  nextRequested = output<void>();
  overlayClick = output<void>();

  onReset(): void {
    this.resetRequested.emit();
  }

  onNext(): void {
    this.nextRequested.emit();
  }

  onOverlayClick(): void {
    if (this.closeOnOverlayClick()) {
      this.overlayClick.emit();
    }
  }
}
