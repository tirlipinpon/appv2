import { Component, inject, OnInit, OnDestroy, signal, computed, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { JsonPipe } from '@angular/common';
import { Subscription, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { GameApplication } from './components/application/application';
import { ChildButtonComponent } from '../../shared/components/child-button/child-button.component';
import { SubjectProgressComponent } from '../../shared/components/subject-progress/subject-progress.component';
import { CompletionModalComponent, CompletionModalAction } from '../../shared/components/completion-modal/completion-modal.component';
import { FeedbackData, FeedbackService } from './services/feedback.service';
import { QcmGameComponent, ChronologieGameComponent, MemoryGameComponent, SimonGameComponent, ImageInteractiveGameComponent, CaseVideGameComponent, LiensGameComponent, VraiFauxGameComponent, PuzzleGameComponent, ReponseLibreGameComponent } from '@shared/games';
import type { QcmData, ChronologieData, MemoryData, SimonData, ImageInteractiveData, ReponseLibreData, CaseVideData, LiensData, VraiFauxData, PuzzleData } from '@shared/games';
import { BreadcrumbComponent, BreadcrumbItem } from '../../shared/components/breadcrumb/breadcrumb.component';
import { SubjectsInfrastructure } from '../subjects/components/infrastructure/infrastructure';
import { ChildAuthService } from '../../core/auth/child-auth.service';
import { ProgressionService } from '../../core/services/progression/progression.service';
import { SessionStarService } from '../../core/services/session-star/session-star.service';
import { BadgeNotificationService } from '../../core/services/badges/badge-notification.service';
import type { Game } from '../../core/types/game.types';
import {
  isGameType,
  isGameTypeOneOf,
  GAME_TYPE_QCM,
  GAME_TYPE_CHRONOLOGIE,
  GAME_TYPE_MEMORY,
  GAME_TYPE_SIMON,
  GAME_TYPE_IMAGE_INTERACTIVE,
  GAME_TYPE_CASE_VIDE,
  GAME_TYPE_LIENS,
  GAME_TYPE_VRAI_FAUX,
  GAME_TYPE_REPONSE_LIBRE,
  GAME_TYPE_PUZZLE,
  SPECIFIC_GAME_TYPES,
  getGameTypeVariations,
} from '@shared/utils/game-type.util';
import { normalizeGameType } from '../../shared/utils/game-normalization.util';
import { GameFeedbackMessageComponent } from './components/game-feedback-message/game-feedback-message.component';
import { GameErrorModalComponent } from '../../shared/components/game-error-modal/game-error-modal.component';

@Component({
  selector: 'app-game',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChildButtonComponent, SubjectProgressComponent, CompletionModalComponent, QcmGameComponent, ChronologieGameComponent, MemoryGameComponent, SimonGameComponent, ImageInteractiveGameComponent, CaseVideGameComponent, LiensGameComponent, VraiFauxGameComponent, PuzzleGameComponent, ReponseLibreGameComponent, BreadcrumbComponent, GameFeedbackMessageComponent, GameErrorModalComponent, JsonPipe],
  template: `
    <div class="game-container">
      <!-- Breadcrumb -->
      <app-breadcrumb [items]="breadcrumbItems()" />
      
      @if (application.isLoading()()) {
        <div class="loading">
          Chargement du jeu...
        </div>
      }

      @if (application.getError()()) {
        <div class="error">
          {{ application.getError()() }}
        </div>
      }

      <!-- Debug: Afficher les infos du jeu si chargé mais pas de contenu -->
      @if (!application.isLoading()() && !application.getError()() && application.getCurrentGame()() && !gameData() && !isGenericGame()) {
        <div class="error">
        <p>Jeu chargé mais données manquantes.</p>
        <p>Type de jeu: {{ gameType() || 'non défini' }}</p>
        <p>Jeu: {{ application.getCurrentGame()()?.name || 'sans nom' }}</p>
        <p>game_data_json: {{ application.getCurrentGame()()?.game_data_json ? 'présent mais vide/null' : 'absent' }}</p>
        <details>
          <summary>Détails du jeu (cliquez pour voir)</summary>
          <pre>{{ application.getCurrentGame()() | json }}</pre>
        </details>
        </div>
      }

      @if (!application.isLoading()() && !application.getError()() && application.getCurrentGame()() && (gameData() || isGenericGame())) {
        <div class="game-content">
        <!-- En-tête avec progression -->
        <div class="game-header">
          <div class="header-left">
            <app-child-button
              (buttonClick)="goBack()"
              variant="secondary"
              size="small">
              ← Retour
            </app-child-button>
          </div>
          <div class="header-center">
            <app-subject-progress
              [gameId]="route.snapshot.paramMap.get('id')"
              [label]="'Progression'"
              [variant]="'primary'">
            </app-subject-progress>
          </div>
          <div class="header-right">
            <div class="score-display">
              Score: {{ totalScore() }}
            </div>
          </div>
        </div>

        <!-- Jeux spécifiques -->
        @if (isQcmGame() && getQcmData()) {
          <app-qcm-game
            [qcmData]="getQcmData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            [aides]="application.getCurrentGame()()?.aides || null"
            [aideImageUrl]="application.getCurrentGame()()?.aide_image_url || null"
            [aideVideoUrl]="application.getCurrentGame()()?.aide_video_url || null"
            [instructions]="application.getCurrentGame()()?.instructions || null"
            [question]="application.getCurrentGame()()?.question || null"
            (validated)="onGameValidated($event)"
            (resetRequested)="restartGame()"
            (nextRequested)="onNextButtonClick()">
          </app-qcm-game>
        } @else if (isChronologieGame() && getChronologieData()) {
          <app-chronologie-game
            [chronologieData]="getChronologieData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            [aides]="application.getCurrentGame()()?.aides || null"
            [aideImageUrl]="application.getCurrentGame()()?.aide_image_url || null"
            [aideVideoUrl]="application.getCurrentGame()()?.aide_video_url || null"
            [instructions]="application.getCurrentGame()()?.instructions || null"
            [question]="application.getCurrentGame()()?.question || null"
            (validated)="onGameValidated($event)"
            (resetRequested)="restartGame()"
            (nextRequested)="onNextButtonClick()">
          </app-chronologie-game>
        } @else if (isMemoryGame() && getMemoryData()) {
          <app-memory-game
            [memoryData]="getMemoryData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            [aides]="application.getCurrentGame()()?.aides || null"
            [aideImageUrl]="application.getCurrentGame()()?.aide_image_url || null"
            [aideVideoUrl]="application.getCurrentGame()()?.aide_video_url || null"
            [instructions]="application.getCurrentGame()()?.instructions || null"
            [question]="application.getCurrentGame()()?.question || null"
            (validated)="onGameValidated($event)"
            (resetRequested)="restartGame()"
            (nextRequested)="onNextButtonClick()">
          </app-memory-game>
        } @else if (isSimonGame() && getSimonData()) {
          <app-simon-game
            [simonData]="getSimonData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            [aides]="application.getCurrentGame()()?.aides || null"
            [aideImageUrl]="application.getCurrentGame()()?.aide_image_url || null"
            [aideVideoUrl]="application.getCurrentGame()()?.aide_video_url || null"
            [instructions]="application.getCurrentGame()()?.instructions || null"
            [question]="application.getCurrentGame()()?.question || null"
            (validated)="onGameValidated($event)"
            (resetRequested)="restartGame()"
            (nextRequested)="onNextButtonClick()">
          </app-simon-game>
        } @else if (isImageInteractiveGame() && getImageInteractiveData()) {
          <app-image-interactive-game
            [imageData]="getImageInteractiveData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            [aides]="application.getCurrentGame()()?.aides || null"
            [aideImageUrl]="application.getCurrentGame()()?.aide_image_url || null"
            [aideVideoUrl]="application.getCurrentGame()()?.aide_video_url || null"
            [instructions]="application.getCurrentGame()()?.instructions || null"
            [question]="application.getCurrentGame()()?.question || null"
            (validated)="onGameValidated($event)"
            (resetRequested)="restartGame()"
            (nextRequested)="onNextButtonClick()">
          </app-image-interactive-game>
        } @else if (isCaseVideGame() && getCaseVideData()) {
          <!-- Jeu Case Vide -->
          <app-case-vide-game
            #caseVideGame
            [caseVideData]="getCaseVideData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            [aides]="application.getCurrentGame()()?.aides || null"
            [aideImageUrl]="application.getCurrentGame()()?.aide_image_url || null"
            [aideVideoUrl]="application.getCurrentGame()()?.aide_video_url || null"
            [instructions]="application.getCurrentGame()()?.instructions || null"
            [question]="application.getCurrentGame()()?.question || null"
            (validated)="onCaseVideValidated($event)"
            (resetRequested)="restartGame()"
            (nextRequested)="onNextButtonClick()">
          </app-case-vide-game>
        } @else if (isLiensGame() && getLiensData()) {
          <!-- Jeu Liens -->
          <app-liens-game
            #liensGame
            [liensData]="getLiensData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            [aides]="application.getCurrentGame()()?.aides || null"
            [aideImageUrl]="application.getCurrentGame()()?.aide_image_url || null"
            [aideVideoUrl]="application.getCurrentGame()()?.aide_video_url || null"
            [instructions]="application.getCurrentGame()()?.instructions || null"
            [question]="application.getCurrentGame()()?.question || null"
            (validated)="onLiensValidated($event)"
            (resetRequested)="restartGame()"
            (nextRequested)="onNextButtonClick()">
          </app-liens-game>
        } @else if (isVraiFauxGame() && getVraiFauxData()) {
          <!-- Jeu Vrai/Faux -->
          <app-vrai-faux-game
            #vraiFauxGame
            [vraiFauxData]="getVraiFauxData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            [aides]="application.getCurrentGame()()?.aides || null"
            [aideImageUrl]="application.getCurrentGame()()?.aide_image_url || null"
            [aideVideoUrl]="application.getCurrentGame()()?.aide_video_url || null"
            [instructions]="application.getCurrentGame()()?.instructions || null"
            [question]="application.getCurrentGame()()?.question || null"
            (validated)="onVraiFauxValidated($event)"
            (resetRequested)="restartGame()"
            (nextRequested)="onNextButtonClick()">
          </app-vrai-faux-game>
        } @else if (isPuzzleGame() && getPuzzleData()) {
          <!-- Jeu Puzzle -->
          <app-puzzle-game
            [puzzleData]="getPuzzleData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            [aides]="application.getCurrentGame()()?.aides || null"
            [aideImageUrl]="application.getCurrentGame()()?.aide_image_url || null"
            [aideVideoUrl]="application.getCurrentGame()()?.aide_video_url || null"
            [instructions]="application.getCurrentGame()()?.instructions || null"
            [question]="application.getCurrentGame()()?.question || null"
            (validated)="onGameValidated($event)"
            (resetRequested)="restartGame()"
            (nextRequested)="onNextButtonClick()">
          </app-puzzle-game>
        } @else if (isReponseLibreGame() && getReponseLibreData()) {
          <app-reponse-libre-game
            [reponseLibreData]="getReponseLibreData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            [aides]="application.getCurrentGame()()?.aides || null"
            [aideImageUrl]="application.getCurrentGame()()?.aide_image_url || null"
            [aideVideoUrl]="application.getCurrentGame()()?.aide_video_url || null"
            [instructions]="application.getCurrentGame()()?.instructions || null"
            [question]="application.getCurrentGame()()?.question || null"
            (validated)="onGameValidated($event)"
            (resetRequested)="restartGame()"
            (nextRequested)="onNextButtonClick()">
          </app-reponse-libre-game>
        } @else if (isGenericGame() && application.getCurrentQuestion()()) {
          <!-- Jeux génériques avec questions/réponses -->
          @if (application.getCurrentGame()()) {
            <div class="game-info-container">
            @if (application.getCurrentGame()()!.name) {
              <h1 class="game-name">{{ application.getCurrentGame()()!.name }}</h1>
            }
            @if (application.getCurrentGame()()!.instructions) {
              <p class="game-instructions">{{ application.getCurrentGame()()!.instructions }}</p>
            }
            </div>
          }
          <div class="question-container">
            <div class="question-number">
              Question {{ (application.getGameState()()?.currentQuestionIndex ?? 0) + 1 }} / {{ (application.getGameState()()?.questions?.length ?? 0) }}
            </div>
            <h2 class="question-text">
              {{ application.getCurrentQuestion()()?.question }}
            </h2>
            @if (application.getCurrentGame()()?.aides && application.getCurrentGame()()!.aides!.length > 0) {
              <div class="aides-toggle-container">
                <button 
                  type="button"
                  class="aides-toggle-btn"
                  (click)="toggleAides()"
                  [attr.aria-expanded]="showAides()"
                  [attr.aria-label]="showAides() ? 'Masquer aide' : 'Afficher aide'">
                  <span class="toggle-icon">{{ showAides() ? '−' : '+' }}</span>
                  <span class="toggle-text">{{ showAides() ? 'Masquer aide' : 'Afficher aide' }}</span>
                </button>
                @if (showAides()) {
                  <div class="aides-container">
                    <strong>Aide :</strong>
                    <ul>
                      @for (aide of application.getCurrentGame()()!.aides!; track $index) {
                        <li>{{ aide }}</li>
                      }
                    </ul>
                  </div>
                }
              </div>
            }
          </div>

          <div class="answers-container">
            @for (answer of application.getCurrentQuestion()()?.answers || []; track $index; let i = $index) {
              <button
                class="answer-button"
                [class.selected]="selectedAnswer() === i"
                [class.correct]="showFeedback() && feedback()?.isCorrect && correctAnswer() === i"
                [class.incorrect]="showFeedback() && !feedback()?.isCorrect && selectedAnswer() === i"
                [disabled]="showFeedback()"
                (click)="selectAnswer(i)">
                {{ answer }}
              </button>
            }
          </div>
        }

        <!-- Feedback - Masqué si le modal d'erreur est affiché -->
        @if (showFeedback() && feedback() && !shouldShowErrorModal()) {
          <app-game-feedback-message
          [isCorrect]="feedback()?.isCorrect ?? false"
          [successRate]="currentGameSuccessRate()"
          [gameType]="normalizedGameType()"
          [explanation]="feedback()?.explanation"
            [correctCount]="getCorrectCountForDisplay()"
            [incorrectCount]="getIncorrectCountForDisplay()">
          </app-game-feedback-message>
        }

        <!-- Boutons d'action - Masqués si le jeu est complété (le modal gère la navigation) -->
        @if (!isGameCompleted() || !showCompletionScreen()) {
          <div class="actions-container">
            @if (!showFeedback() && shouldShowValidateButton() && !isGameCompleted()) {
              <app-child-button
                (buttonClick)="isCaseVideGame() ? submitCaseVide() : (isLiensGame() ? submitLiens() : (isVraiFauxGame() ? submitVraiFaux() : submitAnswer()))"
                variant="primary"
                size="large">
                Valider
              </app-child-button>
            }
            <!-- Bouton "Passer" pour permettre de passer à la question suivante sans validation -->
            @if (!showFeedback() && !isGameCompleted()) {
              <app-child-button
                (buttonClick)="skipQuestion()"
                variant="secondary"
                size="large">
                Passer
              </app-child-button>
            }
            <!-- Bouton "Réessayer" pour les jeux spécifiques avec réponse incorrecte - masqué car géré par game-error-actions -->
            <!-- Bouton "Question suivante" pour les jeux génériques -->
            @if (showFeedback() && !isGameCompleted() && isGenericGame()) {
              <app-child-button
                (buttonClick)="goToNextQuestion()"
                variant="primary"
                size="large">
                Question suivante
              </app-child-button>
            }
          </div>
        }
      </div>
    }

      <!-- Modal de fin de jeu -->
      <app-completion-modal
        [visible]="isGameCompleted() && showCompletionScreen()"
        [title]="'🎉 Jeu terminé !'"
        [score]="categoryProgress()"
        [scoreLabel]="'Progression'"
        [message]="completionMessage()"
        [starEarned]="starEarned()"
        [starColor]="starColor()"
        [starType]="starType()"
        [actions]="completionActions()"
        (overlayClick)="onCompletionModalClose()">
      </app-completion-modal>

      <!-- Modal d'erreur -->
      <app-game-error-modal
        [visible]="shouldShowErrorModal()"
        [isCorrect]="feedback()?.isCorrect ?? false"
        [successRate]="currentGameSuccessRate()"
        [gameType]="normalizedGameType()"
        [explanation]="feedback()?.explanation"
        [correctCount]="getCorrectCountForDisplay()"
        [incorrectCount]="getIncorrectCountForDisplay()"
        (resetRequested)="restartGame()"
        (nextRequested)="onNextButtonClick()">
      </app-game-error-modal>
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
      flex-wrap: wrap;
    }

    .header-left {
      flex: 0 0 auto;
    }

    .header-center {
      flex: 1 1 auto;
      min-width: 200px;
      display: flex;
      justify-content: center;
    }

    .header-right {
      flex: 0 0 auto;
    }

    .score-display {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--theme-primary-color, #4CAF50);
      white-space: nowrap;
    }

    @media (max-width: 768px) {
      .game-header {
        flex-direction: column;
        align-items: stretch;
      }

      .header-left {
        order: 1;
        margin-bottom: 1rem;
      }

      .header-center {
        order: 2;
        margin-bottom: 1rem;
      }

      .header-right {
        order: 3;
        text-align: center;
      }
    }

    .game-info-container {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .game-name {
      margin: 0 0 0.5rem 0;
      color: var(--theme-primary-color, #4CAF50);
      font-size: 1.5rem;
      font-weight: 700;
    }

    .game-instructions {
      margin: 0;
      color: var(--theme-text-color, #666);
      font-size: 1rem;
      line-height: 1.5;
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

    .aides-container {
      margin-top: 1rem;
      padding: 1rem;
      background: #f0f0f0;
      border-radius: 8px;
      font-size: 0.9rem;
    }

    .aides-container ul {
      margin: 0.5rem 0 0 1.5rem;
      padding: 0;
    }

    .reponse-libre-container {
      margin-bottom: 2rem;
    }
  `]
})
export class GameComponent implements OnInit, OnDestroy {
  protected readonly application = inject(GameApplication);
  readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly subjectsInfrastructure = inject(SubjectsInfrastructure);
  private readonly childAuthService = inject(ChildAuthService);
  private readonly progression = inject(ProgressionService);
  private readonly sessionStarService = inject(SessionStarService);
  private readonly badgeNotification = inject(BadgeNotificationService);
  private readonly feedbackService = inject(FeedbackService);
  private routeSubscription?: Subscription;

