import { Injectable, inject } from '@angular/core';
import { SoundService } from '../../../core/services/sounds/sound.service';

export interface FeedbackData {
  isCorrect: boolean;
  message: string;
  explanation?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FeedbackService {
  private readonly soundService = inject(SoundService);

  /**
   * Génère un feedback pour une réponse
   */
  generateFeedback(isCorrect: boolean, explanation?: string): FeedbackData {
    const messages = isCorrect
      ? [
          'Bravo ! 🎉',
          'Excellent ! ⭐',
          'Super ! 👍',
          'Parfait ! ✨',
          'Génial ! 🚀',
        ]
      : [
          'Pas tout à fait 😊',
          'Presque ! 💪',
          'Essaie encore ! 🔄',
          'Tu y es presque ! 🌟',
        ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    return {
      isCorrect,
      message: randomMessage,
      explanation,
    };
  }

  /**
   * Affiche le feedback (visuel, sonore, textuel)
   */
  showFeedback(feedback: FeedbackData): void {
    // Feedback sonore
    if (feedback.isCorrect) {
      this.soundService.playSuccessSound();
    } else {
      this.soundService.playFailureSound();
    }

    // Le feedback visuel et textuel sera géré par le composant
  }

  /**
   * Affiche le feedback de fin de jeu
   * Note: Le son de succès n'est pas joué ici car il a déjà été joué
   * pour la dernière réponse correcte via showFeedback()
   */
  showGameCompleteFeedback(score: number, totalQuestions: number): FeedbackData {
    const percentage = Math.round((score / totalQuestions) * 100);
    let message = '';

    if (percentage === 100) {
      message = 'Parfait ! Tu as tout réussi ! 🏆';
    } else if (percentage >= 80) {
      message = `Excellent ! ${score}/${totalQuestions} bonnes réponses ! ⭐`;
    } else if (percentage >= 60) {
      message = `Bien joué ! ${score}/${totalQuestions} bonnes réponses ! 👍`;
    } else {
      message = `Continue ! ${score}/${totalQuestions} bonnes réponses. Tu peux réessayer ! 💪`;
    }

    return {
      isCorrect: percentage >= 60,
      message,
    };
  }
}

