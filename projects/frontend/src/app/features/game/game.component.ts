import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { GameApplication } from './components/application/application';
import { ChildButtonComponent } from '../../shared/components/child-button/child-button.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar.component';
import { CompletionModalComponent, CompletionModalAction } from '../../shared/components/completion-modal/completion-modal.component';
import { FeedbackData } from './services/feedback.service';
import { QcmGameComponent, ChronologieGameComponent, MemoryGameComponent, SimonGameComponent, ImageInteractiveGameComponent } from '@shared/games';
import type { QcmData, ChronologieData, MemoryData, SimonData, ImageInteractiveData, ReponseLibreData } from '@shared/games';
import { LetterByLetterInputComponent } from '@shared/components/letter-by-letter-input/letter-by-letter-input.component';
import { SubjectsInfrastructure } from '../subjects/components/infrastructure/infrastructure';
import type { Game } from '../../core/types/game.types';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, ChildButtonComponent, ProgressBarComponent, CompletionModalComponent, QcmGameComponent, ChronologieGameComponent, MemoryGameComponent, SimonGameComponent, ImageInteractiveGameComponent, LetterByLetterInputComponent],
  template: `
    <div class="game-container">
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
              [value]="application.getProgress()()"
              [max]="100"
              [label]="'Progression'"
              variant="primary">
            </app-progress-bar>
          </div>
          <div class="header-right">
            <div class="score-display">
              Score: {{ application.getGameState()()?.score || 0 }}
            </div>
          </div>
        </div>

        <!-- Jeux spécifiques -->
        @if (isQcmGame() && getQcmData()) {
          <app-qcm-game
            [qcmData]="getQcmData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            (validated)="onGameValidated($event)">
          </app-qcm-game>
        } @else if (isChronologieGame() && getChronologieData()) {
          <app-chronologie-game
            [chronologieData]="getChronologieData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            (validated)="onGameValidated($event)">
          </app-chronologie-game>
        } @else if (isMemoryGame() && getMemoryData()) {
          <app-memory-game
            [memoryData]="getMemoryData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            (validated)="onGameValidated($event)">
          </app-memory-game>
        } @else if (isSimonGame() && getSimonData()) {
          <app-simon-game
            [simonData]="getSimonData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            (validated)="onGameValidated($event)">
          </app-simon-game>
        } @else if (isImageInteractiveGame() && getImageInteractiveData()) {
          <app-image-interactive-game
            [imageData]="getImageInteractiveData()!"
            [showResult]="showFeedback()"
            [disabled]="showFeedback()"
            (validated)="onGameValidated($event)">
          </app-image-interactive-game>
        } @else if (gameType() === 'reponse_libre' && gameData()) {
          <!-- Jeu réponse libre -->
          <div class="question-container">
            <h2 class="question-text">
              {{ application.getCurrentGame()()?.question || application.getCurrentGame()()?.instructions || 'Répondez à la question' }}
            </h2>
            @if (application.getCurrentGame()()?.aides && application.getCurrentGame()()!.aides!.length > 0) {
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

        <!-- Boutons d'action -->
        <div class="actions-container">
          <app-child-button
            *ngIf="!showFeedback() && (selectedAnswer() !== null || isGenericGame() || (gameType() === 'reponse_libre' && reponseLibreInput().trim().length > 0))"
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

      <!-- Modal de fin de jeu -->
      <app-completion-modal
        [visible]="isGameCompleted() && showCompletionScreen()"
        [title]="'🎉 Jeu terminé !'"
        [score]="finalScore()"
        [scoreLabel]="'Score final'"
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
export class GameComponent implements OnInit {
  protected readonly application = inject(GameApplication);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly subjectsInfrastructure = inject(SubjectsInfrastructure);

  selectedAnswer = signal<number | null>(null);
  reponseLibreInput = signal<string>('');
  showFeedback = signal<boolean>(false);
  feedback = signal<FeedbackData | null>(null);
  correctAnswer = signal<number | null>(null);
  finalScore = signal<number>(0);
  completionMessage = signal<string>('');
  showCompletionScreen = signal<boolean>(false);

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
  isImageInteractiveGame = computed(() => this.gameType() === 'image_interactive');
  isGenericGame = computed(() => {
    const type = this.gameType();
    return type && !['qcm', 'chronologie', 'memory', 'simon', 'image_interactive'].includes(type);
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

  async ngOnInit(): Promise<void> {
    const gameId = this.route.snapshot.paramMap.get('id');
    if (gameId) {
      // Réinitialiser les signaux pour le prochain jeu
      this.hasNextGame.set(false);
      this.nextGameId.set(null);
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

  onReponseLibreWordChange(word: string): void {
    this.reponseLibreInput.set(word);
  }

  onReponseLibreWordComplete(): void {
    // Le mot est complet et correct, on peut soumettre automatiquement
    this.submitAnswer();
  }

  onGameValidated(isCorrect: boolean): void {
    // Gérer la validation des jeux spécifiques
    this.showFeedback.set(true);
    const feedbackData: FeedbackData = {
      isCorrect,
      message: isCorrect ? 'Bravo ! Bonne réponse ! ✅' : 'Ce n\'est pas la bonne réponse. Réessaye ! ❌',
      explanation: ''
    };
    this.feedback.set(feedbackData);
    
    // Pour les jeux spécifiques, on considère qu'il n'y a qu'une seule "question"
    // donc on passe directement à la fin du jeu après un court délai
    setTimeout(() => {
      if (isCorrect) {
        this.completeGame();
      }
    }, 2000);
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
        explanation: isCorrect ? '' : `La bonne réponse était : "${reponseValide}"`
      };
      this.feedback.set(feedbackData);

      // Pour les réponses libres, on considère qu'il n'y a qu'une seule question
      setTimeout(() => {
        if (isCorrect) {
          this.completeGame();
        }
      }, 2000);
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
    
    // Chercher le prochain jeu dans la même catégorie
    await this.findNextGame();
    
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
      let games: Game[] = [];
      
      // Si le jeu est lié à une catégorie, charger les jeux de cette catégorie
      if (currentGame.subject_category_id) {
        games = await this.subjectsInfrastructure.loadGamesByCategory(currentGame.subject_category_id);
      } 
      // Sinon, si le jeu est lié directement à une matière, charger les jeux de cette matière
      else if (currentGame.subject_id) {
        // Charger les jeux directement liés à la matière (sans catégorie)
        const { data, error } = await this.subjectsInfrastructure['supabase'].client
          .from('games')
          .select(`
            *,
            game_types!inner(name)
          `)
          .eq('subject_id', currentGame.subject_id)
          .is('subject_category_id', null)
          .order('name');
        
        if (error) throw error;
        if (data) {
          // Normaliser les jeux comme dans loadGamesByCategory
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          games = data.map((game: any) => {
            const gameTypeName = (game.game_types?.name || '').toLowerCase().replace(/\s+/g, '_');
            let gameDataJson: Record<string, unknown> = {};
            
            // Même logique de normalisation que dans SubjectsInfrastructure.loadGamesByCategory
            if (gameTypeName === 'reponse_libre') {
              gameDataJson = { reponse_valide: game.metadata?.reponse_valide || '' };
            } else if (gameTypeName === 'memory' && game.metadata?.paires) {
              gameDataJson = {
                paires: game.metadata.paires.map((paire: { question?: string; reponse?: string }) => ({
                  question: paire.question || '',
                  reponse: paire.reponse || ''
                }))
              };
            } else if (gameTypeName === 'qcm') {
              if (game.metadata?.propositions || game.reponses?.propositions) {
                gameDataJson = {
                  propositions: game.metadata?.propositions || game.reponses?.propositions || [],
                  reponses_valides: game.metadata?.reponses_valides || game.reponses?.reponses_valides || []
                };
              } else if (game.reponses) {
                gameDataJson = game.reponses;
              }
            } else if (game.reponses) {
              gameDataJson = game.reponses;
            } else if (game.game_data_json) {
              gameDataJson = game.game_data_json;
            }
            
            return {
              ...game,
              game_type: gameTypeName || game.game_type || 'generic',
              game_data_json: gameDataJson,
              question: game.question,
              reponses: game.reponses,
              aides: game.aides,
              metadata: game.metadata
            } as Game;
          });
        }
      }
      
      if (games.length === 0) {
        this.hasNextGame.set(false);
        this.nextGameId.set(null);
        return;
      }
      
      const currentGameIndex = games.findIndex(g => g.id === currentGame.id);
      
      if (currentGameIndex !== -1 && currentGameIndex < games.length - 1) {
        // Il y a un prochain jeu
        const nextGame = games[currentGameIndex + 1];
        this.nextGameId.set(nextGame.id);
        this.hasNextGame.set(true);
      } else {
        // Pas de prochain jeu dans cette catégorie/matière
        this.hasNextGame.set(false);
        this.nextGameId.set(null);
      }
    } catch (error) {
      console.error('Erreur lors de la recherche du prochain jeu:', error);
      this.hasNextGame.set(false);
      this.nextGameId.set(null);
    }
  }

  async goToNextGame(): Promise<void> {
    const nextId = this.nextGameId();
    if (nextId) {
      // Réinitialiser l'état du jeu actuel
      this.selectedAnswer.set(null);
      this.showFeedback.set(false);
      this.feedback.set(null);
      this.correctAnswer.set(null);
      this.showCompletionScreen.set(false);
      this.reponseLibreInput.set('');
      
      // Naviguer vers le prochain jeu
      this.router.navigate(['/game', nextId]);
    }
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

  goBack(): void {
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

