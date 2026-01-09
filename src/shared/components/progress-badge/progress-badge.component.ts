import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

type StarLevel = 'gray' | 'bronze' | 'silver' | 'gold' | 'diamond';

@Component({
  selector: 'app-progress-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (hasAttempted()) {
      <div 
        class="progress-badge star-badge"
        [class.star-gray]="starLevel() === 'gray'"
        [class.star-bronze]="starLevel() === 'bronze'"
        [class.star-silver]="starLevel() === 'silver'"
        [class.star-gold]="starLevel() === 'gold'"
        [class.star-diamond]="starLevel() === 'diamond'">
        <div class="star-container">
          <svg class="star-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <!-- Dégradé gris (0-24%) -->
              <linearGradient id="grayGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#BDBDBD;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#757575;stop-opacity:1" />
              </linearGradient>
              <!-- Dégradé bronze (25-49%) -->
              <linearGradient id="bronzeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#E6A571;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#CD7F32;stop-opacity:1" />
              </linearGradient>
              <!-- Dégradé argent (50-74%) -->
              <linearGradient id="silverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#E8E8E8;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#C0C0C0;stop-opacity:1" />
              </linearGradient>
              <!-- Dégradé or (75-99%) -->
              <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#FFED4E;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#FFD700;stop-opacity:1" />
              </linearGradient>
              <!-- Dégradé diamant (100%) -->
              <linearGradient id="diamondGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#FFF9C4;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#FFD700;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#FFA000;stop-opacity:1" />
              </linearGradient>
            </defs>
            <path 
              d="M50 5 L61 35 L95 35 L68 55 L79 85 L50 65 L21 85 L32 55 L5 35 L39 35 Z" 
              [attr.fill]="getStarGradientId()"
              [attr.stroke]="getStarStroke()"
              stroke-width="2.5"
              [class.diamond-glow]="starLevel() === 'diamond'"/>
          </svg>
          <span class="score-text">{{ score() }}%</span>
          @if (starLevel() === 'diamond') {
            <span class="sparkle">✨</span>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .progress-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
    }

    .star-badge {
      position: relative;
      width: 50px;
      height: 50px;
    }

    .star-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }

    .star-icon {
      position: absolute;
      width: 50px;
      height: 50px;
      transition: all 0.3s ease;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    }

    .score-text {
      position: relative;
      z-index: 1;
      font-size: 0.65rem;
      font-weight: 700;
      color: white;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      line-height: 1;
    }

    .sparkle {
      position: absolute;
      top: -8px;
      right: -8px;
      font-size: 1rem;
      animation: sparkle 1.5s ease-in-out infinite;
      z-index: 2;
    }

    @keyframes sparkle {
      0%, 100% {
        opacity: 1;
        transform: scale(1) rotate(0deg);
      }
      50% {
        opacity: 0.7;
        transform: scale(1.2) rotate(180deg);
      }
    }

    /* Niveau 0-24% : Étoile grise (début) */
    .star-badge.star-gray .star-icon {
      filter: drop-shadow(0 2px 4px rgba(97, 97, 97, 0.4));
    }

    /* Niveau 25-49% : Bronze - couleur distincte et visible */
    .star-badge.star-bronze .star-icon {
      filter: drop-shadow(0 2px 5px rgba(205, 127, 50, 0.6)) drop-shadow(0 0 3px rgba(139, 69, 19, 0.4));
    }

    /* Niveau 50-74% : Argent - brillant et métallique */
    .star-badge.star-silver .star-icon {
      filter: drop-shadow(0 2px 6px rgba(192, 192, 192, 0.7)) drop-shadow(0 0 4px rgba(255, 255, 255, 0.5));
    }

    /* Niveau 75-99% : Or - brillant et doré */
    .star-badge.star-gold .star-icon {
      filter: drop-shadow(0 2px 8px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 6px rgba(255, 193, 7, 0.6));
    }

    /* Niveau 100% : Or brillant / Diamant - effet lumineux animé */
    .star-badge.star-diamond .star-icon {
      filter: drop-shadow(0 2px 10px rgba(255, 215, 0, 0.9)) drop-shadow(0 0 12px rgba(255, 215, 0, 0.7)) drop-shadow(0 0 20px rgba(255, 193, 7, 0.5));
      animation: shimmer 2s ease-in-out infinite;
    }

    .star-badge.star-diamond .star-icon .diamond-glow {
      filter: url(#glow);
    }

    @keyframes shimmer {
      0%, 100% {
        filter: drop-shadow(0 2px 8px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 12px rgba(255, 215, 0, 0.6));
      }
      50% {
        filter: drop-shadow(0 2px 12px rgba(255, 215, 0, 1)) drop-shadow(0 0 16px rgba(255, 215, 0, 0.8));
      }
    }
  `],
  host: {
    '[attr.data-cursor-element-id]': '"progress-badge"'
  }
})
export class ProgressBadgeComponent {
  /**
   * Score du jeu en pourcentage (0-100)
   */
  score = input.required<number>();

  /**
   * Indique si le jeu a été tenté (a un score)
   */
  hasAttempted = input.required<boolean>();

  /**
   * Indique si le jeu est complété (score = 100%)
   */
  isCompleted = computed(() => this.score() === 100);

  /**
   * Détermine le niveau de l'étoile selon le pourcentage
   * 0-24% : gris (début)
   * 25-49% : bronze
   * 50-74% : argent
   * 75-99% : or
   * 100% : or brillant / diamant
   */
  starLevel = computed<StarLevel>(() => {
    const currentScore = this.score();
    
    if (currentScore === 100) {
      return 'diamond';
    } else if (currentScore >= 75) {
      return 'gold';
    } else if (currentScore >= 50) {
      return 'silver';
    } else if (currentScore >= 25) {
      return 'bronze';
    } else {
      return 'gray';
    }
  });

  /**
   * Retourne l'ID du dégradé SVG selon le niveau
   */
  getStarGradientId(): string {
    const level = this.starLevel();
    
    switch (level) {
      case 'gray':
        return 'url(#grayGradient)';
      case 'bronze':
        return 'url(#bronzeGradient)';
      case 'silver':
        return 'url(#silverGradient)';
      case 'gold':
        return 'url(#goldGradient)';
      case 'diamond':
        return 'url(#diamondGradient)';
      default:
        return 'url(#grayGradient)';
    }
  }

  /**
   * Retourne la couleur du contour de l'étoile selon le niveau
   */
  getStarStroke(): string {
    const level = this.starLevel();
    
    switch (level) {
      case 'gray':
        return '#616161'; // Gris foncé pour contraste
      case 'bronze':
        return '#8B4513'; // Bronze foncé (saddle brown)
      case 'silver':
        return '#808080'; // Gris métallique
      case 'gold':
        return '#FFC107'; // Or ambré
      case 'diamond':
        return '#FFD700'; // Or brillant
      default:
        return '#616161';
    }
  }
}
