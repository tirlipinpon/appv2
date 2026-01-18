import { Component, input, ChangeDetectionStrategy } from '@angular/core';

/**
 * Composant partagé pour afficher le message du prochain niveau d'un badge
 * Affiche "Prochain : ..." ou "Objectif : ..." selon le statut du badge
 */
@Component({
  selector: 'app-badge-next-level',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    @if (message()) {
      <div class="next-level-hint">
        ➡️ {{ message() }}
      </div>
    }
  `,
  styles: [`
    .next-level-hint {
      margin-top: 0.75rem;
      padding: 0.5rem;
      background: rgba(76, 175, 80, 0.1);
      border-radius: var(--theme-border-radius, 8px);
      color: var(--theme-primary-color, #4CAF50);
      font-size: 0.8125rem;
      font-weight: 600;
      text-align: center;
    }
    
    @media (min-width: 769px) {
      .next-level-hint {
        font-size: 0.9375rem;
        padding: 0.75rem;
      }
    }
  `],
})
export class BadgeNextLevelComponent {
  /**
   * Message du prochain niveau à afficher (peut être null si pas de prochain niveau)
   * Format : "Prochain : X jeux parfaits" ou "Objectif : X jeux parfaits"
   */
  message = input<string | null>(null);
}
