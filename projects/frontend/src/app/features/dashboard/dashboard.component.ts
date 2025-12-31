import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardApplication } from './components/application/application';
import { ChildAuthService } from '../../core/auth/child-auth.service';
import { MascotComponent } from '../../shared/components/mascot/mascot.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar.component';
import { ChildButtonComponent } from '../../shared/components/child-button/child-button.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MascotComponent,
    ProgressBarComponent,
    ChildButtonComponent,
  ],
  template: `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <h1>Mon Tableau de Bord</h1>
        <app-mascot
          [childId]="childId()"
          [showInfo]="true"
          size="medium">
        </app-mascot>
      </div>

      <div *ngIf="application.isLoading()" class="loading">
        Chargement de tes statistiques...
      </div>

      <div *ngIf="application.getError()" class="error">
        {{ application.getError() }}
      </div>

      <div *ngIf="!application.isLoading() && !application.getError() && application.getStatistics()()" class="dashboard-content">
        <!-- Statistiques principales -->
        <div class="stats-grid">
          <div class="stat-card games">
            <div class="stat-icon">🎮</div>
            <div class="stat-value">{{ application.getStatistics()()?.total_games_played || 0 }}</div>
            <div class="stat-label">Jeux joués</div>
          </div>
          <div class="stat-card success">
            <div class="stat-icon">✅</div>
            <div class="stat-value">{{ application.getSuccessRatePercentage()() }}%</div>
            <div class="stat-label">Taux de réussite</div>
          </div>
          <div class="stat-card stars">
            <div class="stat-icon">⭐</div>
            <div class="stat-value">{{ application.getStatistics()()?.total_stars || 0 }}</div>
            <div class="stat-label">Étoiles</div>
          </div>
          <div class="stat-card completed">
            <div class="stat-icon">🏆</div>
            <div class="stat-value">{{ application.getStatistics()()?.completed_subject_categories_count || 0 }}</div>
            <div class="stat-label">Sous-matières terminées</div>
          </div>
        </div>

        <!-- Progression globale -->
        <div class="progress-section">
          <h2>Ma Progression</h2>
          <div class="progress-cards">
            <div class="progress-card">
              <h3>Jeux réussis</h3>
              <app-progress-bar
                [value]="application.getStatistics()()?.total_games_succeeded || 0"
                [max]="application.getStatistics()()?.total_games_played || 1"
                [label]="'Réussite'"
                variant="success">
              </app-progress-bar>
              <p class="progress-text">
                {{ application.getStatistics()()?.total_games_succeeded || 0 }} sur {{ application.getStatistics()()?.total_games_played || 0 }} jeux réussis
              </p>
            </div>
          </div>
        </div>

        <!-- Récompenses récentes -->
        <div class="rewards-section" *ngIf="application.getRecentCollectibles()().length > 0">
          <h2>Objets récemment débloqués</h2>
          <div class="rewards-carousel">
            <div
              *ngFor="let collectible of application.getRecentCollectibles()()"
              class="reward-card">
              <div class="reward-image">
                <img
                  *ngIf="collectible.collectible?.image_url"
                  [src]="collectible.collectible.image_url"
                  [alt]="collectible.collectible.name">
                <div *ngIf="!collectible.collectible?.image_url" class="placeholder-image">
                  {{ collectible.collectible?.name?.charAt(0) || '?' }}
                </div>
              </div>
              <div class="reward-info">
                <h4>{{ collectible.collectible?.name || 'Objet' }}</h4>
                <p class="reward-date">Débloqué le {{ formatDate(collectible.unlocked_at) }}</p>
              </div>
            </div>
          </div>
          <div class="view-all">
            <app-child-button [routerLink]="['/collection']" variant="secondary" size="medium">
              Voir toute ma collection
            </app-child-button>
          </div>
        </div>

        <!-- Actions rapides -->
        <div class="quick-actions">
          <h2>Actions rapides</h2>
          <div class="actions-grid">
            <app-child-button [routerLink]="['/subjects']" variant="primary" size="large">
              🎯 Jouer à un jeu
            </app-child-button>
            <app-child-button [routerLink]="['/collection']" variant="secondary" size="large">
              🏆 Ma collection
            </app-child-button>
            <app-child-button [routerLink]="['/settings']" variant="secondary" size="large">
              ⚙️ Paramètres
            </app-child-button>
          </div>
        </div>
      </div>

      <div *ngIf="!application.isLoading() && !application.getStatistics()()" class="empty-state">
        <p>Commence à jouer pour voir tes statistiques !</p>
        <app-child-button [routerLink]="['/subjects']" variant="primary" size="large">
          Choisir une matière
        </app-child-button>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 1rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    @media (min-width: 768px) {
      .dashboard-container {
        padding: 2rem;
      }
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    h1 {
      margin: 0;
      color: var(--theme-text-color, #333);
    }

    .loading, .error {
      text-align: center;
      padding: 2rem;
    }

    .error {
      color: var(--theme-warn-color, #F44336);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    @media (min-width: 768px) {
      .stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1.5rem;
      }
    }

    .stat-card {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 1.5rem;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s ease;
    }

    .stat-card:hover {
      transform: translateY(-4px);
    }

    .stat-icon {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--theme-primary-color, #4CAF50);
      margin-bottom: 0.5rem;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #666;
    }

    .progress-section, .rewards-section, .quick-actions {
      margin-bottom: 3rem;
    }

    h2 {
      margin-bottom: 1.5rem;
      color: var(--theme-text-color, #333);
    }

    .progress-cards {
      display: grid;
      gap: 1.5rem;
    }

    .progress-card {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .progress-card h3 {
      margin: 0 0 1rem 0;
      color: var(--theme-text-color, #333);
    }

    .progress-text {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: #666;
    }

    .rewards-carousel {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .reward-card {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 1rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      text-align: center;
    }

    .reward-image {
      width: 100%;
      height: 100px;
      background: #f0f0f0;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.5rem;
      overflow: hidden;
    }

    .reward-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .placeholder-image {
      font-size: 2rem;
      font-weight: 700;
      color: var(--theme-primary-color, #4CAF50);
    }

    .reward-info h4 {
      margin: 0 0 0.25rem 0;
      font-size: 0.875rem;
      color: var(--theme-text-color, #333);
    }

    .reward-date {
      font-size: 0.75rem;
      color: #999;
      margin: 0;
    }

    .view-all {
      text-align: center;
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #999;
    }
  `]
})
export class DashboardComponent implements OnInit {
  protected readonly application = inject(DashboardApplication);
  private readonly authService = inject(ChildAuthService);

  childId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const child = await this.authService.getCurrentChild();
    if (child) {
      this.childId.set(child.child_id);
      await this.application.initialize();
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}
