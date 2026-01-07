import { Component, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameFeedbackMessageService, GameFeedbackMessage } from '../../services/game-feedback-message.service';

@Component({
  selector: 'app-game-feedback-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="feedback-message-container"
      [class.success]="feedback()?.variant === 'success'"
      [class.encouraging]="feedback()?.variant === 'encouraging'"
      [class.neutral]="feedback()?.variant === 'neutral'"
      [class.needs-improvement]="feedback()?.variant === 'needs-improvement'">
      <div class="feedback-header">
        <div class="feedback-content">
          <span class="feedback-emoji" *ngIf="feedback()?.emoji">{{ feedback()?.emoji }}</span>
          <span class="feedback-text">{{ feedback()?.message }}</span>
        </div>
        <div *ngIf="shouldShowBadge()" class="success-rate-badge">
          {{ formattedSuccessRate() }}
        </div>
      </div>
      <div *ngIf="explanation()" class="feedback-explanation">
        {{ explanation() }}
      </div>
    </div>
  `,
  styles: [`
    .feedback-message-container {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      animation: slideIn 0.3s ease;
      border: 2px solid transparent;
    }

    .feedback-message-container.success {
      border-color: var(--theme-primary-color, #4CAF50);
      background-color: rgba(76, 175, 80, 0.1);
    }

    .feedback-message-container.encouraging {
      border-color: #FF9800;
      background-color: rgba(255, 152, 0, 0.1);
    }

    .feedback-message-container.neutral {
      border-color: #2196F3;
      background-color: rgba(33, 150, 243, 0.1);
    }

    .feedback-message-container.needs-improvement {
      border-color: #9C27B0;
      background-color: rgba(156, 39, 176, 0.1);
    }

    .feedback-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .feedback-content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.25rem;
      font-weight: 700;
      flex: 1;
      min-width: 0;
    }

    .feedback-emoji {
      font-size: 1.5rem;
      line-height: 1;
    }

    .feedback-text {
      flex: 1;
    }

    .success-rate-badge {
      font-size: 0.875rem;
      font-weight: 700;
      padding: 0.5rem 0.875rem;
      border-radius: 20px;
      background-color: rgba(0, 0, 0, 0.08);
      color: #333;
      white-space: nowrap;
      flex-shrink: 0;
      border: 1px solid rgba(0, 0, 0, 0.1);
    }

    @media (max-width: 768px) {
      .feedback-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .success-rate-badge {
        align-self: flex-end;
      }
    }

    .feedback-explanation {
      font-size: 1rem;
      color: #666;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class GameFeedbackMessageComponent {
  private readonly feedbackService = inject(GameFeedbackMessageService);

  // Inputs
  isCorrect = input<boolean>(false);
  successRate = input<number | null>(null);
  gameType = input<string | null>(null);
  explanation = input<string | undefined>(undefined);
  correctCount = input<number>(0);
  incorrectCount = input<number>(0);

  // Computed
  feedback = computed<GameFeedbackMessage | null>(() => {
    return this.feedbackService.getFeedbackMessage(
      this.isCorrect(),
      this.successRate(),
      this.gameType()
    );
  });

  formattedSuccessRate = computed<string>(() => {
    const rate = this.successRate();
    if (rate === null) return '';
    
    // Pour les jeux spécifiques, utiliser les compteurs
    const correct = this.correctCount();
    const incorrect = this.incorrectCount();
    const total = correct + incorrect;
    
    // Afficher le ratio et le pourcentage : "2/5 (40%)" ou "0/1 (0%)"
    if (total > 0) {
      return `${correct}/${total} (${rate}%)`;
    }
    
    return `${rate}%`;
  });
  
  // Computed pour vérifier si on doit afficher le badge
  shouldShowBadge = computed<boolean>(() => {
    const rate = this.successRate();
    const total = this.correctCount() + this.incorrectCount();
    // Afficher le badge seulement si on a un pourcentage, que la réponse est incorrecte
    // et qu'il y a eu au moins une tentative
    return rate !== null && rate !== undefined && !this.isCorrect() && total > 0;
  });
}
