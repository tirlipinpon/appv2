import { Component, input, output, signal, effect, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { ChildButtonComponent } from '../child-button/child-button.component';
import { BadgeVisualComponent } from '../badge-visual/badge-visual.component';
import { BadgeNextLevelComponent } from '../badge-next-level/badge-next-level.component';
import { BadgeType, BadgeLevel, BadgeWithStatus } from '../../../core/types/badge.types';
import { BadgesService } from '../../../core/services/badges/badges.service';
import { ChildAuthService } from '../../../core/auth/child-auth.service';
import { getNextLevelMessage } from '../../../core/utils/badge-progression.util';

export interface BadgeNotificationData {
  badge_id: string;
  badge_name: string;
  badge_type: BadgeType;
  level: number;
  value: number | object; // JSONB: peut être un nombre ou un objet (pour daily_activity)
  description?: string;
}

@Component({
  selector: 'app-badge-notification-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChildButtonComponent, BadgeVisualComponent, BadgeNextLevelComponent],
  template: `
    @if (visible()) {
      <div class="modal-overlay" (click)="onOverlayClick()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <!-- Animation de célébration -->
          @if (visible()) {
            <div class="celebration">
              @for (confetti of confettiArray(); track confetti.x) {
                <div 
                  class="confetti" 
                  [style.--confetti-color]="confetti.color"
                  [style.--confetti-x]="confetti.x"
                  [style.--confetti-delay]="confetti.delay + 's'">
                </div>
              }
            </div>
          }

        <!-- Titre -->
        <h1 class="modal-title">
          🎉 Badge Débloqué ! 🎉
        </h1>

        <!-- Badge visuel -->
        <div class="badge-display">
          <app-badge-visual
            [badgeType]="badgeType()"
            [value]="value()"
            [level]="level()"
            [isUnlocked]="true"
            size="large"
            [showIcon]="true">
          </app-badge-visual>
        </div>

          <!-- Nom du badge -->
          <div class="badge-name">
            {{ badgeName() }}
          </div>

          <!-- Description -->
          @if (description()) {
            <div class="badge-description">
              {{ description() }}
            </div>
          }

          <!-- Informations supplémentaires -->
          <div class="badge-info">
            @if (formattedValue() !== undefined && formattedValue() !== null) {
              <div class="info-item">
                <span class="info-label">Valeur obtenue :</span>
                <span class="info-value">{{ formattedValue() }}</span>
              </div>
            }
            @if (level()) {
              <div class="info-item">
                <span class="info-label">Niveau :</span>
                <span class="info-value">N{{ level() }}</span>
              </div>
            }
            <app-badge-next-level [message]="nextLevelMessage()" />
          </div>

          <!-- Bouton continuer -->
          <div class="modal-actions">
            <app-child-button
              (buttonClick)="onContinue()"
              variant="primary"
              size="large">
              Continuer
            </app-child-button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      animation: fadeIn 0.3s ease;
      padding: 1rem;
      backdrop-filter: blur(8px);
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .modal-content {
      text-align: center;
      padding: 3rem 2rem;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border-radius: var(--theme-border-radius, 16px);
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
      max-width: 500px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUpScale 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
      overflow: hidden;
    }

    @keyframes slideUpScale {
      from {
        opacity: 0;
        transform: translateY(50px) scale(0.8);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Animation de célébration */
    .celebration {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .confetti {
      position: absolute;
      width: 10px;
      height: 10px;
      background: var(--confetti-color, #FFD700);
      top: -10px;
      left: calc(var(--confetti-x, 50) * 1%);
      animation: confettiFall 3s ease-in forwards;
      animation-delay: var(--confetti-delay, 0s);
    }

    @keyframes confettiFall {
      0% {
        transform: translateY(0) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translateY(100vh) rotate(720deg);
        opacity: 0;
      }
    }

    .modal-title {
      margin: 0 0 2rem 0;
      color: var(--theme-text-color, #333);
      font-size: 2rem;
      font-weight: 700;
      animation: bounce 0.6s ease;
    }

    @keyframes bounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-10px);
      }
    }

    .badge-display {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 2rem 0;
      animation: badgePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
    }

    @keyframes badgePop {
      0% {
        transform: scale(0);
        opacity: 0;
      }
      50% {
        transform: scale(1.2);
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    .badge-name {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--theme-text-color, #333);
      margin: 1.5rem 0;
      animation: fadeInUp 0.5s ease 0.4s both;
    }

    .badge-description {
      font-size: 1.125rem;
      color: #666;
      margin: 1rem 0;
      line-height: 1.5;
      animation: fadeInUp 0.5s ease 0.5s both;
    }

    .badge-info {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin: 1.5rem 0;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.03);
      border-radius: var(--theme-border-radius, 8px);
      animation: fadeInUp 0.5s ease 0.6s both;
    }

    .info-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 1rem;
    }

    .info-label {
      color: #666;
      font-weight: 500;
    }

    .info-value {
      color: var(--theme-primary-color, #4CAF50);
      font-weight: 700;
      font-size: 1.125rem;
    }

    .modal-actions {
      display: flex;
      justify-content: center;
      margin-top: 2rem;
      animation: fadeInUp 0.5s ease 0.7s both;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 480px) {
      .modal-content {
        padding: 2rem 1.5rem;
      }

      .modal-title {
        font-size: 1.5rem;
      }

      .badge-name {
        font-size: 1.25rem;
      }

      .badge-description {
        font-size: 1rem;
      }
    }
  `],
})
export class BadgeNotificationModalComponent {
  private readonly badgesService = inject(BadgesService);
  private readonly authService = inject(ChildAuthService);