  selectedAnswer = signal<number | null>(null);
  showFeedback = signal<boolean>(false);
  feedback = signal<FeedbackData | null>(null);
  correctAnswer = signal<number | null>(null);
  finalScore = signal<number>(0);
  completionMessage = signal<string>('');
  showCompletionScreen = signal<boolean>(false);
  gameCompleted = signal<boolean>(false);
  categoryProgress = signal<number>(0); // Progression globale de la catégorie
  totalScore = signal<number>(0); // Score total (nombre de jeux résolus avec score 100%)
  
  // Compteurs pour calculer le pourcentage lors de la validation
  correctAnswersCount = signal<number>(0);
  incorrectAnswersCount = signal<number>(0);
  // Stocker le dernier score validé pour la sauvegarde (car les compteurs peuvent être réinitialisés)
  lastValidatedScore = signal<{ correct: number; incorrect: number } | null>(null);
  
  // Signals pour l'animation d'étoile dans le modal
  starEarned = signal<boolean>(false);
  starColor = signal<'gold' | 'silver'>('gold');
  starType = signal<'category' | 'subject'>('category');
  
  // Taux de réussite calculé après chaque validation
  // Pour les jeux génériques : utilise le score du GameState
  // Pour les jeux spécifiques : utilise les compteurs de tentatives
  currentGameSuccessRate = computed<number | null>(() => {
    // Pour les jeux génériques avec questions, utiliser le score du GameState
    if (this.isGenericGame()) {
      const gameState = this.application.getGameState()();
      if (!gameState || !gameState.questions || gameState.questions.length === 0) {
        return null;
      }
      const totalQuestions = gameState.questions.length;
      const score = gameState.score;
      if (totalQuestions === 0) return null;
      return Math.round((score / totalQuestions) * 100);
    }
    
    // Pour les jeux spécifiques, utiliser les compteurs de tentatives
    const correct = this.correctAnswersCount();
    const incorrect = this.incorrectAnswersCount();
    const total = correct + incorrect;
    
    if (total === 0) return null;
    
    return Math.round((correct / total) * 100);
  });
  
