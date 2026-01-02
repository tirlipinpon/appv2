import { Component, inject, OnInit, OnDestroy, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { GameApplication } from './components/application/application';
import { ChildButtonComponent } from '../../shared/components/child-button/child-button.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar.component';
import { CompletionModalComponent, CompletionModalAction } from '../../shared/components/completion-modal/completion-modal.component';
import { FeedbackData } from './services/feedback.service';
import { QcmGameComponent, ChronologieGameComponent, MemoryGameComponent, SimonGameComponent, ImageInteractiveGameComponent, CaseVideGameComponent, LiensGameComponent, VraiFauxGameComponent } from '@shared/games';
import type { QcmData, ChronologieData, MemoryData, SimonData, ImageInteractiveData, ReponseLibreData, CaseVideData, LiensData, VraiFauxData } from '@shared/games';
import { LetterByLetterInputComponent } from '@shared/components/letter-by-letter-input/letter-by-letter-input.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../shared/components/breadcrumb/breadcrumb.component';
import { SubjectsInfrastructure } from '../subjects/components/infrastructure/infrastructure';
import { ChildAuthService } from '../../core/auth/child-auth.service';
import { ProgressionService } from '../../core/services/progression/progression.service';
import type { Game } from '../../core/types/game.types';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, ChildButtonComponent, ProgressBarComponent, CompletionModalComponent, QcmGameComponent, ChronologieGameComponent, MemoryGameComponent, SimonGameComponent, ImageInteractiveGameComponent, CaseVideGameComponent, LiensGameComponent, VraiFauxGameComponent, LetterByLetterInputComponent, BreadcrumbComponent],
  template: `
    <div class="game-container">
      <!-- Breadcrumb -->
      <app-breadcrumb [items]="breadcrumbItems()" />
      
      <div *ngIf="application.isLoading()()" class="loading">
        Chargement du jeu...
      </div>

      <div *ngIf="application.getError()()" class="error">
        {{ application.getError()() }}
      </div>

      <!-- Debug: Afficher les infos du jeu si chargé mais pas de contenu -->
      <div *ngIf="!application.isLoading()() && !application.getError()() && application.getCurrentGame()() && !gameData() && !isGenericGame()" class="error">
        <p>Jeu chargé mais données manquantes.</p>
        <p>Type de jeu: {{ gameType() || 'non défini' }}</p>
        <p>Jeu: {{ application.getCurrentGame()()?.name || 'sans nom' }}</p>
        <p>game_data_json: {{ application.getCurrentGame()()?.game_data_json ? 'présent mais vide/null' : 'absent' }}</p>
        <details>
          <summary>Détails du jeu (cliquez pour voir)</summary>
          <pre>{{ application.getCurrentGame()() | json }}</pre>
        </details>
      </div>

      <div *ngIf="!application.isLoading()() && !application.getError()() && application.getCurrentGame()() && (gameData() || isGenericGame())" class="game-content">
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
            <app-progress-bar
              [value]="categoryProgress()"
              [max]="100"
              [label]="'Progression'"
              variant="primary">
            </app-progress-bar>
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
            [instructions]="application.getCurrentGame()()?.instructions || null"
            [question]="application.getCurrentGame()()?.question || null"
            (validated)="onVraiFauxValidated($event)"
            (resetRequested)="restartGame()"
            (nextRequested)="onNextButtonClick()">
          </app-vrai-faux-game>
        } @else if (gameType() === 'reponse_libre' && gameData()) {
          <!-- Jeu réponse libre -->
          <div class="question-container">
            <h2 class="question-text">
              {{ application.getCurrentGame()()?.question || application.getCurrentGame()()?.instructions || 'Répondez à la question' }}
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
          <div class="reponse-libre-container">
            <app-letter-by-letter-input
              [targetWord]="getReponseLibreReponseValide()"
              [allowHyphen]="true"
              [disabled]="showFeedback()"
              (wordChange)="onReponseLibreWordChange($event)"
              (wordComplete)="onReponseLibreWordComplete()">
            </app-letter-by-letter-input>
          </div>
        } @else if (isGenericGame() && application.getCurrentQuestion()()) {
          <!-- Jeux génériques avec questions/réponses -->
          <div class="game-info-container" *ngIf="application.getCurrentGame()()">
            @if (application.getCurrentGame()()!.name) {
              <h1 class="game-name">{{ application.getCurrentGame()()!.name }}</h1>
            }
            @if (application.getCurrentGame()()!.instructions) {
              <p class="game-instructions">{{ application.getCurrentGame()()!.instructions }}</p>
            }
          </div>
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
        }

        <!-- Feedback -->
        <div *ngIf="showFeedback() && feedback()" class="feedback-container" [class.correct]="feedback()?.isCorrect" [class.incorrect]="!feedback()?.isCorrect">
          <div class="feedback-message">
            {{ feedback()?.message }}
          </div>
          <div *ngIf="feedback()?.explanation" class="feedback-explanation">
            {{ feedback()?.explanation }}
          </div>
        </div>

        <!-- Boutons d'action - Masqués si le jeu est complété (le modal gère la navigation) -->
        <div class="actions-container" *ngIf="!isGameCompleted() || !showCompletionScreen()">
          <app-child-button
            *ngIf="!showFeedback() && (selectedAnswer() !== null || isGenericGame() || (gameType() === 'reponse_libre' && reponseLibreInput().trim().length > 0) || (isCaseVideGame() && canSubmitCaseVide()) || (isLiensGame() && canSubmitLiens()) || (isVraiFauxGame() && canSubmitVraiFaux()))"
            (buttonClick)="isCaseVideGame() ? submitCaseVide() : (isLiensGame() ? submitLiens() : (isVraiFauxGame() ? submitVraiFaux() : submitAnswer()))"
            variant="primary"
            size="large">
            Valider
          </app-child-button>
          <!-- Bouton "Réessayer" pour les jeux spécifiques avec réponse incorrecte - masqué car géré par game-error-actions -->
          <!-- Bouton "Question suivante" pour les jeux génériques -->
          <app-child-button
            *ngIf="showFeedback() && !isGameCompleted() && isGenericGame()"
            (buttonClick)="goToNextQuestion()"
            variant="primary"
            size="large">
            Question suivante
          </app-child-button>
        </div>
      </div>

      <!-- Modal de fin de jeu -->
      <app-completion-modal
        [visible]="isGameCompleted() && showCompletionScreen()"
        [title]="'🎉 Jeu terminé !'"
        [score]="categoryProgress()"
        [scoreLabel]="'Progression'"
        [message]="completionMessage()"
        [actions]="completionActions()"
        (overlayClick)="goToSubjects()">
      </app-completion-modal>
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly subjectsInfrastructure = inject(SubjectsInfrastructure);
  private readonly childAuthService = inject(ChildAuthService);
  private readonly progression = inject(ProgressionService);
  private routeSubscription?: Subscription;

  selectedAnswer = signal<number | null>(null);
  reponseLibreInput = signal<string>('');
  showFeedback = signal<boolean>(false);
  feedback = signal<FeedbackData | null>(null);
  correctAnswer = signal<number | null>(null);
  finalScore = signal<number>(0);
  completionMessage = signal<string>('');
  showCompletionScreen = signal<boolean>(false);
  gameCompleted = signal<boolean>(false);
  categoryProgress = signal<number>(0); // Progression globale de la catégorie
  totalScore = signal<number>(0); // Score total (nombre de jeux résolus avec score 100%)
  
  // État pour afficher/masquer les aides (pour les jeux génériques et reponse_libre)
  showAides = signal<boolean>(false);


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
        action: () => this.goToNextGame()
      });
    }
    
    // Ajouter les autres actions
    actions.push(
      {
        label: 'Retour aux matières',
        variant: this.hasNextGame() ? 'secondary' : 'primary',
        action: () => this.goToSubjects()
      },
      {
        label: 'Rejouer',
        variant: 'secondary',
        action: () => this.restartGame()
      }
    );
    
    return actions;
  });

  // Computed pour déterminer le type de jeu et les données
  gameType = computed(() => {
    const game = this.application.getCurrentGame()();
    return game?.game_type || null;
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
  isQcmGame = computed(() => this.gameType() === 'qcm');
  isChronologieGame = computed(() => this.gameType() === 'chronologie');
  isMemoryGame = computed(() => this.gameType() === 'memory');
  isSimonGame = computed(() => this.gameType() === 'simon');
  isImageInteractiveGame = computed(() => {
    const type = this.gameType();
    return type === 'image_interactive' || type === 'click';
  });
  isCaseVideGame = computed(() => {
    const type = this.gameType();
    return type === 'case_vide' || type === 'case vide';
  });
  isLiensGame = computed(() => {
    const type = this.gameType();
    return type === 'liens' || type === 'lien';
  });
  isVraiFauxGame = computed(() => {
    const type = this.gameType();
    return type === 'vrai_faux' || type === 'vrai/faux' || type === 'vrai faux' || type === 'vrais faux';
  });
  isGenericGame = computed(() => {
    const type = this.gameType();
    return type && !['qcm', 'chronologie', 'memory', 'simon', 'image_interactive', 'click', 'case_vide', 'case vide', 'liens', 'lien', 'vrai_faux', 'vrai/faux', 'vrai faux', 'vrais faux'].includes(type);
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
    return data && this.gameType() === 'reponse_libre' ? (data as unknown as ReponseLibreData) : null;
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
    this.reponseLibreInput.set('');
    this.showAides.set(false);
    
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
    
    if (!childId || !game?.subject_category_id) {
      this.categoryProgress.set(0);
      return;
    }
    
    try {
      const progress = await this.progression.calculateCategoryCompletionPercentage(childId, game.subject_category_id);
      this.categoryProgress.set(progress);
    } catch (error) {
      console.error('Erreur lors du chargement de la progression:', error);
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
    this.showFeedback.set(true);
    const caseVideData = this.getCaseVideData();
    let message = '';
    let explanation = '';
    
    if (caseVideData?.texte && caseVideData.cases_vides) {
      // Nouveau format
      message = isValid ? 'Bravo ! Toutes les réponses sont correctes ! ✅' : 'Certaines réponses sont incorrectes. ❌';
      // Ne pas afficher les bonnes réponses si la réponse est incorrecte
      explanation = '';
    } else if (caseVideData?.debut_phrase && caseVideData.fin_phrase && caseVideData.reponse_valide) {
      // Ancien format
      message = isValid ? 'Bravo ! Bonne réponse ! ✅' : 'Ce n\'est pas la bonne réponse. ❌';
      // Ne pas afficher les bonnes réponses si la réponse est incorrecte
      explanation = '';
    }
    
    const feedbackData: FeedbackData = {
      isCorrect: isValid,
      message,
      explanation
    };
    this.feedback.set(feedbackData);
    
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
    this.showFeedback.set(true);
    const message = isValid ? 'Bravo ! Tous les liens sont corrects ! ✅' : 'Certains liens sont incorrects. ❌';
    
    const feedbackData: FeedbackData = {
      isCorrect: isValid,
      message,
      explanation: ''
    };
    this.feedback.set(feedbackData);
    
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
    this.showFeedback.set(true);
    const message = isValid ? 'Bravo ! Toutes les réponses sont correctes ! ✅' : 'Certaines réponses sont incorrectes. ❌';
    
    const feedbackData: FeedbackData = {
      isCorrect: isValid,
      message,
      explanation: ''
    };
    this.feedback.set(feedbackData);
    
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

  onReponseLibreWordChange(word: string): void {
    this.reponseLibreInput.set(word);
  }

  onReponseLibreWordComplete(): void {
    // Le mot est complet et correct, on peut soumettre automatiquement
    this.submitAnswer();
  }

  async onGameValidated(isCorrect: boolean): Promise<void> {
    // Gérer la validation des jeux spécifiques
    this.showFeedback.set(true);
    const feedbackData: FeedbackData = {
      isCorrect,
      message: isCorrect ? 'Bravo ! Bonne réponse ! ✅' : 'Ce n\'est pas la bonne réponse. Réessaye ! ❌',
      explanation: ''
    };
    this.feedback.set(feedbackData);
    
    // Pour les jeux spécifiques, on considère qu'il n'y a qu'une seule "question"
    // donc on passe directement à la fin du jeu si correct
    if (isCorrect) {
      // Afficher immédiatement le modal de complétion
      await this.completeGame();
    }
  }

  async submitAnswer(): Promise<void> {
    // Gérer les réponses libres
    if (this.gameType() === 'reponse_libre') {
      const game = this.application.getCurrentGame()();
      const gameData = this.gameData();
      if (!game || !gameData) return;

      const reponseValide = (gameData as { reponse_valide?: string }).reponse_valide || '';
      const userReponse = this.reponseLibreInput().trim().toLowerCase();
      const isCorrect = userReponse === reponseValide.toLowerCase();

      this.showFeedback.set(true);
      const feedbackData: FeedbackData = {
        isCorrect,
        message: isCorrect ? 'Bravo ! Bonne réponse ! ✅' : 'Ce n\'est pas la bonne réponse. Réessaye ! ❌',
        explanation: '' // Ne pas afficher la bonne réponse pour le jeu réponse libre
      };
      this.feedback.set(feedbackData);

      // Pour les réponses libres, on considère qu'il n'y a qu'une seule question
      if (isCorrect) {
        // Afficher immédiatement le modal de complétion
        await this.completeGame();
      }
      return;
    }

    // Gérer les réponses à choix multiples
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
      this.showAides.set(false); // Réinitialiser le toggle des aides
    }
  }

  async completeGame(): Promise<void> {
    // Marquer le jeu comme complété
    this.gameCompleted.set(true);
    
    await this.application.completeGame();
    const gameState = this.application.getGameState()();
    const game = this.application.getCurrentGame()();
    
    // Chercher le prochain jeu dans la même catégorie AVANT de calculer le score
    await this.findNextGame();
    
    // Recharger la progression globale de la catégorie après avoir complété le jeu
    await this.loadCategoryProgress();
    // Recharger le score total après avoir complété le jeu
    await this.loadTotalScore();
    
    // Fonction helper pour normaliser le type de jeu (identique à application.ts)
    const normalizeGameType = (gameType: string | undefined): string => {
      if (!gameType) return '';
      return gameType.toLowerCase().replace(/\s+/g, '_').replace(/\//g, '_');
    };
    
    // Liste des types de jeux spécifiques qui n'utilisent pas le système de questions standard
    const specificGameTypes = ['case_vide', 'case vide', 'liens', 'vrai_faux', 'vrai/faux', 'image_interactive', 'memory', 'simon', 'qcm', 'chronologie', 'click', 'reponse_libre'];
    const normalizedGameType = normalizeGameType(game?.game_type);
    const isSpecificGame = specificGameTypes.some(type => normalizeGameType(type) === normalizedGameType);
    
    // Calculer le score individuel du jeu pour le message
    let individualScore = 0;
    if (isSpecificGame) {
      // Pour les jeux spécifiques, on considère que c'est réussi à 100% si terminé
      individualScore = 100;
    } else if (gameState && gameState.questions && gameState.questions.length > 0) {
      // Pour les jeux avec questions (jeux génériques)
      const totalQuestions = gameState.questions.length;
      const score = gameState.score;
      individualScore = Math.round((score / totalQuestions) * 100);
    } else {
      // Pour les jeux sans gameState ni questions, on considère que c'est réussi
      individualScore = 100;
    }
    
    this.finalScore.set(individualScore);
    
    // Message basé sur la progression globale de la catégorie
    const globalProgress = this.categoryProgress();
    if (globalProgress === 100) {
      this.completionMessage.set('🎉 Félicitations ! Tu as terminé tous les jeux de cette catégorie ! 🏆');
    } else if (globalProgress >= 80) {
      this.completionMessage.set(`Excellent ! Tu as complété ${globalProgress}% de cette catégorie ! ⭐`);
    } else if (globalProgress >= 50) {
      this.completionMessage.set(`Bien joué ! Tu as complété ${globalProgress}% de cette catégorie ! 👍`);
    } else {
      this.completionMessage.set(`Continue ! Tu as complété ${globalProgress}% de cette catégorie. 💪`);
    }
    
    this.showCompletionScreen.set(true);
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
      
      // Réinitialiser l'état du jeu actuel
      this.selectedAnswer.set(null);
      this.showFeedback.set(false);
      this.feedback.set(null);
      this.correctAnswer.set(null);
      this.showCompletionScreen.set(false);
      this.gameCompleted.set(false);
      this.reponseLibreInput.set('');
      this.finalScore.set(0);
      this.completionMessage.set('');
      this.hasNextGame.set(false);
      this.nextGameId.set(null);
      this.categoryProgress.set(0); // Réinitialiser temporairement, sera rechargé dans loadGame()
      
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

  isGameCompleted(): boolean {
    const result = this.gameCompleted() || this.application.getGameState()()?.isCompleted || false;
    return result;
  }

  async finishGame(): Promise<void> {
    await this.goToSubjects();
  }

  goToSubjects(): void {
    this.router.navigate(['/subjects']);
  }

  goBack(): void {
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
      this.reponseLibreInput.set('');
      this.finalScore.set(0);
      this.completionMessage.set('');
      this.showAides.set(false);
      
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
    this.reponseLibreInput.set('');
    this.finalScore.set(0);
    this.completionMessage.set('');
    this.showAides.set(false); // Réinitialiser le toggle des aides
  }
}

