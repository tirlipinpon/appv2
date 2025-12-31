import { inject, Injectable } from '@angular/core';
import { GameStore } from '../../store/index';
import { GameEngineService } from '../../services/game-engine.service';
import { FeedbackService, FeedbackData } from '../../services/feedback.service';
import { ProgressionService } from '../../../../core/services/progression/progression.service';
import { CollectionService } from '../../../../core/services/collection/collection.service';
import { CheckpointService } from '../../../../core/services/save/checkpoint.service';
import { ChildAuthService } from '../../../../core/auth/child-auth.service';

@Injectable({
  providedIn: 'root',
})
export class GameApplication {
  private readonly store = inject(GameStore);
  private readonly gameEngine = inject(GameEngineService);
  private readonly feedback = inject(FeedbackService);
  private readonly progression = inject(ProgressionService);
  private readonly collection = inject(CollectionService);
  private readonly checkpoint = inject(CheckpointService);
  private readonly authService = inject(ChildAuthService);

  async initializeGame(gameId: string): Promise<void> {
    await this.store.loadGame(gameId);
    const game = this.store.currentGame();
    if (game) {
      const gameState = await this.gameEngine.initializeGame(game);
      this.store.setGameState(gameState);
    }
  }

  async submitAnswer(answerIndex: number): Promise<{ isCorrect: boolean; feedback: FeedbackData }> {
    const gameState = this.store.gameState();
    if (!gameState) {
      throw new Error('Aucun jeu en cours');
    }

    const result = this.gameEngine.submitAnswer(gameState, answerIndex);
    this.store.setGameState(result.newState);

    const feedback = this.feedback.generateFeedback(
      result.isCorrect,
      gameState.questions[gameState.currentQuestionIndex].explanation
    );
    this.feedback.showFeedback(feedback);

    return { isCorrect: result.isCorrect, feedback };
  }

  async nextQuestion(): Promise<boolean> {
    const gameState = this.store.gameState();
    if (!gameState) return false;

    const newState = this.gameEngine.nextQuestion(gameState);
    this.store.setGameState(newState);

    return !newState.isCompleted;
  }

  async completeGame(): Promise<void> {
    const gameState = this.store.gameState();
    const game = this.store.currentGame();
    const child = await this.authService.getCurrentChild();

    if (!gameState || !game || !child) return;

    const finalScore = this.gameEngine.calculateFinalScore(gameState);
    const isSuccess = finalScore >= 60;

    // Afficher le feedback final
    this.feedback.showGameCompleteFeedback(
      gameState.score,
      gameState.questions.length
    );

    // Sauvegarder la tentative
    const duration = gameState.completedAt
      ? gameState.completedAt.getTime() - gameState.startedAt.getTime()
      : 0;

    await this.store.saveAttempt({
      child_id: child.child_id,
      game_id: game.id,
      success: isSuccess,
      score: finalScore,
      duration_ms: duration,
      responses_json: {
        questions: gameState.questions.map((q) => ({
          questionId: q.id,
          selectedAnswer: gameState.selectedAnswer,
        })),
      },
      difficulty_level: 1, // TODO: Récupérer depuis le state
      completed_at: gameState.completedAt?.toISOString(),
    });

    // Mettre à jour la progression
    if (game.subject_category_id) {
      // Calculer les étoiles selon le score
      let starsCount = 0;
      if (finalScore >= 90) starsCount = 3;
      else if (finalScore >= 70) starsCount = 2;
      else if (finalScore >= 60) starsCount = 1;

      await this.progression.updateProgress(
        child.child_id,
        game.subject_category_id,
        {
          completed: isSuccess,
          starsCount,
          completionPercentage: finalScore,
        }
      );

      // Vérifier et débloquer les collectibles
      if (isSuccess) {
        await this.collection.checkAndUnlockCollectibles(child.child_id, game.subject_category_id);
      }
    }

    // Créer un checkpoint
    await this.checkpoint.createGameEndCheckpoint(child.child_id, {
      gameId: game.id,
      score: finalScore,
      completed: isSuccess,
    });
  }

  getCurrentQuestion() {
    return this.store.currentQuestion;
  }

  getGameState() {
    return this.store.gameState;
  }

  getProgress() {
    return this.store.progress;
  }

  isLoading() {
    return this.store.loading;
  }

  getError() {
    return this.store.error;
  }
}