  // État pour afficher/masquer les aides (pour les jeux génériques et reponse_libre)
  showAides = signal<boolean>(false);

  // Computed pour déterminer si le modal d'erreur doit être affiché
  shouldShowErrorModal = computed<boolean>(() => {
    return this.showFeedback() && 
           this.feedback() !== null && 
           this.feedback()?.isCorrect === false &&
           !this.isGameCompleted();
  });

  // Computed pour déterminer si le bouton "Valider" doit être affiché
  shouldShowValidateButton = computed<boolean>(() => {
    // Masquer pour les jeux avec validation automatique, Simon et Chronologie (qui ont leur propre bouton)
    if (this.isCaseVideGame() || this.isLiensGame() || this.isVraiFauxGame() || this.isQcmGame() || this.isSimonGame() || this.isChronologieGame()) {
      return false;
    }

    // Afficher pour les autres jeux (Memory, etc.)
    return !this.showFeedback() && 
           (this.selectedAnswer() !== null || 
            this.isGenericGame() || 
            this.isMemoryGame());
  });

  toggleAides(): void {
    this.showAides.update(v => !v);
  }

  // État pour le breadcrumb
  currentSubject = signal<{ id: string; name: string } | null>(null);
  currentCategory = signal<{ id: string; name: string } | null>(null);

  // Breadcrumb items
  breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [];
    const game = this.application.getCurrentGame()();
    
    if (!game) return items;
    
    items.push({
      label: 'Matières',
      action: () => this.goToSubjects()
    });
    
    if (this.currentSubject()) {
      items.push({
        label: this.currentSubject()!.name,
        action: this.currentCategory() ? () => this.goToCategory() : undefined,
        isActive: !this.currentCategory()
      });
    }
    
    if (this.currentCategory()) {
      items.push({
        label: this.currentCategory()!.name,
        action: () => this.goToCategory(),
        isActive: false
      });
      items.push({
        label: 'Jeux',
        action: () => this.goToGames(),
        isActive: false
      });
    }
    
    items.push({
      label: game.name,
      isActive: true
    });
    
