import { Component, input, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { SessionStarService } from '../../../core/services/session-star/session-star.service';

@Component({
  selector: 'app-stars-display',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    @if (count() > 0) {
      <div 
        class="stars-display" 
        [class.stars-display-vertical]="orientation() === 'vertical'"
        [class.stars-display-horizontal]="orientation() === 'horizontal'"
        [class.stars-position-absolute]="position() === 'absolute'"
        [style.right]="position() === 'absolute' && alignment() === 'right' ? '0' : null"
        [style.left]="position() === 'absolute' && alignment() === 'left' ? '0' : null">
        @for (star of starsArray(); track $index; let i = $index) {
          <span 
            class="star" 
            [class.filled]="true"
            [class.star-blink-active]="isStarBlinking(i)"
            [class.star-blink-inactive]="isStarBlinking(i) && !isBlinkingActive()"
            [style.color]="starColor()">
            ★
          </span>
        }
      </div>
    }
  `,
  styles: [`
    .stars-display {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .stars-display-vertical {
      flex-direction: column;
      gap: 0.25rem;
    }

    .stars-display-horizontal {
      flex-direction: row;
      gap: 0.25rem;
    }

    .stars-position-absolute {
      position: absolute;
      top: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      padding: 0 0.5rem;
    }

    .star {
      font-size: 1.5rem;
      line-height: 1;
      display: inline-block;
      transition: opacity 0.3s ease, transform 0.3s ease, filter 0.3s ease;
    }

    .star.filled {
      /* Couleur gérée par [style.color] */
    }

    .star-blink-active {
      opacity: 1;
      transform: scale(1.2);
      filter: drop-shadow(0 0 8px currentColor);
    }

    .star-blink-inactive {
      opacity: 0.4;
      transform: scale(1);
      filter: none;
    }

    @media (max-width: 480px) {
      .star {
        font-size: 1.25rem;
      }
    }
  `]
})
export class StarsDisplayComponent {
  private readonly sessionStarService = inject(SessionStarService);

  /**
   * Nombre d'étoiles à afficher
   */
  count = input<number>(0);

  /**
   * Couleur des étoiles ('gold' pour sous-matières, 'silver' pour matières)
   */
  color = input<'gold' | 'silver'>('gold');

  /**
   * Orientation des étoiles ('vertical' par défaut)
   */
  orientation = input<'vertical' | 'horizontal'>('vertical');

  /**
   * Position du conteneur ('relative' par défaut, 'absolute' pour positionnement)
   */
  position = input<'absolute' | 'relative'>('relative');

  /**
   * Alignement pour position absolute ('right' par défaut)
   */
  alignment = input<'right' | 'left' | 'center'>('right');

  /**
   * Type d'étoile ('category' ou 'subject')
   */
  type = input<'category' | 'subject' | null>(null);

  /**
   * ID de la catégorie ou matière (nécessaire pour le clignotement)
   */
  entityId = input<string | null>(null);

  /**
   * Tableau d'étoiles pour la boucle @for
   */
  starsArray = computed(() => {
    return Array(this.count()).fill(0);
  });

  /**
   * Couleur CSS selon le type
   */
  starColor = computed(() => {
    return this.color() === 'gold' ? '#FFD700' : '#C0C0C0';
  });

  /**
   * Vérifie si une étoile spécifique doit clignoter.
   * Les premières étoiles (index < newStarsCount) sont nouvelles.
   *
   * @param index Index de l'étoile dans le tableau
   * @returns true si l'étoile doit clignoter
   */
  isStarBlinking(index: number): boolean {
    const type = this.type();
    const entityId = this.entityId();
    
    // Si pas de type/ID, pas de clignotement
    if (!type || !entityId) {
      return false;
    }

    // Vérifier si cette entité a des étoiles nouvelles
    if (!this.sessionStarService.isStarBlinking(type, entityId)) {
      return false;
    }

    // Les premières étoiles sont nouvelles (on considère qu'une seule nouvelle étoile à la fois)
    // Si on veut supporter plusieurs nouvelles étoiles, on peut utiliser getNewStarsCount()
    const newStarsCount = this.sessionStarService.getNewStarsCount(type, entityId);
    return index < newStarsCount;
  }

  /**
   * Retourne l'état actuel du clignotement.
   *
   * @returns true si le clignotement est actif (étoile visible)
   */
  isBlinkingActive(): boolean {
    return this.sessionStarService.blinkingState();
  }
}
