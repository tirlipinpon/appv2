import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { BonusGamesApplication } from './components/application/application';
import { ChildButtonComponent } from '../../shared/components/child-button/child-button.component';

@Component({
  selector: 'app-bonus-games',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChildButtonComponent],
  template: `
    <div class="bonus-games-container">
      <h1>Mini-Jeux Bonus</h1>
      <p class="subtitle">Débloque des mini-jeux amusants en complétant des matières !</p>

      @if (application.isLoading()) {
        <div class="loading">
          Chargement des mini-jeux...
        </div>
      }

      @if (application.getError()) {
        <div class="error">
          {{ application.getError() }}
        </div>
      }

      @if (!application.isLoading() && !application.getError()) {
        <div class="bonus-games-content">
        <!-- Statistiques -->
        <div class="stats-bar">
          <div class="stat">
            <span class="stat-value">{{ application.getUnlockedCount()() }}</span>
            <span class="stat-label">Débloqués</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ application.getTotalCount()() }}</span>
            <span class="stat-label">Total</span>
          </div>
        </div>

          <!-- Liste des mini-jeux -->
          <div class="games-grid">
            @for (game of application.getGames()(); track game.id) {
              <div
                class="game-card"
                [class.unlocked]="game.isUnlocked"
                [class.locked]="!game.isUnlocked">
                <div class="game-image">
                  @if (game.image_url) {
                    <img
                      [src]="game.image_url"
                      [alt]="game.name"
                      [class]="game.isUnlocked ? '' : 'locked-image'">
                  }
                  @if (!game.image_url) {
                    <div class="placeholder-image">
                      🎮
                    </div>
                  }
                  @if (!game.isUnlocked) {
                    <div class="lock-overlay">
                      🔒
                    </div>
                  }
                </div>
                <div class="game-info">
                  <h3>{{ game.name }}</h3>
                  @if (game.description) {
                    <p>{{ game.description }}</p>
                  }
                  @if (game.isUnlocked && game.unlockData) {
                    <div class="game-stats">
                      <span>Joué {{ game.unlockData.played_count }} fois</span>
                    </div>
                  }
                  @if (!game.isUnlocked) {
                    <div class="locked-message">
                      Complète une matière pour débloquer ce mini-jeu
                    </div>
                  }
                  @if (game.isUnlocked) {
                    <app-child-button
                      (buttonClick)="playGame(game.id)"
                      variant="primary"
                      size="medium">
                      Jouer
                    </app-child-button>
                  }
                </div>
              </div>
            }
          </div>

          @if (application.getGames()().length === 0) {
            <div class="empty-state">
              <p>Aucun mini-jeu bonus disponible pour le moment.</p>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .bonus-games-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    h1 {
      margin-bottom: 0.5rem;
      color: var(--theme-text-color, #333);
    }

    .subtitle {
      color: #666;
      margin-bottom: 2rem;
    }

    .loading, .error {
      text-align: center;
      padding: 2rem;
    }

    .error {
      color: var(--theme-warn-color, #F44336);
    }

    .stats-bar {
      display: flex;
      gap: 2rem;
      margin-bottom: 2rem;
      padding: 1rem;
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--theme-primary-color, #4CAF50);
    }

    .stat-label {
      font-size: 0.875rem;
      color: #666;
    }

    .games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .game-card {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
    }

    .game-card.unlocked {
      border: 2px solid var(--theme-primary-color, #4CAF50);
    }

    .game-card.locked {
      opacity: 0.6;
      filter: grayscale(100%);
    }

    .game-card.unlocked:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .game-image {
      width: 100%;
      height: 200px;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }

    .game-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .game-image .locked-image {
      filter: blur(5px) grayscale(100%);
    }

    .placeholder-image {
      font-size: 4rem;
    }

    .lock-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 3rem;
      background: rgba(0, 0, 0, 0.7);
      border-radius: 50%;
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .game-info {
      padding: 1.5rem;
    }

    .game-info h3 {
      margin: 0 0 0.5rem 0;
      color: var(--theme-text-color, #333);
    }

    .game-info p {
      margin: 0 0 1rem 0;
      color: #666;
      font-size: 0.875rem;
    }

    .game-stats {
      margin-bottom: 1rem;
      font-size: 0.875rem;
      color: var(--theme-primary-color, #4CAF50);
      font-weight: 600;
    }

    .locked-message {
      margin-bottom: 1rem;
      font-size: 0.875rem;
      color: #999;
      font-style: italic;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #999;
    }
  `]
})
export class BonusGamesComponent implements OnInit {
  protected readonly application = inject(BonusGamesApplication);

  async ngOnInit(): Promise<void> {
    await this.application.initialize();
  }

  playGame(gameId: string): void {
    // TODO: Implémenter le lancement du mini-jeu
    alert('Fonctionnalité de jeu à venir !');
  }
}