    return items;
  });

  // Références aux composants de jeux
  @ViewChild('caseVideGame', { static: false }) caseVideGameComponent?: CaseVideGameComponent;
  @ViewChild('liensGame', { static: false }) liensGameComponent?: LiensGameComponent;
  @ViewChild('vraiFauxGame', { static: false }) vraiFauxGameComponent?: VraiFauxGameComponent;

  nextGameId = signal<string | null>(null);
  hasNextGame = signal<boolean>(false);

  completionActions = computed<CompletionModalAction[]>(() => {
    const actions: CompletionModalAction[] = [];
    
    // Ajouter le bouton "Continuer" si un prochain jeu existe
    if (this.hasNextGame()) {
      actions.push({
        label: 'Continuer',
        variant: 'primary',
        action: () => this.onCompletionAction(() => this.goToNextGame())
      });
    }
    
    // Ajouter les autres actions
    actions.push(
      {
        label: 'Retour aux matières',
        variant: this.hasNextGame() ? 'secondary' : 'primary',
        action: () => this.onCompletionAction(() => this.goToSubjects())
      },
      {
        label: 'Rejouer',
        variant: 'secondary',
        action: () => this.onCompletionAction(() => this.restartGame())
      }
    );
    
    return actions;
  });

  /**
   * Wrapper pour les actions du modal de complétion
   * Ferme le modal, déclenche l'affichage des badges, puis exécute l'action
   */
  private onCompletionAction(action: () => void | Promise<void>): void {
    // Fermer le modal
    this.showCompletionScreen.set(false);
    
    // Déclencher l'affichage des badges après un court délai
    setTimeout(() => {
      this.badgeNotification.processNextBadgeInQueue();
    }, 300);
    
    // Exécuter l'action
    const result = action();
    if (result instanceof Promise) {
      result.catch(error => {
        console.error('Erreur lors de l\'exécution de l\'action:', error);
      });
    }
  }

  // Computed pour déterminer le type de jeu et les données
  gameType = computed(() => {
    const game = this.application.getCurrentGame()();
    return game?.game_type || null;
  });

  // Type de jeu normalisé pour le service de feedback
  normalizedGameType = computed(() => {
    const type = this.gameType();
    if (!type) return null;
    return normalizeGameType(type);
  });

  gameData = computed(() => {
    const game = this.application.getCurrentGame()();
    const data = game?.game_data_json;
    // Vérifier si les données existent et ne sont pas un objet vide
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return null;
    }
    return data;
  });

  // Helpers pour déterminer quel composant afficher
  // Utiliser les fonctions de comparaison normalisées pour gérer les variations depuis la DB
  isQcmGame = computed(() => isGameType(this.gameType(), GAME_TYPE_QCM));
  isChronologieGame = computed(() => isGameType(this.gameType(), GAME_TYPE_CHRONOLOGIE));
  isMemoryGame = computed(() => isGameType(this.gameType(), GAME_TYPE_MEMORY));
  isSimonGame = computed(() => isGameType(this.gameType(), GAME_TYPE_SIMON));
  isImageInteractiveGame = computed(() => {
    return isGameTypeOneOf(this.gameType(), ...getGameTypeVariations(GAME_TYPE_IMAGE_INTERACTIVE));
  });
  isCaseVideGame = computed(() => {
    return isGameTypeOneOf(this.gameType(), ...getGameTypeVariations(GAME_TYPE_CASE_VIDE));
  });
  isLiensGame = computed(() => {
    return isGameTypeOneOf(this.gameType(), ...getGameTypeVariations(GAME_TYPE_LIENS));
  });
  isVraiFauxGame = computed(() => {
    return isGameTypeOneOf(this.gameType(), ...getGameTypeVariations(GAME_TYPE_VRAI_FAUX));
  });
  isReponseLibreGame = computed(() => {
    return isGameTypeOneOf(this.gameType(), ...getGameTypeVariations(GAME_TYPE_REPONSE_LIBRE));
  });
  isPuzzleGame = computed(() => {
    return isGameTypeOneOf(this.gameType(), ...getGameTypeVariations(GAME_TYPE_PUZZLE));
  });
  isGenericGame = computed(() => {
    const type = this.gameType();
    if (!type) return false;
    // Vérifier si le type n'est pas un des types spécifiques connus
    return !isGameTypeOneOf(type, ...SPECIFIC_GAME_TYPES);
  });

  // Getters typés pour les données de jeu
  getQcmData(): QcmData | null {
    const data = this.gameData();
    return data && this.isQcmGame() ? (data as unknown as QcmData) : null;
  }

  getChronologieData(): ChronologieData | null {
    const data = this.gameData();
    return data && this.isChronologieGame() ? (data as unknown as ChronologieData) : null;
  }

  getMemoryData(): MemoryData | null {
    const data = this.gameData();
    return data && this.isMemoryGame() ? (data as unknown as MemoryData) : null;
  }

  getSimonData(): SimonData | null {
    const data = this.gameData();
    return data && this.isSimonGame() ? (data as unknown as SimonData) : null;
  }

  getImageInteractiveData(): ImageInteractiveData | null {
    const data = this.gameData();
    return data && this.isImageInteractiveGame() ? (data as unknown as ImageInteractiveData) : null;
  }

  getReponseLibreData(): ReponseLibreData | null {
    const data = this.gameData();
    return data && isGameTypeOneOf(this.gameType(), ...getGameTypeVariations(GAME_TYPE_REPONSE_LIBRE)) ? (data as unknown as ReponseLibreData) : null;
  }

  getReponseLibreReponseValide(): string {
    const reponseLibreData = this.getReponseLibreData();
    return reponseLibreData?.reponse_valide || '';
  }

  getCaseVideData(): CaseVideData | null {
    const data = this.gameData();
    return data && this.isCaseVideGame() ? (data as unknown as CaseVideData) : null;
  }

  getLiensData(): LiensData | null {
    const data = this.gameData();
    return data && this.isLiensGame() ? (data as unknown as LiensData) : null;
  }

  getVraiFauxData(): VraiFauxData | null {
    const data = this.gameData();
    return data && this.isVraiFauxGame() ? (data as unknown as VraiFauxData) : null;
  }

  getPuzzleData(): PuzzleData | null {
    const data = this.gameData();
    return data && this.isPuzzleGame() ? (data as unknown as PuzzleData) : null;
  }

  ngOnInit(): void {
    // S'abonner aux changements de paramètres de route pour détecter les changements d'ID de jeu
    this.routeSubscription = this.route.paramMap.pipe(
      switchMap(params => {
        const gameId = params.get('id');
        if (gameId) {
          return from(this.loadGame(gameId));
        }
        // Si pas de gameId, essayer de charger depuis categoryId
        const categoryId = params.get('categoryId');
        if (categoryId) {
          // TODO: Charger le premier jeu de la catégorie
        }
        return from(Promise.resolve());
      })
    ).subscribe();
  }

  ngOnDestroy(): void {
    // IMPORTANT: Vérifier que le composant est toujours sur la route /game avant de sauvegarder
    // pour éviter de sauvegarder lors de la navigation vers une autre route
    const currentUrl = this.router.url;
    if (currentUrl.startsWith('/game/')) {
      // Sauvegarder le score partiel avant de détruire le composant (sans await car ngOnDestroy ne peut pas être async)
      this.savePartialScoreIfNeeded().catch(error => {
        console.error('Erreur lors de la sauvegarde du score partiel:', error);
      });
    }
    
    // Nettoyer l'abonnement pour éviter les fuites mémoire
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }

  private async loadGame(gameId: string): Promise<void> {
    // Réinitialiser les signaux pour le prochain jeu
    this.hasNextGame.set(false);
    this.nextGameId.set(null);
    this.gameCompleted.set(false);
    this.showCompletionScreen.set(false);
    this.finalScore.set(0);
    this.completionMessage.set('');
    this.selectedAnswer.set(null);
    this.showFeedback.set(false);
    this.feedback.set(null);
    this.correctAnswer.set(null);
    this.showAides.set(false);
    this.correctAnswersCount.set(0);
    this.incorrectAnswersCount.set(0);
    
    await this.application.initializeGame(gameId);
    // Charger les informations de subject et category pour le breadcrumb
    await this.loadBreadcrumbData();
    // Charger la progression globale de la catégorie
    await this.loadCategoryProgress();
    await this.loadTotalScore();
  }

  private async loadCategoryProgress(): Promise<void> {
    const child = this.childAuthService.getCurrentChild();
    const childId = child?.child_id;
    const game = this.application.getCurrentGame()();
    
    if (!childId || !game) {
      this.categoryProgress.set(0);
      return;
    }
    
    try {
      let progress = 0;
      
      if (game.subject_category_id) {
        // Cas 1 : Sous-catégorie (subject_category_id présent)
        progress = await this.progression.calculateCategoryCompletionPercentage(childId, game.subject_category_id);
      } else if (game.subject_id) {
        // Cas 2 : Matière principale (subject_id présent, subject_category_id null)
        progress = await this.progression.calculateSubjectCompletionPercentage(childId, game.subject_id);
      }
      
      this.categoryProgress.set(progress);
    } catch (error) {
      // Ne pas bloquer l'affichage du modal si le chargement de la progression échoue
      console.error('Erreur lors du chargement de la progression:', error);
      // Utiliser 0 comme valeur par défaut pour permettre l'affichage du modal
      this.categoryProgress.set(0);
    }
  }

  private async loadTotalScore(): Promise<void> {
    const child = this.childAuthService.getCurrentChild();
    const childId = child?.child_id;
    
    if (!childId) {
      this.totalScore.set(0);
      return;
    }
    
    try {
      const score = await this.progression.calculateTotalScore(childId);
      this.totalScore.set(score);
    } catch (error) {
      console.error('Erreur lors du chargement du score total:', error);
      this.totalScore.set(0);
    }
  }


  async loadBreadcrumbData(): Promise<void> {
    const game = this.application.getCurrentGame()();
    if (!game) return;

    try {
      // Charger le subject si présent
      if (game.subject_id) {
        const { data: subjectData, error: subjectError } = await this.subjectsInfrastructure['supabase'].client
          .from('subjects')
          .select('id, name')
          .eq('id', game.subject_id)
          .single();

        if (!subjectError && subjectData) {
          this.currentSubject.set({ id: subjectData.id, name: subjectData.name });
        }
      }

      // Charger la category si présente
      if (game.subject_category_id) {
        const { data: categoryData, error: categoryError } = await this.subjectsInfrastructure['supabase'].client
          .from('subject_categories')
          .select('id, name')
          .eq('id', game.subject_category_id)
          .single();

        if (!categoryError && categoryData) {
          this.currentCategory.set({ id: categoryData.id, name: categoryData.name });
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données du breadcrumb:', error);
    }
  }

  goToCategory(): void {
    // Naviguer vers /subjects avec l'état pour sélectionner le subject
    const subject = this.currentSubject();
    if (subject) {
      this.router.navigate(['/subjects'], {
        state: { subjectId: subject.id }
      });
    } else {
      this.goToSubjects();
    }
  }

  goToGames(): void {
    // Naviguer vers /subjects avec l'état pour sélectionner la catégorie et afficher les jeux
    const category = this.currentCategory();
    const subject = this.currentSubject();
    if (category && subject) {
      this.router.navigate(['/subjects'], {
        state: { subjectId: subject.id, categoryId: category.id }
      });
    } else {
      this.goToSubjects();
    }
  }

  // Méthodes pour Case Vide - délégation au composant partagé
  canSubmitCaseVide(): boolean {
    if (this.caseVideGameComponent) {
      return this.caseVideGameComponent.canSubmit();
    }
    return false;
  }

  submitCaseVide(): void {
    if (this.caseVideGameComponent) {
      this.caseVideGameComponent.submitCaseVide();
    }
  }

  // Méthodes pour Liens - délégation au composant partagé
  canSubmitLiens(): boolean {
    if (this.liensGameComponent) {
      return this.liensGameComponent.canSubmit();
    }
    return false;
  }

  submitLiens(): void {
    if (this.liensGameComponent) {
      this.liensGameComponent.submitLiens();
    }
  }

  // Méthodes pour Vrai/Faux - délégation au composant partagé
  canSubmitVraiFaux(): boolean {
    if (this.vraiFauxGameComponent) {
      return this.vraiFauxGameComponent.canSubmit();
    }
    return false;
  }

  submitVraiFaux(): void {
    if (this.vraiFauxGameComponent) {
      this.vraiFauxGameComponent.submitVraiFaux();
    }
  }

  async onCaseVideValidated(isValid: boolean): Promise<void> {
    // Réinitialiser les compteurs avant chaque validation pour compter uniquement cette tentative
    // Cela permet de corriger le problème où les compteurs s'accumulent entre les tentatives
    this.correctAnswersCount.set(0);
    this.incorrectAnswersCount.set(0);
    
    this.showFeedback.set(true);
    
    // Compter le nombre réel de cases correctes/incorrectes
    const caseVideData = this.getCaseVideData();
    if (caseVideData?.cases_vides && this.caseVideGameComponent) {
      let correctCases = 0;
      let incorrectCases = 0;
      
      // Compter les cases correctes et incorrectes
      for (const caseVide of caseVideData.cases_vides) {
        const userAnswer = this.caseVideGameComponent.getWordInCase(caseVide.index);
        if (userAnswer) {
          const isCaseCorrect = userAnswer.toLowerCase().trim() === caseVide.reponse_correcte.toLowerCase().trim();
          if (isCaseCorrect) {
            correctCases++;
          } else {
            incorrectCases++;
          }
        } else {
          // Case non remplie = incorrecte
          incorrectCases++;
        }
      }
      
      // Ajouter les comptes réels
      this.correctAnswersCount.update(count => count + correctCases);
      this.incorrectAnswersCount.update(count => count + incorrectCases);
      
      // Stocker le dernier score validé pour la sauvegarde
      this.lastValidatedScore.set({ correct: correctCases, incorrect: incorrectCases });
      
      // Sauvegarder immédiatement le score partiel si la réponse est incorrecte
      if (!isValid) {
        const gameState = this.application.getGameState()();
        const startedAt = gameState?.startedAt || new Date();
        await this.application.savePartialScore(correctCases, incorrectCases, undefined, undefined, startedAt);
      }
    } else if (caseVideData?.reponse_valide) {
      // Format ancien : compter comme 1 tentative
      if (isValid) {
        this.correctAnswersCount.update(count => count + 1);
        this.lastValidatedScore.set({ correct: 1, incorrect: 0 });
      } else {
        this.incorrectAnswersCount.update(count => count + 1);
        this.lastValidatedScore.set({ correct: 0, incorrect: 1 });
        
        // Sauvegarder immédiatement le score partiel si la réponse est incorrecte
        const gameState = this.application.getGameState()();
        const startedAt = gameState?.startedAt || new Date();
        await this.application.savePartialScore(0, 1, undefined, undefined, startedAt);
      }
    }
    
    const feedbackData: FeedbackData = {
      isCorrect: isValid,
      message: '', // Le message sera géré par le composant GameFeedbackMessageComponent
      explanation: ''
    };
    this.feedback.set(feedbackData);
    
    // Jouer le son de feedback (succès ou échec)
    this.feedbackService.showFeedback(feedbackData);
    
    // Ne compléter le jeu que si la réponse est correcte
    if (isValid) {
      // Afficher immédiatement le modal de complétion
      await this.completeGame();
    } else {
      // Si la réponse est incorrecte, ne pas marquer le jeu comme complété
      this.gameCompleted.set(false);
      this.showCompletionScreen.set(false);
    }
  }

  async onLiensValidated(isValid: boolean): Promise<void> {
    // Réinitialiser les compteurs avant chaque validation pour compter uniquement cette tentative
    // Cela permet de corriger le problème où les compteurs s'accumulent entre les tentatives
    this.correctAnswersCount.set(0);
    this.incorrectAnswersCount.set(0);
    
    this.showFeedback.set(true);
    
    // Compter le nombre réel de liens corrects/incorrects
    const liensData = this.getLiensData();
    if (liensData && this.liensGameComponent) {
      let correctLiens = 0;
      let incorrectLiens = 0;
      
      // Récupérer les liens de l'utilisateur depuis le composant
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userLinks = (this.liensGameComponent as any).userLinks() as Map<string, string>;
      const userLinksArray = Array.from(userLinks.entries()).map((entry) => {
        const [mot, reponse] = entry;
        return { mot, reponse };
      });
      
      // Compter les liens corrects et incorrects
      // Pour chaque lien attendu, vérifier si l'utilisateur l'a créé correctement
      for (const correctLink of liensData.liens) {
        const userLink = userLinksArray.find(link => link.mot === correctLink.mot);
        if (userLink && userLink.reponse === correctLink.reponse) {
          correctLiens++;
        } else {
          // Lien incorrect ou manquant
          incorrectLiens++;
        }
      }
      
      // Compter aussi les liens créés par l'utilisateur qui ne sont pas dans la liste correcte
      // (liens supplémentaires incorrects)
      for (const userLink of userLinksArray) {
        const isInCorrectList = liensData.liens.some(correct => 
          correct.mot === userLink.mot && correct.reponse === userLink.reponse
        );
        if (!isInCorrectList) {
          // Ce lien n'est pas dans la liste correcte
          // Vérifier si on l'a déjà compté (lien incorrect pour un mot attendu)
          const isMotInCorrectList = liensData.liens.some(correct => correct.mot === userLink.mot);
          if (!isMotInCorrectList) {
            // Ce mot n'est même pas dans la liste attendue, c'est un lien supplémentaire incorrect
            incorrectLiens++;
          }
          // Si le mot est dans la liste mais avec une mauvaise réponse, on l'a déjà compté dans la boucle précédente
        }
      }
      
      // Ajouter les comptes réels
      this.correctAnswersCount.update(count => count + correctLiens);
      this.incorrectAnswersCount.update(count => count + incorrectLiens);
      
      // Stocker le dernier score validé pour la sauvegarde
      this.lastValidatedScore.set({ correct: correctLiens, incorrect: incorrectLiens });
    } else {
      // Fallback : compter comme 1 tentative
      if (isValid) {
        this.correctAnswersCount.update(count => count + 1);
        this.lastValidatedScore.set({ correct: 1, incorrect: 0 });
      } else {
        this.incorrectAnswersCount.update(count => count + 1);
        this.lastValidatedScore.set({ correct: 0, incorrect: 1 });
      }
    }
    
    const feedbackData: FeedbackData = {
      isCorrect: isValid,
      message: '', // Le message sera géré par le composant GameFeedbackMessageComponent
      explanation: ''
    };
    this.feedback.set(feedbackData);
    
    // Jouer le son de feedback (succès ou échec)
    this.feedbackService.showFeedback(feedbackData);
    
    // Ne compléter le jeu que si la réponse est correcte
    if (isValid) {
      // Afficher immédiatement le modal de complétion
      await this.completeGame();
    } else {
      // Si la réponse est incorrecte, ne pas marquer le jeu comme complété
      // et ne pas afficher le modal de complétion
      this.gameCompleted.set(false);
      this.showCompletionScreen.set(false);
    }
  }

  async onVraiFauxValidated(isValid: boolean): Promise<void> {
    // Réinitialiser les compteurs avant chaque validation pour compter uniquement cette tentative
    // Cela permet de corriger le problème où les compteurs s'accumulent entre les tentatives
    this.correctAnswersCount.set(0);
    this.incorrectAnswersCount.set(0);
    
    this.showFeedback.set(true);
    
    // Compter le nombre réel d'énoncés corrects/incorrects
    const vraiFauxData = this.getVraiFauxData();
    if (vraiFauxData && this.vraiFauxGameComponent) {
      let correctEnonces = 0;
      let incorrectEnonces = 0;
      
      // Récupérer les réponses de l'utilisateur depuis le composant
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userAnswers = (this.vraiFauxGameComponent as any).userAnswers() as Map<number, boolean>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enonces = (this.vraiFauxGameComponent as any).getVraiFauxEnonces() as { texte: string; reponse_correcte: boolean }[];
      
      // Compter les énoncés corrects et incorrects
      for (let i = 0; i < enonces.length; i++) {
        const enonce = enonces[i];
        const userAnswer = userAnswers.get(i);
        if (userAnswer !== undefined) {
          if (userAnswer === enonce.reponse_correcte) {
            correctEnonces++;
          } else {
            incorrectEnonces++;
          }
        } else {
          // Énoncé sans réponse = incorrect
          incorrectEnonces++;
        }
      }
      
      // Ajouter les comptes réels
      this.correctAnswersCount.update(count => count + correctEnonces);
      this.incorrectAnswersCount.update(count => count + incorrectEnonces);
      
      // Stocker le dernier score validé pour la sauvegarde
      this.lastValidatedScore.set({ correct: correctEnonces, incorrect: incorrectEnonces });
      
      // Sauvegarder immédiatement le score partiel si la réponse est incorrecte
      if (!isValid) {
        const gameState = this.application.getGameState()();
        const startedAt = gameState?.startedAt || new Date();
        await this.application.savePartialScore(correctEnonces, incorrectEnonces, undefined, undefined, startedAt);
      }
    } else {
      // Fallback : compter comme 1 tentative
      if (isValid) {
        this.correctAnswersCount.update(count => count + 1);
        this.lastValidatedScore.set({ correct: 1, incorrect: 0 });
      } else {
        this.incorrectAnswersCount.update(count => count + 1);
        this.lastValidatedScore.set({ correct: 0, incorrect: 1 });
        
        // Sauvegarder immédiatement le score partiel si la réponse est incorrecte
        const gameState = this.application.getGameState()();
        const startedAt = gameState?.startedAt || new Date();
        await this.application.savePartialScore(0, 1, undefined, undefined, startedAt);
      }
    }
    
    const feedbackData: FeedbackData = {
      isCorrect: isValid,
      message: '', // Le message sera géré par le composant GameFeedbackMessageComponent
      explanation: ''
    };
    this.feedback.set(feedbackData);
    
    // Jouer le son de feedback (succès ou échec)
    this.feedbackService.showFeedback(feedbackData);
    
    // Ne compléter le jeu que si la réponse est correcte
    if (isValid) {
      // Afficher immédiatement le modal de complétion
      await this.completeGame();
    } else {
      // Si la réponse est incorrecte, ne pas marquer le jeu comme complété
      this.gameCompleted.set(false);
      this.showCompletionScreen.set(false);
    }
  }

  selectAnswer(index: number): void {
    if (this.showFeedback()) return;
    this.selectedAnswer.set(index);
  }

  // Méthodes pour obtenir les compteurs selon le type de jeu
  getCorrectCountForDisplay(): number {
    // Pour les jeux génériques, utiliser le score du GameState
    if (this.isGenericGame()) {
      const gameState = this.application.getGameState()();
      return gameState?.score ?? 0;
    }
    // Pour les jeux spécifiques, utiliser les compteurs
    return this.correctAnswersCount();
  }

  getIncorrectCountForDisplay(): number {
    // Pour les jeux génériques, calculer : totalQuestions - score
    if (this.isGenericGame()) {
      const gameState = this.application.getGameState()();
      if (!gameState || !gameState.questions) return 0;
      const totalQuestions = gameState.questions.length;
      const score = gameState.score ?? 0;
      return totalQuestions - score;
    }
    // Pour les jeux spécifiques, utiliser les compteurs
    return this.incorrectAnswersCount();
  }


  async onGameValidated(isCorrect: boolean): Promise<void> {
    // Gérer la validation des jeux spécifiques
    this.showFeedback.set(true);
    
    // Compter la réponse après validation
    if (isCorrect) {
      this.correctAnswersCount.update(count => count + 1);
    } else {
      this.incorrectAnswersCount.update(count => count + 1);
    }
    
    // Stocker le dernier score validé pour la sauvegarde
    const correct = this.correctAnswersCount();
    const incorrect = this.incorrectAnswersCount();
    this.lastValidatedScore.set({ correct, incorrect });
    
    const feedbackData: FeedbackData = {
      isCorrect,
      message: '', // Le message sera géré par le composant GameFeedbackMessageComponent
      explanation: ''
    };
    this.feedback.set(feedbackData);
    
    // Jouer le son de feedback (succès ou échec)
    this.feedbackService.showFeedback(feedbackData);
    
    // Pour les jeux spécifiques, on considère qu'il n'y a qu'une seule "question"
    // donc on passe directement à la fin du jeu si correct
    if (isCorrect) {
      // Afficher immédiatement le modal de complétion
      await this.completeGame();
    }
  }

  async submitAnswer(): Promise<void> {
    // Note: Les jeux spécifiques (y compris réponse libre) gèrent leur propre validation
    // via l'événement (validated) qui appelle onGameValidated()

    // Gérer les réponses à choix multiples
    if (this.selectedAnswer() === null) return;

    const question = this.application.getCurrentQuestion()();
    if (!question) return;

    this.correctAnswer.set(question.correctAnswer);
    const result = await this.application.submitAnswer(this.selectedAnswer()!);
    
    // Pour les jeux génériques, le score est géré par le GameState
    // Pas besoin de compter manuellement, le computed utilisera gameState.score
    
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
      this.showAides.set(false); // Réinitialiser le toggle des aides
    }
  }

  async completeGame(): Promise<void> {
    try {
      // Marquer le jeu comme complété
      this.gameCompleted.set(true);
      
      const game = this.application.getCurrentGame()();
      const child = this.childAuthService.getCurrentChild();
      const childId = child?.child_id;
      
      // Réinitialiser l'étoile au début pour éviter d'afficher une étoile d'un jeu précédent
      this.starEarned.set(false);
      
      // IMPORTANT : Récupérer le completion_percentage AVANT de sauvegarder le score du jeu actuel
      // pour détecter correctement une nouvelle étoile quand un nouveau jeu est ajouté
      // On calcule la progression AVEC tous les jeux (y compris le nouveau non complété)
      // Exemple : si 2/3 jeux complétés avant, puis 3/3 après → nouvelle étoile
      let previousCompletionPercentage = 0;
      let isCategory = false;
      let entityId: string | null = null;
      
      if (childId && game) {
        if (game.subject_category_id) {
          // Pour une sous-matière
          isCategory = true;
          entityId = game.subject_category_id;
          // Calculer AVANT que le jeu actuel soit sauvegardé (le jeu actuel n'est pas encore complété dans la DB)
          // Cela donne la progression réelle avant la complétion (ex: 2/3 = 66% si 2 jeux complétés sur 3)
          previousCompletionPercentage = await this.progression.calculateCategoryCompletionPercentage(childId, game.subject_category_id);
          this.starType.set('category');
          this.starColor.set('gold');
        } else if (game.subject_id) {
          // Pour une matière principale
          isCategory = false;
          entityId = game.subject_id;
          // Calculer AVANT que le jeu actuel soit sauvegardé
          previousCompletionPercentage = await this.progression.calculateSubjectCompletionPercentage(childId, game.subject_id);
          this.starType.set('subject');
          this.starColor.set('silver');
        }
      }
      
      // NOUVEAU : Calculer les données nécessaires pour le modal AVANT d'appeler completeGame()
      const gameState = this.application.getGameState()();
      const normalizedGameType = normalizeGameType(game?.game_type);
      const isSpecificGame = SPECIFIC_GAME_TYPES.some(type => normalizeGameType(type) === normalizedGameType);
      
      // Calculer le score individuel du jeu
      let individualScore = 0;
      if (isSpecificGame) {
        individualScore = 100;
      } else if (gameState && gameState.questions && gameState.questions.length > 0) {
        const totalQuestions = gameState.questions.length;
        const score = gameState.score;
        individualScore = Math.round((score / totalQuestions) * 100);
      } else {
        individualScore = 100;
      }
      
      this.finalScore.set(individualScore);
      
      // Charger la progression actuelle pour le message (rapide)
      await this.loadCategoryProgress();
      const initialProgress = this.categoryProgress();
      
      // Chercher le prochain jeu (rapide)
      await this.findNextGame();
      
      // Calculer le message initial
      const isSubject = game && !game.subject_category_id && game.subject_id;
      const entityName = isSubject ? 'matière' : 'catégorie';
      
      const updateMessage = (progress: number) => {
        if (progress === 100) {
          this.completionMessage.set(`🎉 Félicitations ! Tu as terminé tous les jeux de cette ${entityName} ! 🏆`);
        } else if (progress >= 80) {
          this.completionMessage.set(`Excellent ! Tu as complété ${progress}% de cette ${entityName} ! ⭐`);
        } else if (progress >= 50) {
          this.completionMessage.set(`Bien joué ! Tu as complété ${progress}% de cette ${entityName} ! 👍`);
        } else {
          this.completionMessage.set(`Continue ! Tu as complété ${progress}% de cette ${entityName}. 💪`);
        }
      };
      
      // Afficher le message initial
      updateMessage(initialProgress);
      
      // AFFICHER LE MODAL IMMÉDIATEMENT (avant les opérations lourdes)
      this.showCompletionScreen.set(true);
      
      // NOUVEAU : Exécuter completeGame() puis recharger la progression
      // Cela va sauvegarder, vérifier les badges, etc.
      // IMPORTANT : Passer previousCompletionPercentage à completeGame() pour détecter correctement
      // les nouvelles complétions quand un nouveau jeu est ajouté
      this.application.completeGame(previousCompletionPercentage)
        .then(async () => {
          // Attendre un peu pour que la base de données soit à jour
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Recharger la progression APRÈS que le jeu soit complété pour avoir la valeur à jour
          await this.loadCategoryProgress();
          const updatedProgress = this.categoryProgress();
          
          // Mettre à jour le message avec la nouvelle progression
          updateMessage(updatedProgress);
          
          // Vérifier les étoiles APRÈS que completeGame() soit terminé
          // Utiliser la progression déjà chargée dans categoryProgress() au lieu de recharger
          await this.checkStarEarned(childId, entityId, isCategory, game, previousCompletionPercentage, updatedProgress);
        })
        .catch(error => {
          console.error('Erreur lors de la complétion du jeu:', error);
        });
      
      // Recharger le score total en arrière-plan (non-bloquant)
      this.loadTotalScore().catch(error => {
        console.error('Erreur lors du chargement du score total:', error);
      });
      
    } catch (error) {
      // En cas d'erreur, afficher quand même le modal avec un message par défaut
      console.error('Erreur lors de la complétion du jeu:', error);
      this.finalScore.set(100);
      this.completionMessage.set('🎉 Jeu terminé ! 🏆');
      this.showCompletionScreen.set(true);
    }
  }

  /**
   * Vérifie si une étoile a été gagnée (exécuté en arrière-plan)
   * @param currentCompletionPercentage - La progression actuelle déjà chargée (optionnel, sera chargée si non fournie)
   */
  private async checkStarEarned(
    childId: string | undefined,
    entityId: string | null,
    isCategory: boolean,
    game: Game | null,
    previousCompletionPercentage: number,
    currentCompletionPercentage?: number
  ): Promise<void> {
    if (!childId || !entityId || !game) {
      return;
    }
    
    // Utiliser la progression fournie ou la charger si non fournie
    let currentProgress = currentCompletionPercentage;
    
    if (currentProgress === undefined) {
      // Fallback : charger la progression si elle n'a pas été fournie
      if (isCategory && game.subject_category_id) {
        currentProgress = await this.progression.calculateCategoryCompletionPercentage(childId, game.subject_category_id);
      } else if (!isCategory && game.subject_id) {
        currentProgress = await this.progression.calculateSubjectCompletionPercentage(childId, game.subject_id);
      } else {
        currentProgress = 0;
      }
    }
    
    const wasNotCompleted = previousCompletionPercentage < 100;
    const isNowCompleted = currentProgress >= 100;
    
    console.log('⭐ [STAR] Vérification étoile:', {
      previousCompletionPercentage,
      currentProgress,
      wasNotCompleted,
      isNowCompleted,
      isCategory,
      entityId,
      gameId: game.id,
      gameName: game.name
    });
    
    // Détecter une nouvelle étoile si on passe de < 100% à 100%
    // Cela permet de détecter quand un nouveau jeu est ajouté et complété
    if (wasNotCompleted && isNowCompleted) {
      console.log('⭐ [STAR] Étoile gagnée ! Passage de', previousCompletionPercentage, '% à', currentProgress, '%');
      this.starEarned.set(true);
      
      if (isCategory && game.subject_category_id) {
        this.sessionStarService.markStarAsNew('category', game.subject_category_id);
        console.log('⭐ [STAR] Étoile marquée comme nouvelle pour catégorie:', game.subject_category_id);
      } else if (!isCategory && game.subject_id) {
        this.sessionStarService.markStarAsNew('subject', game.subject_id);
        console.log('⭐ [STAR] Étoile marquée comme nouvelle pour matière:', game.subject_id);
      }
    } else {
      console.log('⭐ [STAR] Pas de nouvelle étoile. Raison:', {
        wasNotCompleted,
        isNowCompleted,
        previousWas100: previousCompletionPercentage >= 100,
        currentIs100: currentProgress >= 100
      });
      this.starEarned.set(false);
    }
  }

  async findNextGame(): Promise<void> {
    const currentGame = this.application.getCurrentGame()();
    if (!currentGame) {
      this.hasNextGame.set(false);
      this.nextGameId.set(null);
      return;
    }

    try {
      // Récupérer le childId pour le filtrage
      const child = this.childAuthService.getCurrentChild();
      const childId = child?.child_id;
      
      let games: Game[] = [];
      
      // Si le jeu est lié à une catégorie, charger les jeux de cette catégorie
      if (currentGame.subject_category_id) {
        games = await this.subjectsInfrastructure.loadGamesByCategory(currentGame.subject_category_id, childId);
      } 
      // Sinon, si le jeu est lié directement à une matière, charger les jeux de cette matière
      else if (currentGame.subject_id) {
        games = await this.subjectsInfrastructure.loadGamesBySubject(currentGame.subject_id, childId);
      }
      
      // Filtrer le jeu actuel et les jeux résolus (score = 100%) de la liste
      games = games.filter(g => g.id !== currentGame.id);
      
      // Récupérer les scores pour exclure les jeux résolus
      if (childId && games.length > 0) {
        const gameIds = games.map(g => g.id);
        const scores = await this.subjectsInfrastructure.getGameScores(childId, gameIds);
        // Ne garder que les jeux non résolus (score !== 100)
        games = games.filter(game => scores.get(game.id) !== 100);
      }
      
      if (games.length === 0) {
        // Tous les jeux sont résolus ou il n'y a plus de jeux
        this.hasNextGame.set(false);
        this.nextGameId.set(null);
        return;
      }
      
      // Sélectionner le premier jeu de la liste (qui est déjà mélangée aléatoirement)
      const nextGame = games[0];
      this.nextGameId.set(nextGame.id);
      this.hasNextGame.set(true);
    } catch (error) {
      console.error('Erreur lors de la recherche du prochain jeu:', error);
      this.hasNextGame.set(false);
      this.nextGameId.set(null);
    }
  }

  async goToNextGame(): Promise<void> {
    const nextId = this.nextGameId();
    if (nextId) {
      // Sauvegarder l'ID avant de réinitialiser pour éviter une condition de course
      const targetGameId = nextId;
      
      // IMPORTANT: Sauvegarder le score partiel AVANT de réinitialiser les signaux
      // pour éviter de sauvegarder des données pour le mauvais jeu lors de la navigation
      await this.savePartialScoreIfNeeded();
      
      // Réinitialiser l'état du jeu actuel
      this.selectedAnswer.set(null);
      this.showFeedback.set(false);
      this.feedback.set(null);
      this.correctAnswer.set(null);
      this.showCompletionScreen.set(false);
      this.gameCompleted.set(false);
      this.finalScore.set(0);
      this.completionMessage.set('');
      this.hasNextGame.set(false);
      this.nextGameId.set(null);
      this.categoryProgress.set(0); // Réinitialiser temporairement, sera rechargé dans loadGame()
      
      // Réinitialiser aussi les compteurs pour éviter qu'ils soient utilisés avec le nouveau jeu
      this.correctAnswersCount.set(0);
      this.incorrectAnswersCount.set(0);
      this.lastValidatedScore.set(null);
      
      // Naviguer vers le prochain jeu
      // La subscription à route.paramMap détectera le changement et appellera loadGame()
      await this.router.navigate(['/game', targetGameId]);
    }
  }

  /**
   * Passe au jeu suivant ou retourne aux matières si pas de prochain jeu
   * Ne marque PAS le jeu actuel comme complété si la réponse est incorrecte
   */
  onNextButtonClick(): void {
    this.goToNextGameOrSubjects();
  }

  async goToNextGameOrSubjects(): Promise<void> {
    // Sauvegarder le score partiel si le jeu n'a pas été complété et qu'il y a eu des tentatives
    await this.savePartialScoreIfNeeded();
    
    // Réinitialiser l'animation d'étoile
    this.starEarned.set(false);
    
    // Si la réponse était correcte, on a déjà cherché le prochain jeu dans completeGame()
    // Sinon, chercher le prochain jeu maintenant
    if (!this.feedback()?.isCorrect) {
      await this.findNextGame();
    }
    
    const nextId = this.nextGameId();
    
    if (nextId) {
      // Naviguer vers le prochain jeu
      await this.goToNextGame();
    } else {
      // Pas de prochain jeu, retourner aux matières
      this.goToSubjects();
    }
  }

  /**
   * Sauvegarde le score partiel si le jeu n'a pas été complété et qu'il y a eu des tentatives
   */
  private async savePartialScoreIfNeeded(): Promise<void> {
    // Ne sauvegarder que si le jeu n'a pas été complété
    if (this.gameCompleted()) {
      return;
    }

    const game = this.application.getCurrentGame()();
    if (!game) {
      return;
    }

    // IMPORTANT: Vérifier que le gameId correspond bien à l'ID du jeu actuel dans la route
    // pour éviter de sauvegarder pour le mauvais jeu lors de la navigation
    const routeGameId = this.route.snapshot.paramMap.get('id');
    if (routeGameId && routeGameId !== game.id) {
      // Le jeu dans le store ne correspond pas au jeu dans la route
      // Cela peut arriver pendant la navigation, ne pas sauvegarder dans ce cas
      console.warn(`[savePartialScoreIfNeeded] Jeu dans le store (${game.id}) ne correspond pas au jeu dans la route (${routeGameId}), annulation de la sauvegarde`);
      return;
    }

    const normalizedGameType = normalizeGameType(game.game_type);
    const isSpecificGame = SPECIFIC_GAME_TYPES.some(type => normalizeGameType(type) === normalizedGameType);
    
    const gameState = this.application.getGameState()();
    const startedAt = gameState?.startedAt || new Date();

    if (isSpecificGame) {
      // Pour les jeux spécifiques, utiliser le dernier score validé si disponible
      // car les compteurs peuvent être réinitialisés après la validation
      const lastScore = this.lastValidatedScore();
      const correctDisplay = this.getCorrectCountForDisplay();
      const incorrectDisplay = this.getIncorrectCountForDisplay();
      const correct = this.correctAnswersCount();
      const incorrect = this.incorrectAnswersCount();
      
      // Priorité : dernier score validé > display > compteurs directs
      let finalCorrect: number;
      let finalIncorrect: number;
      
      if (lastScore && (lastScore.correct > 0 || lastScore.incorrect > 0)) {
        finalCorrect = lastScore.correct;
        finalIncorrect = lastScore.incorrect;
      } else if (correctDisplay + incorrectDisplay > 0) {
        finalCorrect = correctDisplay;
        finalIncorrect = incorrectDisplay;
      } else if (correct + incorrect > 0) {
        finalCorrect = correct;
        finalIncorrect = incorrect;
      } else {
        return;
      }
      
      const finalTotal = finalCorrect + finalIncorrect;
      
      // Sauvegarder seulement si il y a eu des tentatives
      if (finalTotal > 0) {
        await this.application.savePartialScore(finalCorrect, finalIncorrect, undefined, undefined, startedAt);
      }
    } else {
      // Pour les jeux génériques, utiliser le GameState
      if (gameState && gameState.questions && gameState.questions.length > 0) {
        const score = gameState.score || 0;
        const totalQuestions = gameState.questions.length;
        
        // Sauvegarder seulement si il y a eu au moins une question répondue
        if (gameState.currentQuestionIndex > 0 || score > 0) {
          await this.application.savePartialScore(undefined, undefined, score, totalQuestions, startedAt);
        }
      }
    }
  }

  /**
   * Passe à la question suivante ou au jeu suivant sans validation
   * Permet à l'utilisateur de ne pas rester bloqué sur une question qu'il ne peut pas résoudre
   */
  async skipQuestion(): Promise<void> {
    // Pour les jeux génériques avec questions, passer à la question suivante
    if (this.isGenericGame()) {
      const hasNext = await this.application.nextQuestion();
      if (!hasNext) {
        // Plus de questions, compléter le jeu
        await this.completeGame();
      } else {
        // Réinitialiser l'état pour la prochaine question
        this.selectedAnswer.set(null);
        this.showFeedback.set(false);
        this.feedback.set(null);
        this.correctAnswer.set(null);
        this.showAides.set(false);
      }
    } else {
      // Pour les jeux spécifiques, passer au jeu suivant
      await this.findNextGame();
      const nextId = this.nextGameId();
      
      if (nextId) {
        // Naviguer vers le prochain jeu
        await this.goToNextGame();
      } else {
        // Pas de prochain jeu, retourner aux matières
        this.goToSubjects();
      }
    }
  }

  isGameCompleted(): boolean {
    const result = this.gameCompleted() || this.application.getGameState()()?.isCompleted || false;
    return result;
  }

  async finishGame(): Promise<void> {
    // Sauvegarder le score partiel avant de quitter
    await this.savePartialScoreIfNeeded();
    await this.goToSubjects();
  }

  async goToSubjects(): Promise<void> {
    // Sauvegarder le score partiel avant de quitter
    await this.savePartialScoreIfNeeded();
    // Réinitialiser l'animation d'étoile
    this.starEarned.set(false);
    this.router.navigate(['/subjects']);
  }

  /**
   * Gère la fermeture du modal de complétion
   * Ferme le modal et déclenche l'affichage des badges en attente
   */
  onCompletionModalClose(): void {
    this.showCompletionScreen.set(false);
    
    // Après la fermeture du modal de complétion, afficher les badges en attente
    // Utiliser setTimeout pour laisser le temps à l'animation de fermeture de se terminer
    setTimeout(() => {
      this.badgeNotification.processNextBadgeInQueue();
    }, 300); // Délai pour l'animation de fermeture
  }

  async goBack(): Promise<void> {
    // Sauvegarder le score partiel avant de quitter
    await this.savePartialScoreIfNeeded();
    this.router.navigate(['/subjects']);
  }

  async restartGame(): Promise<void> {
    const gameId = this.route.snapshot.paramMap.get('id');
    if (gameId) {
      // Réinitialiser l'état du composant parent
      // IMPORTANT: showFeedback doit être réinitialisé en premier pour que disabled soit false
      this.showFeedback.set(false);
      this.selectedAnswer.set(null);
      this.feedback.set(null);
      this.correctAnswer.set(null);
      this.showCompletionScreen.set(false);
      this.gameCompleted.set(false);
      this.finalScore.set(0);
      this.completionMessage.set('');
      this.showAides.set(false);
      
      // Réinitialiser les compteurs pour repartir à zéro lors d'un réessai
      this.correctAnswersCount.set(0);
      this.incorrectAnswersCount.set(0);
      
      // Pour les jeux génériques, le score est géré par le GameState (remis à zéro automatiquement)
      
      // Recharger le jeu depuis la base de données
      // Les composants enfants seront réinitialisés via l'événement resetRequested
      await this.application.initializeGame(gameId);
    }
  }

  /**
   * Réinitialise l'état du jeu sans recharger depuis la base de données
   * Note: restartGame() doit être utilisé à la place pour recharger le jeu depuis la base
   */
  resetGameState(): void {
    this.selectedAnswer.set(null);
    this.showFeedback.set(false);
    this.feedback.set(null);
    this.correctAnswer.set(null);
    this.showCompletionScreen.set(false);
    this.gameCompleted.set(false);
    this.finalScore.set(0);
    this.completionMessage.set('');
    this.showAides.set(false); // Réinitialiser le toggle des aides
  }
}

