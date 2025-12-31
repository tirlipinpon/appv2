import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  standalone: true,
  imports: [CommonModule, ChildButtonComponent],
  template: `
    <div *ngIf="visible()" class="modal-overlay" (click)="onOverlayClick()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <!-- Titre -->
        <h1 *ngIf="title()" class="modal-title">
          {{ title() }}
        </h1>

        <!-- Score -->
        <div *ngIf="score() !== null && score() !== undefined" class="score-section">
          <div class="score-value">{{ score() }}%</div>
          <div class="score-label">{{ scoreLabel() || 'Score final' }}</div>
        </div>

        <!-- Message principal -->
        <div *ngIf="message()" class="modal-message">
          {{ message() }}
        </div>

        <!-- Informations supplémentaires -->
        <div *ngIf="additionalInfo()" class="additional-info">
          {{ additionalInfo() }}
        </div>

        <!-- Actions -->
        <div *ngIf="actions() && actions()!.length > 0" class="modal-actions">
          <app-child-button
            *ngFor="let action of actions()"
            (buttonClick)="action.action()"
            [variant]="action.variant || 'primary'"
            size="large">
            {{ action.label }}
          </app-child-button>
        </div>

        <!-- Contenu personnalisé via ng-content -->
        <ng-content></ng-content>
      </div>
    </div>
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
      margin-bottom: 0.5rem;
      line-height: 1;
    }

    .score-label {
      font-size: 1.25rem;
      color: #666;
      font-weight: 500;
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

  overlayClick = output<void>();

  onOverlayClick(): void {
    if (this.closeOnOverlayClick()) {
      this.overlayClick.emit();
    }
  }
}

