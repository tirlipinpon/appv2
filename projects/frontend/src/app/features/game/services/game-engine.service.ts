import { Injectable, inject } from '@angular/core';
import { Game, GameVariant } from '../../../core/types/game.types';
import { GameQuestion, GameState } from '../types/game.types';
import { AdaptiveDifficultyService } from '../../../core/services/adaptive/adaptive-difficulty.service';
import { ChildAuthService } from '../../../core/auth/child-auth.service';

@Injectable({
  providedIn: 'root',
})
export class GameEngineService {
  private readonly adaptiveService = inject(AdaptiveDifficultyService);
  private readonly authService = inject(ChildAuthService);

  /**
   * Initialise une session de jeu
   */
  async initializeGame(game: Game, variant?: GameVariant): Promise<GameState> {
    const child = await this.authService.getCurrentChild();
    if (!child) {
      throw new Error('Enfant non authentifié');
    }

    // Calculer la difficulté
    const successRate = await this.adaptiveService.getSuccessRateForGame(child.child_id, game.id);
    const difficultyLevel = this.adaptiveService.calculateDifficultyLevel(successRate);

    // Charger ou générer les questions
    const questions = await this.loadQuestions(game, variant, difficultyLevel);

    const startedAt = new Date();
    return {
      currentQuestionIndex: 0,
      questions,
      selectedAnswer: null,
      score: 0,
      isCompleted: false,
      startedAt: startedAt,
    };
  }

  /**
   * Charge les questions depuis le jeu ou la variante
   */
  private async loadQuestions(
    game: Game,
    variant: GameVariant | undefined,
    difficultyLevel: number
  ): Promise<GameQuestion[]> {
    const gameData = variant?.variant_data_json || game.game_data_json;

    // Extraire les questions depuis game_data_json
    // Format attendu: { questions: [...] }
    const questions = (gameData as any)?.['questions'] || [];

    if (questions.length === 0) {
      // Générer des questions par défaut si aucune n'est disponible
      return this.generateDefaultQuestions(game);
    }

    return questions.map((q: any, index: number) => ({
      id: q.id || `q${index}`,
      question: q.question || q.text || '',
      answers: q.answers || q.options || [],
      correctAnswer: q.correctAnswer || q.correct_answer || 0,
      explanation: q.explanation || q.feedback,
    }));
  }

  /**
   * Génère des questions par défaut (fallback)
   */
  private generateDefaultQuestions(game: Game): GameQuestion[] {
    return [
      {
        id: 'q1',
        question: `Question sur ${game.name}`,
        answers: ['Réponse 1', 'Réponse 2', 'Réponse 3', 'Réponse 4'],
        correctAnswer: 0,
      },
    ];
  }

  /**
   * Soumet une réponse
   */
  submitAnswer(state: GameState, answerIndex: number): { isCorrect: boolean; newState: GameState } {
    const currentQuestion = state.questions[state.currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.correctAnswer;

    const newState: GameState = {
      ...state,
      selectedAnswer: answerIndex,
      score: isCorrect ? state.score + 1 : state.score,
    };

    return { isCorrect, newState };
  }

  /**
   * Passe à la question suivante
   */
  nextQuestion(state: GameState): GameState {
    const nextIndex = state.currentQuestionIndex + 1;
    const isCompleted = nextIndex >= state.questions.length;
    const completedAt = isCompleted ? new Date() : undefined;

    return {
      ...state,
      currentQuestionIndex: nextIndex,
      selectedAnswer: null,
      isCompleted,
      completedAt: completedAt,
    };
  }

  /**
   * Calcule le score final en pourcentage
   */
  calculateFinalScore(state: GameState): number {
    if (state.questions.length === 0) return 0;
    return Math.round((state.score / state.questions.length) * 100);
  }
}

