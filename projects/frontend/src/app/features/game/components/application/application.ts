import { inject, Injectable } from '@angular/core';
import { GameStore } from '../../store/index';
import { GameEngineService } from '../../services/game-engine.service';
import { FeedbackService, FeedbackData } from '../../services/feedback.service';
import { ProgressionService } from '../../../../core/services/progression/progression.service';
import { CollectionService } from '../../../../core/services/collection/collection.service';
import { CheckpointService } from '../../../../core/services/save/checkpoint.service';
import { ChildAuthService } from '../../../../core/auth/child-auth.service';
import { GameState } from '../../types/game.types';
import { normalizeGameType } from '../../../../shared/utils/game-normalization.util';
import { SPECIFIC_GAME_TYPES } from '@shared/utils/game-type.util';

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

    if (!game || !child) {
      return;
    }

    // Liste des types de jeux spécifiques qui n'utilisent pas le système de questions standard
    // Ces jeux appellent completeGame() seulement si isCorrect === true, donc on leur donne 100% si terminés
    const normalizedGameType = normalizeGameType(game.game_type);
    const isSpecificGame = SPECIFIC_GAME_TYPES.some(type => normalizeGameType(type) === normalizedGameType);

    // Si pas de gameState (jeux spécifiques comme image_interactive), créer un gameState minimal
    let effectiveGameState: GameState;
    if (!gameState) {
      if (isSpecificGame) {
        effectiveGameState = {
          currentQuestionIndex: 0,
          questions: [],
          selectedAnswer: null,
          score: 0,
          isCompleted: true,
          startedAt: new Date(),
          completedAt: new Date(),
        };
      } else {
        // Pour les jeux non spécifiques sans gameState, on ne peut pas continuer
        return;
      }
    } else {
      effectiveGameState = gameState;
    }
    
    let finalScore: number;
    if (isSpecificGame || effectiveGameState.questions.length === 0) {
      // Jeux spécifiques : considérés comme réussis à 100% si terminés
      // (ces jeux appellent completeGame() seulement si isCorrect === true)
      finalScore = 100;
    } else {
      // Jeux avec questions : calculer le score normalement
      finalScore = this.gameEngine.calculateFinalScore(effectiveGameState);
    }
    const isSuccess = finalScore >= 60;

    // Afficher le feedback final
    this.feedback.showGameCompleteFeedback(
      effectiveGameState.score,
      effectiveGameState.questions.length
    );

    // Sauvegarder la tentative
    const duration = effectiveGameState.completedAt && effectiveGameState.startedAt
      ? effectiveGameState.completedAt.getTime() - effectiveGameState.startedAt.getTime()
      : 0;

    const attemptData = {
      child_id: child.child_id,
      game_id: game.id,
      success: isSuccess,
      score: finalScore,
      duration_ms: duration,
      responses_json: {
        questions: effectiveGameState.questions.map((q) => ({
          questionId: q.id,
          selectedAnswer: effectiveGameState.selectedAnswer,
        })),
      },
      difficulty_level: 1, // TODO: Récupérer depuis le state
      completed_at: effectiveGameState.completedAt?.toISOString(),
    };

    await this.store.saveAttempt(attemptData);

    // Mettre à jour la progression
    if (game.subject_category_id) {
      // Calculer la progression globale basée sur les jeux résolus / total de jeux
      const completionPercentage = await this.progression.calculateCategoryCompletionPercentage(
        child.child_id,
        game.subject_category_id
      );

      // Calculer les étoiles selon le score du jeu actuel
      let starsCount = 0;
      if (finalScore >= 90) starsCount = 3;
      else if (finalScore >= 70) starsCount = 2;
      else if (finalScore >= 60) starsCount = 1;

      // La catégorie est complétée si tous les jeux sont résolus (100%)
      const categoryCompleted = completionPercentage === 100;

      await this.progression.updateProgress(
        child.child_id,
        game.subject_category_id,
        {
          completed: categoryCompleted,
          starsCount,
          completionPercentage: completionPercentage,
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

  getCurrentGame() {
    return this.store.currentGame;
  }

  /**
   * Récupère la progression globale de la catégorie (jeux résolus / total)
   */
  async getCategoryProgress(): Promise<number> {
    const game = this.store.currentGame();
    const child = await this.authService.getCurrentChild();

    if (!game?.subject_category_id || !child) {
      return 0;
    }

    try {
      return await this.progression.calculateCategoryCompletionPercentage(
        child.child_id,
        game.subject_category_id
      );
    } catch (error) {
      console.error('Erreur lors du calcul de la progression:', error);
      return 0;
    }
  }
}

