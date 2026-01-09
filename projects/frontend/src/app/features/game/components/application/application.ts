import { inject, Injectable } from '@angular/core';
import { GameStore } from '../../store/index';
import { GameEngineService } from '../../services/game-engine.service';
import { FeedbackService, FeedbackData } from '../../services/feedback.service';
import { ProgressionService } from '../../../../core/services/progression/progression.service';
import { CollectionService } from '../../../../core/services/collection/collection.service';
import { CheckpointService } from '../../../../core/services/save/checkpoint.service';
import { ChildAuthService } from '../../../../core/auth/child-auth.service';
import { BadgesService } from '../../../../core/services/badges/badges.service';
import { BadgeNotificationService } from '../../../../core/services/badges/badge-notification.service';
import { GameState } from '../../types/game.types';
import { normalizeGameType } from '../../../../shared/utils/game-normalization.util';
import { SPECIFIC_GAME_TYPES } from '@shared/utils/game-type.util';
import { GameInfrastructure } from '../infrastructure/infrastructure';

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
  private readonly badgesService = inject(BadgesService);
  private readonly badgeNotification = inject(BadgeNotificationService);
  private readonly infrastructure = inject(GameInfrastructure);

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
        correct_count: effectiveGameState.questions.filter((q, i) => {
          // Compter les bonnes réponses (simplifié, à améliorer selon la logique réelle)
          return effectiveGameState.score > 0;
        }).length,
        total_count: effectiveGameState.questions.length,
      },
      difficulty_level: 1, // TODO: Récupérer depuis le state
      completed_at: effectiveGameState.completedAt?.toISOString(),
    };

    // Sauvegarder la tentative et récupérer l'ID
    const savedAttempt = await this.infrastructure.saveGameAttempt(attemptData);
    
    // Vérifier les nouveaux badges débloqués (le trigger PostgreSQL les a déjà débloqués)
    await this.checkAndNotifyBadges(child.child_id, savedAttempt.id);

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

  /**
   * Sauvegarde le score partiel pour tous les jeux qui n'ont pas été complétés à 100%
   * @param correctCount - Nombre de réponses correctes (pour jeux spécifiques)
   * @param incorrectCount - Nombre de réponses incorrectes (pour jeux spécifiques)
   * @param gameStateScore - Score du GameState (pour jeux génériques)
   * @param totalQuestions - Nombre total de questions (pour jeux génériques)
   * @param startedAt - Date de début du jeu
   */
  async savePartialScore(
    correctCount?: number, 
    incorrectCount?: number, 
    gameStateScore?: number,
    totalQuestions?: number,
    startedAt?: Date
  ): Promise<void> {
    console.log('[savePartialScore] Début de la sauvegarde', { correctCount, incorrectCount, gameStateScore, totalQuestions });
    
    const game = this.store.currentGame();
    const child = await this.authService.getCurrentChild();

    if (!game || !child) {
      console.log('[savePartialScore] Pas de jeu ou enfant', { game: !!game, child: !!child });
      return;
    }

    console.log('[savePartialScore] Jeu et enfant trouvés', { gameId: game.id, childId: child.child_id });

    const normalizedGameType = normalizeGameType(game.game_type);
    const isSpecificGame = SPECIFIC_GAME_TYPES.some(type => normalizeGameType(type) === normalizedGameType);

    console.log('[savePartialScore] Type de jeu', { gameType: game.game_type, normalizedGameType, isSpecificGame });

    let finalScore: number;
    let total: number;

    if (isSpecificGame) {
      // Pour les jeux spécifiques, utiliser les compteurs
      if (correctCount === undefined || incorrectCount === undefined) {
        console.log('[savePartialScore] Pas de données pour jeu spécifique');
        return; // Pas de données disponibles
      }
      total = correctCount + incorrectCount;
      if (total === 0) {
        console.log('[savePartialScore] Aucune tentative pour jeu spécifique');
        return; // Pas de tentatives, ne rien sauvegarder
      }
      finalScore = Math.round((correctCount / total) * 100);
      console.log('[savePartialScore] Score calculé pour jeu spécifique', { correctCount, incorrectCount, total, finalScore });
    } else {
      // Pour les jeux génériques, utiliser le GameState
      if (gameStateScore === undefined || totalQuestions === undefined || totalQuestions === 0) {
        console.log('[savePartialScore] Pas de données pour jeu générique', { gameStateScore, totalQuestions });
        return; // Pas de données disponibles
      }
      total = totalQuestions;
      finalScore = Math.round((gameStateScore / totalQuestions) * 100);
      console.log('[savePartialScore] Score calculé pour jeu générique', { gameStateScore, totalQuestions, finalScore });
    }

    const isSuccess = finalScore >= 60;
    const duration = startedAt ? Date.now() - startedAt.getTime() : 0;

    const attemptData = {
      child_id: child.child_id,
      game_id: game.id,
      success: isSuccess,
      score: finalScore,
      duration_ms: duration,
      responses_json: isSpecificGame 
        ? { correctCount, incorrectCount, total }
        : { score: gameStateScore, totalQuestions },
      difficulty_level: 1,
      completed_at: new Date().toISOString(),
    };

    console.log('[savePartialScore] Données à sauvegarder', attemptData);

    try {
      // Utiliser directement l'infrastructure pour éviter les problèmes avec rxMethod
      const result = await this.infrastructure.saveGameAttempt(attemptData);
      console.log('[savePartialScore] Score sauvegardé avec succès', result);
      
      // Vérifier les nouveaux badges débloqués (le trigger PostgreSQL les a déjà débloqués)
      await this.checkAndNotifyBadges(child.child_id, result.id);
    } catch (error) {
      console.error('[savePartialScore] Erreur lors de la sauvegarde', error);
      throw error;
    }
  }

  /**
   * Vérifie les nouveaux badges débloqués et affiche les notifications
   */
  private async checkAndNotifyBadges(childId: string, gameAttemptId: string): Promise<void> {
    try {
      // Récupérer les nouveaux badges débloqués via la fonction RPC
      const newBadges = await this.badgesService.getNewlyUnlockedBadges(childId, gameAttemptId);
      
      if (newBadges && newBadges.length > 0) {
        console.log('[GameApplication] Nouveaux badges débloqués:', newBadges);
        
        // Récupérer les descriptions des badges depuis la base
        const allBadges = await this.badgesService.getAllBadges();
        
        // Afficher les notifications une par une (la file d'attente est gérée par le service)
        for (const badge of newBadges) {
          const badgeDefinition = allBadges.find(b => b.id === badge.badge_id);
          await this.badgeNotification.showBadgeNotification(
            badge,
            badgeDefinition?.description
          );
        }
      }
    } catch (error) {
      // Ne pas bloquer le flux si la vérification des badges échoue
      console.error('[GameApplication] Erreur lors de la vérification des badges:', error);
    }
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

