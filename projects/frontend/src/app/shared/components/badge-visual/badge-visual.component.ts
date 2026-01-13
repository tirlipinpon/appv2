import { Component, input, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { BadgeType } from '../../../core/types/badge.types';
import { BadgeDesignService } from '../../../core/services/badges/badge-design.service';

@Component({
  selector: 'app-badge-visual',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div
      class="badge-visual"
      [class]="'badge-' + badgeType() + ' shape-' + design().shape"
      [class.unlocked]="isUnlocked()"
      [class.locked]="!isUnlocked()"
      [style.width.px]="sizePx()"
      [style.height.px]="sizePx()"
      [style.background-color]="design().color">
      
      <!-- Forme géométrique de base -->
      <div class="badge-shape" [class]="'shape-' + design().shape">
        <!-- Icône du badge -->
        @if (showIcon()) {
          <div class="badge-icon">{{ design().icon }}</div>
        }
        
        <!-- Chiffre central (valeur obtenue) -->
        @if (formattedValue() !== undefined && formattedValue() !== null) {
          <div class="badge-value">
            {{ formattedValue() }}
          </div>
        }
        
        <!-- Niveau (petit badge en haut à droite) -->
        @if (isUnlocked() && level()) {
          <div class="badge-level">
            N{{ level() }}
          </div>
        }
      </div>
      
      <!-- Effet de brillance pour badges débloqués -->
      @if (isUnlocked()) {
        <div class="badge-shine"></div>
      }
    </div>
  `,
  styles: [`
    .badge-visual {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.3s ease;
      overflow: hidden;
    }

    .badge-visual.locked {
      opacity: 0.5;
      filter: grayscale(100%);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    }

    .badge-visual.unlocked {
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
    }

    .badge-shape {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }

    /* Forme : Cercle */
    .shape-circle {
      border-radius: 50%;
      border: 4px solid rgba(255, 255, 255, 0.3);
    }

    /* Forme : Étoile */
    .shape-star {
  clip-path: polygon(
    50% 0%,
    72% 28%,
    100% 40%,
    78% 65%,
    92% 100%,
    50% 85%,
    8% 100%,
    22% 65%,
    0% 40%,
    28% 28%
  );
}





    /* Forme : Hexagone */
    .shape-hexagon {
      clip-path: polygon(
        25% 0%,
        75% 0%,
        100% 50%,
        75% 100%,
        25% 100%,
        0% 50%
      );
    }

    /* Forme : Médaille */
    .shape-medal {
      border-radius: 50%;
      border: 6px solid rgba(255, 255, 255, 0.5);
      box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.2);
    }

    /* Forme : Couronne */
    .shape-crown {
      clip-path: polygon(
        0% 60%,
        20% 0%,
        40% 40%,
        50% 0%,
        60% 40%,
        80% 0%,
        100% 60%,
        100% 100%,
        0% 100%
      );
    }

    /* Forme : Diamant */
    .shape-diamond {
      clip-path: polygon(
        50% 0%,
        100% 50%,
        50% 100%,
        0% 50%
      );
    }

    .badge-icon {
      font-size: 2rem;
      margin-bottom: 0.25rem;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    }

    .badge-value {
      font-size: 2.2rem;
      font-weight: 700;
      color: white;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      line-height: 1;
      padding: 0.2rem 0;
    }

    .badge-level {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(255, 255, 255, 0.9);
      color: #333;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      z-index: 3;
    }

    .badge-shine {
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(
        45deg,
        transparent 30%,
        rgba(255, 255, 255, 0.3) 50%,
        transparent 70%
      );
      animation: shine 3s ease-in-out infinite;
      z-index: 1;
    }

    @keyframes shine {
      0% {
        transform: translateX(-100%) translateY(-100%) rotate(45deg);
      }
      100% {
        transform: translateX(100%) translateY(100%) rotate(45deg);
      }
    }

  `],
})
export class BadgeVisualComponent {
  private readonly designService = inject(BadgeDesignService);

  // Inputs
  badgeType = input.required<BadgeType>();
  value = input<number | object | undefined>(undefined);
  level = input<number | undefined>(undefined);
  isUnlocked = input<boolean>(false);
  size = input<'small' | 'medium' | 'large'>('medium');
  showIcon = input<boolean>(true);

  // Formater la valeur selon le type de badge
  formattedValue = computed(() => {
    const val = this.value();
    if (val === undefined || val === null) {
      return undefined;
    }
    
    // Si c'est un nombre, retourner directement
    if (typeof val === 'number') {
      return val;
    }
    
    // Si c'est un objet (JSONB), formater selon le type de badge
    if (typeof val === 'object' && val !== null) {
      if (this.badgeType() === 'daily_activity') {
        // Pour daily_activity, afficher les minutes
        const activity = val as { minutes?: number; games?: number; level?: number };
        if (activity.minutes !== undefined) {
          return activity.minutes;
        }
      }
      // Pour les autres badges avec objet, essayer d'extraire une valeur numérique
      const numValue = (val as any).value ?? (val as any).count ?? Object.values(val)[0];
      if (typeof numValue === 'number') {
        return numValue;
      }
    }
    
    // Par défaut, retourner undefined (ne pas afficher)
    return undefined;
  });

  // Design calculé
  design = computed(() => {
    const level = this.level() || 1;
    return this.designService.generateBadgeDesign(
      this.badgeType(),
      level,
      this.formattedValue()
    );
  });

  // Taille en pixels selon la taille
  sizePx = computed(() => {
    const size = this.size();
    switch (size) {
      case 'small':
        return 80;
      case 'medium':
        return 120;
      case 'large':
        return 160;
      default:
        return 120;
    }
  });
}
