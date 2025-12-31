import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollectionApplication } from './components/application/application';
import { CollectionFilter } from './types/collection.types';
import { ChildButtonComponent } from '../../shared/components/child-button/child-button.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar.component';

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [CommonModule, ChildButtonComponent, ProgressBarComponent],
  template: `
    <div class="collection-container">
      <h1>Ma Collection</h1>

      <div *ngIf="application.isLoading()" class="loading">
        Chargement de ta collection...
      </div>

      <div *ngIf="application.getError()" class="error">
        {{ application.getError() }}
      </div>

      <div *ngIf="!application.isLoading() && !application.getError()" class="collection-content">
        <!-- Statistiques -->
        <div class="collection-stats">
          <div class="stat-card">
            <div class="stat-value">{{ application.getUnlockedCount()() }}</div>
            <div class="stat-label">Objets débloqués</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ application.getTotalCount()() }}</div>
            <div class="stat-label">Total</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ application.getCompletionPercentage()() }}%</div>
            <div class="stat-label">Complété</div>
          </div>
        </div>

        <!-- Barre de progression globale -->
        <div class="global-progress">
          <app-progress-bar
            [value]="application.getCompletionPercentage()()"
            [max]="100"
            [label]="'Progression de la collection'"
            variant="primary">
          </app-progress-bar>
        </div>

        <!-- Filtres -->
        <div class="filters">
          <app-child-button
            (onClick)="setFilter('all')"
            [variant]="application.getFilter()() === 'all' ? 'primary' : 'secondary'"
            size="small">
            Tous
          </app-child-button>
          <app-child-button
            (onClick)="setFilter('unlocked')"
            [variant]="application.getFilter()() === 'unlocked' ? 'primary' : 'secondary'"
            size="small">
            Débloqués
          </app-child-button>
          <app-child-button
            (onClick)="setFilter('locked')"
            [variant]="application.getFilter()() === 'locked' ? 'primary' : 'secondary'"
            size="small">
            Verrouillés
          </app-child-button>
        </div>

        <!-- Grille d'objets -->
        <div class="collectibles-grid">
          <div
            *ngFor="let collectible of application.getCollectibles()()"
            class="collectible-card"
            [class.unlocked]="collectible.isUnlocked"
            [class.locked]="!collectible.isUnlocked">
            <div class="collectible-image">
              <img
                *ngIf="collectible.image_url"
                [src]="collectible.image_url"
                [alt]="collectible.name"
                [class]="collectible.isUnlocked ? '' : 'locked-image'">
              <div *ngIf="!collectible.image_url" class="placeholder-image">
                {{ collectible.name.charAt(0) }}
              </div>
              <div *ngIf="!collectible.isUnlocked" class="lock-overlay">
                🔒
              </div>
            </div>
            <div class="collectible-info">
              <h3>{{ collectible.name }}</h3>
              <p *ngIf="collectible.description">{{ collectible.description }}</p>
              <div *ngIf="collectible.isUnlocked && collectible.unlockedAt" class="unlocked-date">
                Débloqué le {{ formatDate(collectible.unlockedAt) }}
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="application.getCollectibles()().length === 0" class="empty-state">
          <p>Aucun objet dans ta collection pour le moment.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .collection-container {
      padding: 1rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    @media (min-width: 768px) {
      .collection-container {
        padding: 2rem;
      }
    }

    h1 {
      margin-bottom: 2rem;
      color: var(--theme-text-color, #333);
    }

    .loading, .error {
      text-align: center;
      padding: 2rem;
    }

    .error {
      color: var(--theme-warn-color, #F44336);
    }

    .collection-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 1.5rem;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

    .global-progress {
      margin-bottom: 2rem;
    }

    .filters {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .collectibles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1rem;
    }
    @media (min-width: 768px) {
      .collectibles-grid {
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1.5rem;
      }
    }

    .collectible-card {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      position: relative;
    }

    .collectible-card.unlocked {
      border: 2px solid var(--theme-primary-color, #4CAF50);
    }

    .collectible-card.locked {
      opacity: 0.6;
      filter: grayscale(100%);
    }

    .collectible-card.unlocked:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .collectible-image {
      width: 100%;
      height: 200px;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }

    .collectible-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .collectible-image .locked-image {
      filter: blur(5px) grayscale(100%);
    }

    .placeholder-image {
      font-size: 4rem;
      font-weight: 700;
      color: var(--theme-primary-color, #4CAF50);
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

    .collectible-info {
      padding: 1rem;
    }

    .collectible-info h3 {
      margin: 0 0 0.5rem 0;
      color: var(--theme-text-color, #333);
      font-size: 1.125rem;
    }

    .collectible-info p {
      margin: 0 0 0.5rem 0;
      color: #666;
      font-size: 0.875rem;
    }

    .unlocked-date {
      font-size: 0.75rem;
      color: var(--theme-primary-color, #4CAF50);
      font-weight: 600;
      margin-top: 0.5rem;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #999;
    }
  `]
})
export class CollectionComponent implements OnInit {
  protected readonly application = inject(CollectionApplication);

  async ngOnInit(): Promise<void> {
    await this.application.initialize();
  }

  setFilter(filter: CollectionFilter): void {
    this.application.setFilter(filter);
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
