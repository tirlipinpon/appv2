import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { ChildButtonComponent } from '../child-button/child-button.component';

export interface CompletionModalAction {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  action: () => void;
}

export interface CompletionModalData {
  title?: string;
  score?: number;
  scoreLabel?: string;
  message?: string;
  additionalInfo?: string;
  actions?: CompletionModalAction[];
}

@Component({
  selector: 'app-completion-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChildButtonComponent],
  template: `
    @if (visible()) {
      <div class="modal-overlay" (click)="onOverlayClick()" (keyup.escape)="onOverlayClick()" tabindex="0">
        <div class="modal-content" (click)="$event.stopPropagation()" (keyup)="$event.stopPropagation()" tabindex="0">
          <!-- Titre -->
          @if (title()) {
            <h1 class="modal-title">
              {{ title() }}
            </h1>
          }

          <!-- Score -->
          @if (score() !== null && score() !== undefined) {
            <div class="score-section">
              <div class="score-value">{{ score() }}%</div>
            </div>
          }

          <!-- Message principal -->
          @if (message()) {
            <div class="modal-message">
              {{ message() }}
            </div>
          }

          <!-- Informations supplémentaires -->
          @if (additionalInfo()) {
            <div class="additional-info">
              {{ additionalInfo() }}
            </div>
          }

          <!-- Animation d'étoile (apparaît puis disparaît) -->
          @if (starEarned()) {
            <div class="star-animation-container">
              <div class="star-earned-message">
                ⭐ Tu as remporté une étoile {{ starType() === 'category' ? 'dans cette sous-matière' : 'dans cette matière' }} !
              </div>
              <div 
                class="star-icon" 
                [style.color]="starColor() === 'gold' ? '#FFD700' : '#C0C0C0'">
                ★
              </div>
            </div>
          }

          <!-- Actions -->
          @if (actions() && actions()!.length > 0) {
            <div class="modal-actions">
              @for (action of actions()!; track action.label) {
                <app-child-button
                  (buttonClick)="action.action()"
                  [variant]="action.variant || 'primary'"
                  size="large">
                  {{ action.label }}
                </app-child-button>
              }
            </div>
          }

          <!-- Contenu personnalisé via ng-content -->
          <ng-content></ng-content>
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
      text-align: center;
      padding: 3rem 2rem;
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      max-width: 500px;
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

    .modal-title {
      margin: 0 0 2rem 0;
      color: var(--theme-text-color, #333);
      font-size: 2rem;
      font-weight: 700;
    }

    .score-section {
      margin: 2rem 0;
    }

    .score-value {
      font-size: 4rem;
      font-weight: 700;
      color: var(--theme-primary-color, #4CAF50);
      line-height: 1;
    }

    .modal-message {
      font-size: 1.25rem;
      margin: 2rem 0;
      color: var(--theme-text-color, #333);
      line-height: 1.5;
    }

    .additional-info {
      font-size: 1rem;
      margin: 1.5rem 0;
      color: #666;
      line-height: 1.4;
    }

    .modal-actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-top: 2rem;
      flex-wrap: wrap;
    }

    .star-animation-container {
      margin: 2rem 0;
      text-align: center;
      animation: starPulse 2s ease-in-out;
    }

    .star-earned-message {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--theme-primary-color, #4CAF50);
      margin-bottom: 1rem;
    }

    .star-icon {
      font-size: 4rem;
      animation: starSpin 1s ease-in-out, starFadeOut 2s ease-in-out 1s forwards;
      display: inline-block;
      line-height: 1;
    }

    @keyframes starPulse {
      0%, 100% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.1);
      }
    }

    @keyframes starSpin {
      0% {
        transform: rotate(0deg) scale(0);
        opacity: 0;
      }
      50% {
        transform: rotate(180deg) scale(1.2);
        opacity: 1;
      }
      100% {
        transform: rotate(360deg) scale(1);
        opacity: 1;
      }
    }

    @keyframes starFadeOut {
      0% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      100% {
        opacity: 0;
        transform: scale(0.5) translateY(-20px);
      }
    }

    @media (max-width: 480px) {
      .modal-content {
        padding: 2rem 1.5rem;
      }

      .modal-title {
        font-size: 1.5rem;
      }

      .score-value {
        font-size: 3rem;
      }

      .modal-message {
        font-size: 1.125rem;
      }

      .modal-actions {
        flex-direction: column;
      }

      .star-icon {
        font-size: 3rem;
      }

      .star-earned-message {
        font-size: 1.125rem;
      }
    }
  `]
})
export class CompletionModalComponent {
  visible = input<boolean>(false);
  title = input<string | null>(null);
  score = input<number | null>(null);
  scoreLabel = input<string>('Score final');
  message = input<string | null>(null);
  additionalInfo = input<string | null>(null);
  actions = input<CompletionModalAction[] | null>(null);
  closeOnOverlayClick = input<boolean>(true);
  
  // Nouveaux inputs pour l'animation d'étoile
  starEarned = input<boolean>(false);
  starColor = input<'gold' | 'silver'>('gold');
  starType = input<'category' | 'subject'>('category');

  overlayClick = output<void>();

  onOverlayClick(): void {
    if (this.closeOnOverlayClick()) {
      this.overlayClick.emit();
    }
  }
}

