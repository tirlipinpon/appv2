import { Injectable } from '@angular/core';

export interface GameFeedbackMessage {
  message: string;
  emoji: string;
  variant: 'success' | 'encouraging' | 'neutral' | 'needs-improvement';
}

export type GameType = 
  | 'qcm' 
  | 'chronologie' 
  | 'memory' 
  | 'simon' 
  | 'image_interactive' 
  | 'case_vide' 
  | 'liens' 
  | 'vrai_faux' 
  | 'puzzle' 
  | 'reponse_libre'
  | 'generic';

@Injectable({
  providedIn: 'root',
})
export class GameFeedbackMessageService {
  private messageIndex = 0; // Pour alterner les messages

  /**
   * Génère un message de feedback adapté au taux de réussite et au type de jeu
   * @param isCorrect - Si la réponse est correcte
   * @param successRate - Taux de réussite (0-100) pour ce jeu
   * @param gameType - Type de jeu (réservé pour usage futur)
   * @returns Message de feedback adapté
   */
  getFeedbackMessage(
    isCorrect: boolean,
    successRate: number | null = null,
    gameType?: GameType | string | null
  ): GameFeedbackMessage {
    // gameType réservé pour usage futur (personnalisation des messages par type de jeu)
    void gameType;
    if (isCorrect) {
      return this.getSuccessMessage();
    }

    // Messages selon le taux de réussite
    if (successRate === null || successRate === 0) {
      // Première tentative ou aucune réussite
      return this.getFirstAttemptMessage();
    } else if (successRate >= 80) {
      // Très bon taux de réussite
      return this.getHighSuccessRateMessage();
    } else if (successRate >= 50) {
      // Taux de réussite moyen
      return this.getMediumSuccessRateMessage();
    } else {
      // Taux de réussite faible
      return this.getLowSuccessRateMessage();
    }
  }

  /**
   * Messages de succès
   */
  private getSuccessMessage(): GameFeedbackMessage {
    const messages: GameFeedbackMessage[] = [
      { message: 'Bravo ! Excellente réponse !', emoji: '🎉', variant: 'success' },
      { message: 'Parfait ! Tu as tout compris !', emoji: '⭐', variant: 'success' },
      { message: 'Super ! Continue comme ça !', emoji: '✨', variant: 'success' },
      { message: 'Génial ! Tu progresses bien !', emoji: '🚀', variant: 'success' },
      { message: 'Excellent ! Tu es sur la bonne voie !', emoji: '🌟', variant: 'success' },
    ];

    return this.getRotatedMessage(messages);
  }

  /**
   * Messages pour première tentative ou aucune réussite
   */
  private getFirstAttemptMessage(): GameFeedbackMessage {
    const messages: GameFeedbackMessage[] = [
      { message: 'Pas tout à fait, mais tu y es presque !', emoji: '💪', variant: 'encouraging' },
      { message: 'Presque ! Continue d\'essayer, tu vas y arriver !', emoji: '🌟', variant: 'encouraging' },
      { message: 'Tu es sur la bonne voie ! Réessaye !', emoji: '✨', variant: 'encouraging' },
      { message: 'Pas encore, mais tu progresses !', emoji: '🎯', variant: 'encouraging' },
      { message: 'Tu y es presque ! Encore un petit effort !', emoji: '⭐', variant: 'encouraging' },
    ];

    return this.getRotatedMessage(messages);
  }

  /**
   * Messages pour taux de réussite élevé (>= 80%)
   */
  private getHighSuccessRateMessage(): GameFeedbackMessage {
    const messages: GameFeedbackMessage[] = [
      { message: 'Presque parfait ! Tu es excellent !', emoji: '🏆', variant: 'encouraging' },
      { message: 'Tu es très fort ! Continue comme ça !', emoji: '⭐', variant: 'encouraging' },
      { message: 'Excellent ! Tu maîtrises bien ce jeu !', emoji: '🌟', variant: 'encouraging' },
      { message: 'Super ! Tu es sur la bonne voie !', emoji: '✨', variant: 'encouraging' },
      { message: 'Bravo ! Tu progresses très bien !', emoji: '🎯', variant: 'encouraging' },
    ];

    return this.getRotatedMessage(messages);
  }

  /**
   * Messages pour taux de réussite moyen (50-79%)
   */
  private getMediumSuccessRateMessage(): GameFeedbackMessage {
    const messages: GameFeedbackMessage[] = [
      { message: 'Tu progresses ! Continue d\'essayer !', emoji: '💪', variant: 'neutral' },
      { message: 'Pas encore, mais tu t\'améliores !', emoji: '🌟', variant: 'neutral' },
      { message: 'Tu es sur la bonne voie ! Réessaye !', emoji: '✨', variant: 'neutral' },
      { message: 'Continue ! Tu vas y arriver !', emoji: '🎯', variant: 'neutral' },
      { message: 'Presque ! Encore un petit effort !', emoji: '⭐', variant: 'neutral' },
    ];

    return this.getRotatedMessage(messages);
  }

  /**
   * Messages pour taux de réussite faible (< 50%)
   */
  private getLowSuccessRateMessage(): GameFeedbackMessage {
    const messages: GameFeedbackMessage[] = [
      { message: 'Pas encore, mais ne te décourage pas !', emoji: '💪', variant: 'needs-improvement' },
      { message: 'Tu peux y arriver ! Continue d\'essayer !', emoji: '🌟', variant: 'needs-improvement' },
      { message: 'C\'est difficile, mais tu progresses !', emoji: '✨', variant: 'needs-improvement' },
      { message: 'Ne lâche pas ! Tu vas y arriver !', emoji: '🎯', variant: 'needs-improvement' },
      { message: 'Continue ! Chaque essai te rapproche du but !', emoji: '⭐', variant: 'needs-improvement' },
    ];

    return this.getRotatedMessage(messages);
  }

  /**
   * Alterne les messages pour éviter la répétition
   */
  private getRotatedMessage(messages: GameFeedbackMessage[]): GameFeedbackMessage {
    const message = messages[this.messageIndex % messages.length];
    this.messageIndex = (this.messageIndex + 1) % messages.length;
    return message;
  }

  /**
   * Réinitialise l'index pour recommencer la rotation
   */
  resetRotation(): void {
    this.messageIndex = 0;
  }
}
