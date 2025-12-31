import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { GameApplication } from './components/application/application';
import { ChildButtonComponent } from '../../shared/components/child-button/child-button.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar.component';
import { FeedbackData } from './services/feedback.service';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, ChildButtonComponent, ProgressBarComponent],
  template: `
    <div class="game-container">
      <div *ngIf="application.isLoading()" class="loading">
        Chargement du jeu...
      </div>

      <div *ngIf="application.getError()" class="error">
        {{ application.getError() }}
      </div>

      <div *ngIf="!application.isLoading() && !application.getError() && application.getCurrentQuestion()()" class="game-content">
        <!-- En-tête avec progression -->
        <div class="game-header">
          <app-progress-bar
            [value]="application.getProgress()()"
            [max]="100"
            [label]="'Progression'"
            variant="primary">
          </app-progress-bar>
          <div class="score-display">
            Score: {{ application.getGameState()()?.score || 0 }}
          </div>
        </div>

        <!-- Question actuelle -->
        <div class="question-container">
          <div class="question-number">
            Question {{ (application.getGameState()()?.currentQuestionIndex ?? 0) + 1 }} / {{ (application.getGameState()()?.questions?.length ?? 0) }}
          </div>
          <h2 class="question-text">
            {{ application.getCurrentQuestion()()?.question }}
          </h2>
        </div>

        <!-- Réponses -->
        <div class="answers-container">
          <button
            *ngFor="let answer of application.getCurrentQuestion()()?.answers; let i = index"
            class="answer-button"
            [class.selected]="selectedAnswer() === i"
            [class.correct]="showFeedback() && feedback()?.isCorrect && correctAnswer() === i"
            [class.incorrect]="showFeedback() && !feedback()?.isCorrect && selectedAnswer() === i"
            [disabled]="showFeedback()"
            (click)="selectAnswer(i)">
            {{ answer }}
          </button>
        </div>

        <!-- Feedback -->
        <div *ngIf="showFeedback() && feedback()" class="feedback-container" [class.correct]="feedback()?.isCorrect" [class.incorrect]="!feedback()?.isCorrect">
          <div class="feedback-message">
            {{ feedback()?.message }}
          </div>
          <div *ngIf="feedback()?.explanation" class="feedback-explanation">
            {{ feedback()?.explanation }}
          </div>
        </div>

        <!-- Boutons d'action -->
        <div class="actions-container">
          <app-child-button
            *ngIf="!showFeedback() && selectedAnswer() !== null"
            (buttonClick)="submitAnswer()"
            variant="primary"
            size="large">
            Valider
          </app-child-button>
          <app-child-button
            *ngIf="showFeedback() && !isGameCompleted()"
            (buttonClick)="goToNextQuestion()"
            variant="primary"
            size="large">
            Question suivante
          </app-child-button>
          <app-child-button
            *ngIf="isGameCompleted()"
            (buttonClick)="finishGame()"
            variant="primary"
            size="large">
            Terminer
          </app-child-button>
        </div>
      </div>

      <!-- Écran de fin -->
      <div *ngIf="isGameCompleted() && showCompletionScreen()" class="completion-screen">
        <h1>🎉 Jeu terminé !</h1>
        <div class="final-score">
          <div class="score-value">{{ finalScore() }}%</div>
          <div class="score-label">Score final</div>
        </div>
        <div class="completion-message">
          {{ completionMessage() }}
        </div>
        <div class="completion-actions">
          <app-child-button
            (buttonClick)="goToSubjects()"
            variant="primary"
            size="large">
            Retour aux matières
          </app-child-button>
          <app-child-button
            (buttonClick)="restartGame()"
            variant="secondary"
            size="large">
            Rejouer
          </app-child-button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .game-container {
      padding: 1rem;
      max-width: 800px;
      margin: 0 auto;
      min-height: 100vh;
    }
    @media (min-width: 768px) {
      .game-container {
        padding: 2rem;
      }
    }

    .loading, .error {
      text-align: center;
      padding: 4rem 2rem;
    }

    .error {
      color: var(--theme-warn-color, #F44336);
    }

    .game-header {
      margin-bottom: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }

    .score-display {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--theme-primary-color, #4CAF50);
      white-space: nowrap;
    }

    .question-container {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .question-number {
      font-size: 0.875rem;
      color: #666;
      margin-bottom: 1rem;
      font-weight: 600;
    }

    .question-text {
      margin: 0;
      color: var(--theme-text-color, #333);
      font-size: 1.5rem;
      line-height: 1.4;
    }

    .answers-container {
      display: grid;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .answer-button {
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: var(--theme-border-radius, 12px);
      padding: 1.5rem;
      font-size: 1.125rem;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
      color: var(--theme-text-color, #333);
    }

    .answer-button:hover:not(:disabled) {
      border-color: var(--theme-primary-color, #4CAF50);
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .answer-button.selected {
      border-color: var(--theme-primary-color, #4CAF50);
      background-color: rgba(76, 175, 80, 0.1);
    }

    .answer-button.correct {
      border-color: var(--theme-primary-color, #4CAF50);
      background-color: rgba(76, 175, 80, 0.2);
    }

    .answer-button.incorrect {
      border-color: var(--theme-warn-color, #F44336);
      background-color: rgba(244, 67, 54, 0.1);
    }

    .answer-button:disabled {
      cursor: not-allowed;
      opacity: 0.8;
    }

    .feedback-container {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      animation: slideIn 0.3s ease;
    }

    .feedback-container.correct {
      border: 2px solid var(--theme-primary-color, #4CAF50);
      background-color: rgba(76, 175, 80, 0.1);
    }

    .feedback-container.incorrect {
      border: 2px solid var(--theme-warn-color, #F44336);
      background-color: rgba(244, 67, 54, 0.1);
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

    .feedback-message {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .feedback-explanation {
      font-size: 1rem;
      color: #666;
      margin-top: 0.5rem;
    }

    .actions-container {
      display: flex;
      justify-content: center;
      gap: 1rem;
    }

    .completion-screen {
      text-align: center;
      padding: 4rem 2rem;
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .completion-screen h1 {
      margin-bottom: 2rem;
      color: var(--theme-text-color, #333);
    }

    .final-score {
      margin: 2rem 0;
    }

    .score-value {
      font-size: 4rem;
      font-weight: 700;
      color: var(--theme-primary-color, #4CAF50);
      margin-bottom: 0.5rem;
    }

    .score-label {
      font-size: 1.25rem;
      color: #666;
    }

    .completion-message {
      font-size: 1.25rem;
      margin: 2rem 0;
      color: var(--theme-text-color, #333);
    }

    .completion-actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-top: 2rem;
      flex-wrap: wrap;
    }
  `]
})
export class GameComponent implements OnInit {
  protected readonly application = inject(GameApplication);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  selectedAnswer = signal<number | null>(null);
  showFeedback = signal<boolean>(false);
  feedback = signal<FeedbackData | null>(null);
  correctAnswer = signal<number | null>(null);
  finalScore = signal<number>(0);
  completionMessage = signal<string>('');
  showCompletionScreen = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    const gameId = this.route.snapshot.paramMap.get('id');
    if (gameId) {
      await this.application.initializeGame(gameId);
    } else {
      // Si pas de gameId, essayer de charger depuis categoryId
      const categoryId = this.route.snapshot.paramMap.get('categoryId');
      if (categoryId) {
        // TODO: Charger le premier jeu de la catégorie
      }
    }
  }

  selectAnswer(index: number): void {
    if (this.showFeedback()) return;
    this.selectedAnswer.set(index);
  }

  async submitAnswer(): Promise<void> {
    if (this.selectedAnswer() === null) return;

    const question = this.application.getCurrentQuestion()();
    if (!question) return;

    this.correctAnswer.set(question.correctAnswer);
    const result = await this.application.submitAnswer(this.selectedAnswer()!);
    this.feedback.set(result.feedback);
    this.showFeedback.set(true);
  }

  async goToNextQuestion(): Promise<void> {
    const hasNext = await this.application.nextQuestion();
    if (!hasNext) {
      await this.completeGame();
    } else {
      this.selectedAnswer.set(null);
      this.showFeedback.set(false);
      this.feedback.set(null);
      this.correctAnswer.set(null);
    }
  }

  async completeGame(): Promise<void> {
    await this.application.completeGame();
    const gameState = this.application.getGameState()();
    if (gameState) {
      const totalQuestions = gameState.questions.length;
      const score = gameState.score;
      this.finalScore.set(Math.round((score / totalQuestions) * 100));
      
      if (this.finalScore() === 100) {
        this.completionMessage.set('Parfait ! Tu as tout réussi ! 🏆');
      } else if (this.finalScore() >= 80) {
        this.completionMessage.set(`Excellent ! ${score}/${totalQuestions} bonnes réponses ! ⭐`);
      } else if (this.finalScore() >= 60) {
        this.completionMessage.set(`Bien joué ! ${score}/${totalQuestions} bonnes réponses ! 👍`);
      } else {
        this.completionMessage.set(`Continue ! ${score}/${totalQuestions} bonnes réponses. Tu peux réessayer ! 💪`);
      }
    }
    this.showCompletionScreen.set(true);
  }

  isGameCompleted(): boolean {
    return this.application.getGameState()()?.isCompleted || false;
  }

  async finishGame(): Promise<void> {
    await this.goToSubjects();
  }

  goToSubjects(): void {
    this.router.navigate(['/subjects']);
  }

  async restartGame(): Promise<void> {
    const gameId = this.route.snapshot.paramMap.get('id');
    if (gameId) {
      await this.application.initializeGame(gameId);
      this.selectedAnswer.set(null);
      this.showFeedback.set(false);
      this.feedback.set(null);
      this.correctAnswer.set(null);
      this.showCompletionScreen.set(false);
    }
  }
}