  visible = input<boolean>(false);
  badgeName = input<string>('');
  badgeType = input.required<BadgeType>();
  level = input<number | undefined>(undefined);
  value = input<number | object | undefined>(undefined);
  description = input<string | undefined>(undefined);
  closeOnOverlayClick = input<boolean>(false);

  continueClick = output<void>();
  overlayClick = output<void>();

  // Génération de confettis pour l'animation
  confettiArray = signal<{ color: string; x: number; delay: number }[]>([]);
  private readonly confettiColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3', '#54A0FF', '#FF9FF3'];

  // BadgeLevel pour calculer le prochain niveau
  private readonly badgeLevel = signal<BadgeLevel | null>(null);

  // Message du prochain niveau calculé
  nextLevelMessage = computed(() => {
    const currentBadgeType = this.badgeType();
    const currentLevel = this.badgeLevel();
    const unlockedLevel = this.level();
    const currentValue = this.value();

    // Construire un BadgeWithStatus minimal pour getNextLevelMessage
    // Utiliser current_level du BadgeLevel (niveau actuel du badge) ou le niveau débloqué ou 1 par défaut
    const currentThreshold = currentLevel?.current_level ?? unlockedLevel ?? 1;

    const badge: Partial<BadgeWithStatus> = {
      badge_type: currentBadgeType,
      isUnlocked: true,
      currentThreshold: currentThreshold,
      description: this.description(),
    };

    // Extraire la progression actuelle depuis la valeur du badge si disponible
    let currentProgress: number | { minutes: number; games: number } | undefined = undefined;
    if (currentValue !== undefined && currentValue !== null) {
      if (typeof currentValue === 'number') {
        currentProgress = currentValue;
      } else if (typeof currentValue === 'object' && currentValue !== null) {
        if (currentBadgeType === 'daily_activity') {
          const activity = currentValue as { minutes?: number; games?: number };
          currentProgress = {
            minutes: activity.minutes ?? 0,
            games: activity.games ?? 0,
          };
        }
      }
    }

    return getNextLevelMessage(badge as BadgeWithStatus, currentLevel ?? undefined, currentProgress);
  });

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
        // Pour daily_activity, afficher les minutes et jeux
        const activity = val as { minutes?: number; games?: number; level?: number };
        if (activity.minutes !== undefined && activity.games !== undefined) {
          return `${activity.minutes} min, ${activity.games} jeux`;
        }
      }
      // Pour les autres badges avec objet, essayer d'extraire une valeur numérique
      const valObj = val as Record<string, unknown>;
      const numValue = (valObj['value'] as number | undefined) ?? (valObj['count'] as number | undefined) ?? Object.values(val)[0] as number | undefined;
      if (typeof numValue === 'number') {
        return numValue;
      }
    }
    
    // Par défaut, convertir en string
    return String(val);
  });

  constructor() {
    // Générer les confettis quand la modal devient visible
    effect(() => {
      if (this.visible()) {
        this.generateConfetti();
        this.loadBadgeLevel();
      }
    });
  }

  /**
   * Charge le BadgeLevel pour le badge actuel afin de calculer le prochain niveau
   */
  private async loadBadgeLevel(): Promise<void> {
    const child = this.authService.getCurrentChild();
    if (!child) {
      return;
    }

    try {
      const level = await this.badgesService.getBadgeLevel(child.child_id, this.badgeType());
      this.badgeLevel.set(level);
    } catch (error) {
      console.error('[BadgeNotificationModalComponent] Erreur lors du chargement du niveau du badge:', error);
      this.badgeLevel.set(null);
    }
  }

  private generateConfetti(): void {
    const count = 30;
    const confetti: { color: string; x: number; delay: number }[] = [];
    for (let i = 0; i < count; i++) {
      confetti.push({
        color: this.confettiColors[Math.floor(Math.random() * this.confettiColors.length)],
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
      });
    }
    this.confettiArray.set(confetti);
  }

  onContinue(): void {
    this.continueClick.emit();
  }

  onOverlayClick(): void {
    if (this.closeOnOverlayClick()) {
      this.overlayClick.emit();
    }
  }
}
