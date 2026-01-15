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
import { ConsecutiveGameDaysService } from '../../../../core/services/badges/consecutive-game-days.service';
import { DailyActivityService } from '../../../../core/services/badges/daily-activity.service';
import { BadgesStore } from '../../../badges/store/index';
import { GameState } from '../../types/game.types';
import { normalizeGameType } from '../../../../shared/utils/game-normalization.util';
import { SPECIFIC_GAME_TYPES } from '@shared/utils/game-type.util';
import { GameInfrastructure } from '../infrastructure/infrastructure';
import type { Game } from '../../../../core/types/game.types';

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
  private readonly consecutiveGameDaysService = inject(ConsecutiveGameDaysService);
  private readonly dailyActivityService = inject(DailyActivityService);
  private readonly badgesStore = inject(BadgesStore);
  private readonly infrastructure = inject(GameInfrastructure);

  async initializeGame(gameId: string): Promise<void> {
    // Réinitialiser le cache des badges affichés pour permettre l'affichage des badges dans cette nouvelle session
    this.badgeNotification.clearDisplayedBadgesCache();
    
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

  /**
   * Complète un jeu avec la progression précédente (pour détecter les nouvelles complétions)
   * @param previousCompletionPercentage Progression AVANT la sauvegarde du score (optionnel)
   */
  async completeGame(previousCompletionPercentage?: number): Promise<void> {
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
        // Pour les jeux spécifiques, essayer de récupérer le startedAt du store
        // Sinon, utiliser une durée minimale de 30 secondes pour éviter duration = 0
        const fallbackCompletedAt = new Date();
        const fallbackStartedAt = new Date(fallbackCompletedAt.getTime() - 30000); // 30 secondes avant
        effectiveGameState = {
          currentQuestionIndex: 0,
          questions: [],
          selectedAnswer: null,
          score: 0,
          isCompleted: true,
          startedAt: fallbackStartedAt,
          completedAt: fallbackCompletedAt,
        };
      } else {
        // Pour les jeux non spécifiques sans gameState, on ne peut pas continuer
        return;
      }
    } else {
      effectiveGameState = gameState;
      // S'assurer que completedAt est défini si le jeu est complété OU si completeGame est appelé (le jeu est considéré comme complété)
      if (!effectiveGameState.completedAt) {
        effectiveGameState = {
          ...effectiveGameState,
          isCompleted: true,
          completedAt: new Date(),
        };
      }
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
        correct_count: effectiveGameState.questions.filter(() => effectiveGameState.score > 0).length,
        total_count: effectiveGameState.questions.length,
      },
      difficulty_level: 1, // TODO: Récupérer depuis le state
      started_at: effectiveGameState.startedAt?.toISOString(),
      completed_at: effectiveGameState.completedAt?.toISOString(),
    };

    // Sauvegarder la tentative et récupérer l'ID
    const savedAttempt = await this.infrastructure.saveGameAttempt(attemptData);
    
    // Mettre à jour la progression et vérifier les badges (non-bloquant pour l'affichage du modal)
    // Les badges seront mis en file d'attente et affichés après la fermeture du modal de complétion
    // On vérifie les badges APRÈS la mise à jour de la progression car certains badges
    // (comme "Première catégorie complétée") sont débloqués par les triggers PostgreSQL
    // Passer previousCompletionPercentage pour détecter correctement les nouvelles complétions
    this.updateProgressAndCheckBadges(game, child.child_id, savedAttempt.id, isSuccess, previousCompletionPercentage).catch(error => {
      console.error('[GameApplication] Erreur lors de la mise à jour de la progression:', error);
    });

    // Créer un checkpoint (non-bloquant)
    this.checkpoint.createGameEndCheckpoint(child.child_id, {
      gameId: game.id,
      score: finalScore,
      completed: isSuccess,
    }).catch(error => {
      console.error('[GameApplication] Erreur lors de la création du checkpoint:', error);
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
    const game = this.store.currentGame();
    const child = await this.authService.getCurrentChild();

    if (!game || !child) {
      return;
    }

    const normalizedGameType = normalizeGameType(game.game_type);
    const isSpecificGame = SPECIFIC_GAME_TYPES.some(type => normalizeGameType(type) === normalizedGameType);

    let finalScore: number;
    let total: number;

    if (isSpecificGame) {
      // Pour les jeux spécifiques, utiliser les compteurs
      if (correctCount === undefined || incorrectCount === undefined) {
        return; // Pas de données disponibles
      }
      total = correctCount + incorrectCount;
      if (total === 0) {
        return; // Pas de tentatives, ne rien sauvegarder
      }
      finalScore = Math.round((correctCount / total) * 100);
    } else {
      // Pour les jeux génériques, utiliser le GameState
      if (gameStateScore === undefined || totalQuestions === undefined || totalQuestions === 0) {
        return; // Pas de données disponibles
      }
      total = totalQuestions;
      finalScore = Math.round((gameStateScore / totalQuestions) * 100);
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
      started_at: startedAt?.toISOString(),
      completed_at: new Date().toISOString(),
    };

    try {
      // Utiliser directement l'infrastructure pour éviter les problèmes avec rxMethod
      const result = await this.infrastructure.saveGameAttempt(attemptData);
      
      // Recalculer les jours consécutifs et vérifier les badges débloqués
      await this.checkAndNotifyConsecutiveDaysBadges(child.child_id);
      
      // Vérifier le badge Activité Quotidienne
      await this.checkAndNotifyDailyActivityBadges(child.child_id);
      
      // Vérifier les nouveaux badges débloqués (le trigger PostgreSQL les a déjà débloqués)
      await this.checkAndNotifyBadges(child.child_id, result.id);
    } catch (error) {
      console.error('[savePartialScore] Erreur lors de la sauvegarde', error);
      throw error;
    }
  }

  /**
   * Vérifie et met en file d'attente les badges (non-bloquant)
   */
  private async checkAndQueueBadges(childId: string, gameAttemptId: string): Promise<void> {
    try {
      // Vérifier les jours consécutifs
      const consecutiveStatus = await this.consecutiveGameDaysService.recalculateAndGetStatus(childId);
      if (consecutiveStatus.badgesUnlocked && consecutiveStatus.badgesUnlocked.length > 0) {
        this.badgesStore.loadChildBadges(childId);
        const allBadges = await this.badgesService.getAllBadges();
        const consecutiveBadge = allBadges.find(b => b.badge_type === 'consecutive_game_days');
        
        for (const unlockedBadge of consecutiveStatus.badgesUnlocked) {
          this.badgeNotification.queueBadgeNotification(
            {
              badge_id: unlockedBadge.badge_id,
              badge_name: consecutiveBadge?.name || 'Jours consécutifs de jeu',
              badge_type: 'consecutive_game_days',
              level: unlockedBadge.level,
              value: unlockedBadge.value,
              unlocked_at: unlockedBadge.unlocked_at,
            },
            consecutiveBadge?.description
          );
        }
      }

      // Vérifier l'activité quotidienne
      const dailyStatus = await this.dailyActivityService.recalculateAndGetStatus(childId);
      if (dailyStatus.newLevelsUnlocked && dailyStatus.newLevelsUnlocked.length > 0) {
        const allBadges = await this.badgesService.getAllBadges();
        const dailyActivityBadge = allBadges.find(b => b.badge_type === 'daily_activity');
        
        if (dailyStatus.newLevelsUnlocked.length > 1) {
          const levelsText = dailyStatus.newLevelsUnlocked.join(', ');
          this.badgeNotification.queueBadgeNotification(
            {
              badge_id: dailyActivityBadge?.id || '',
              badge_name: dailyActivityBadge?.name || 'Activité Quotidienne',
              badge_type: 'daily_activity',
              level: dailyStatus.maxLevelToday,
              value: dailyStatus.totalActiveMinutes,
              unlocked_at: new Date().toISOString(),
            },
            `Tu as débloqué les niveaux ${levelsText} du badge Activité Quotidienne!`
          );
        } else {
          this.badgeNotification.queueBadgeNotification(
            {
              badge_id: dailyActivityBadge?.id || '',
              badge_name: dailyActivityBadge?.name || 'Activité Quotidienne',
              badge_type: 'daily_activity',
              level: dailyStatus.newLevelsUnlocked[0],
              value: dailyStatus.totalActiveMinutes,
              unlocked_at: new Date().toISOString(),
            },
            dailyActivityBadge?.description
          );
        }
      }

      // Vérifier les autres badges
      const newBadges = await this.badgesService.getNewlyUnlockedBadges(childId, gameAttemptId);
      if (newBadges && newBadges.length > 0) {
        const allBadges = await this.badgesService.getAllBadges();
        for (const badge of newBadges) {
          const badgeDefinition = allBadges.find(b => b.id === badge.badge_id);
          this.badgeNotification.queueBadgeNotification(badge, badgeDefinition?.description);
        }
      }
    } catch (error) {
      console.error('[GameApplication] Erreur lors de la vérification des badges:', error);
    }
  }

  /**
   * Met à jour la progression et vérifie les badges après un délai (non-bloquant)
   */
  private async updateProgressAndCheckBadges(
    game: Game,
    childId: string,
    gameAttemptId: string,
    isSuccess: boolean,
    previousCompletionPercentage?: number // Progression AVANT la sauvegarde du score (optionnel)
  ): Promise<void> {
    try {
      if (game.subject_category_id) {
        // Calculer la progression APRÈS avoir sauvegardé le score (inclut le jeu qui vient d'être complété)
        const completionPercentage = await this.progression.calculateCategoryCompletionPercentage(
          childId,
          game.subject_category_id
        );
        const categoryCompleted = completionPercentage === 100;

        // Passer previousCompletionPercentage si fourni pour détecter correctement les nouvelles complétions
        await this.progression.updateProgress(
          childId,
          game.subject_category_id,
          {
            completed: categoryCompleted,
            completionPercentage: completionPercentage,
            previousCompletionPercentage: previousCompletionPercentage,
          }
        );

        // Attendre que le trigger s'exécute, puis vérifier les badges
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.checkAndQueueBadges(childId, gameAttemptId);

        // Vérifier les collectibles
        if (isSuccess) {
          await this.collection.checkAndUnlockCollectibles(childId, game.subject_category_id);
        }
      } else if (game.subject_id) {
        const completionPercentage = await this.progression.calculateSubjectCompletionPercentage(
          childId,
          game.subject_id
        );

        await this.progression.updateSubjectProgress(
          childId,
          game.subject_id,
          {
            completionPercentage: completionPercentage,
          }
        );

        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.checkAndQueueBadges(childId, gameAttemptId);
      }
    } catch (error) {
      console.error('[GameApplication] Erreur lors de la mise à jour de la progression:', error);
    }
  }

  /**
   * Vérifie le badge Activité Quotidienne débloqué et affiche les notifications
   */
  private async checkAndNotifyDailyActivityBadges(childId: string): Promise<void> {
    try {
      // Recalculer et récupérer l'état frais avec nouveaux niveaux débloqués
      const status = await this.dailyActivityService.recalculateAndGetStatus(childId);
      
      if (status.newLevelsUnlocked && status.newLevelsUnlocked.length > 0) {
        
        // Récupérer les descriptions des badges depuis la base
        const allBadges = await this.badgesService.getAllBadges();
        const dailyActivityBadge = allBadges.find(b => b.badge_type === 'daily_activity');
        
        // Si plusieurs niveaux débloqués, afficher une notification groupée
        if (status.newLevelsUnlocked.length > 1) {
          const levelsText = status.newLevelsUnlocked.join(', ');
          await this.badgeNotification.showBadgeNotification(
            {
              badge_id: dailyActivityBadge?.id || '',
              badge_name: dailyActivityBadge?.name || 'Activité Quotidienne',
              badge_type: 'daily_activity',
              level: status.maxLevelToday,
              value: status.totalActiveMinutes,
              unlocked_at: new Date().toISOString(),
            },
            `Tu as débloqué les niveaux ${levelsText} du badge Activité Quotidienne!`
          );
        } else {
          // Un seul niveau débloqué
          await this.badgeNotification.showBadgeNotification(
            {
              badge_id: dailyActivityBadge?.id || '',
              badge_name: dailyActivityBadge?.name || 'Activité Quotidienne',
              badge_type: 'daily_activity',
              level: status.newLevelsUnlocked[0],
              value: status.totalActiveMinutes,
              unlocked_at: new Date().toISOString(),
            },
            dailyActivityBadge?.description
          );
        }
      }
    } catch (error) {
      // Ne pas bloquer le flux si la vérification des badges échoue
      console.error('[GameApplication] Erreur lors de la vérification du badge Activité Quotidienne:', error);
    }
  }

  /**
   * Vérifie les badges de jours consécutifs débloqués et affiche les notifications
   */
  private async checkAndNotifyConsecutiveDaysBadges(childId: string): Promise<void> {
    try {
      // Recalculer et récupérer l'état frais avec badges débloqués
      const status = await this.consecutiveGameDaysService.recalculateAndGetStatus(childId);
      
      if (status.badgesUnlocked && status.badgesUnlocked.length > 0) {
        
        // Recharger le store des badges pour mettre à jour l'UI
        this.badgesStore.loadChildBadges(childId);
        
        // Récupérer les descriptions des badges depuis la base
        const allBadges = await this.badgesService.getAllBadges();
        const consecutiveBadge = allBadges.find(b => b.badge_type === 'consecutive_game_days');
        
        // Afficher les notifications pour chaque niveau débloqué
        for (const unlockedBadge of status.badgesUnlocked) {
          await this.badgeNotification.showBadgeNotification(
            {
              badge_id: unlockedBadge.badge_id,
              badge_name: consecutiveBadge?.name || 'Jours consécutifs de jeu',
              badge_type: 'consecutive_game_days',
              level: unlockedBadge.level,
              value: unlockedBadge.value,
              unlocked_at: unlockedBadge.unlocked_at,
            },
            consecutiveBadge?.description
          );
        }
      }
    } catch (error) {
      // Ne pas bloquer le flux si la vérification des badges échoue
      console.error('[GameApplication] Erreur lors de la vérification des badges jours consécutifs:', error);
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

