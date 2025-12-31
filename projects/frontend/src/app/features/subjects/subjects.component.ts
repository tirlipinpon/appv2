import { Component, inject, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SubjectsApplication } from './components/application/application';
import { SubjectsInfrastructure } from './components/infrastructure/infrastructure';
import { ChildAuthService } from '../../core/auth/child-auth.service';
import { ChildButtonComponent } from '../../shared/components/child-button/child-button.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar.component';
import { StarRatingComponent } from '../../shared/components/star-rating/star-rating.component';
import { Game } from '../../core/types/game.types';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ChildButtonComponent,
    ProgressBarComponent,
    StarRatingComponent,
  ],
  template: `
    <div class="subjects-container">
      <h1>Choisis une matière</h1>

      <div *ngIf="application.isLoading()" class="loading">
        Chargement...
      </div>

      <div *ngIf="application.getError()" class="error">
        {{ application.getError() }}
      </div>

      <!-- Liste des matières -->
      <div class="subjects-grid" *ngIf="!application.isLoading() && !selectedSubjectId()">
        <div
          *ngFor="let subject of application.getSubjects()()"
          class="subject-card"
          (click)="selectSubject(subject.id)"
          (keydown.enter)="selectSubject(subject.id)"
          tabindex="0"
          role="button">
          <h2>{{ subject.name }}</h2>
          <p *ngIf="subject.description">{{ subject.description }}</p>
        </div>
      </div>

      <!-- Sous-matières d'une matière sélectionnée -->
      <div *ngIf="selectedSubjectId() && selectedSubject()() && !selectedCategoryId()" class="categories-view">
        <div class="back-button">
          <app-child-button (onClick)="goBack()" variant="secondary" size="small">
            ← Retour
          </app-child-button>
        </div>
        <h2>{{ selectedSubject()()?.name }}</h2>
        <div class="categories-grid">
          <div
            *ngFor="let category of application.getCategories()()"
            class="category-card"
            (click)="selectCategory(category.id)"
            (keydown.enter)="selectCategory(category.id)"
            tabindex="0"
            role="button">
            <h3>{{ category.name }}</h3>
            <p *ngIf="category.description">{{ category.description }}</p>
            <div *ngIf="category.progress" class="category-progress">
              <app-progress-bar
                [value]="category.progress.completion_percentage"
                [max]="100"
                [label]="'Progression'"
                variant="primary">
              </app-progress-bar>
              <app-star-rating
                [rating]="category.progress.stars_count"
                [maxStars]="3"
                [showText]="true">
              </app-star-rating>
              <div *ngIf="category.progress.completed" class="completed-badge">
                ✓ Terminé
              </div>
            </div>
            <div *ngIf="!category.progress" class="not-started">
              Pas encore commencé
            </div>
          </div>
        </div>
      </div>

      <!-- Jeux d'une sous-matière sélectionnée -->
      <div *ngIf="selectedCategoryId()" class="games-view">
        <div class="back-button">
          <app-child-button (onClick)="goBack()" variant="secondary" size="small">
            ← Retour
          </app-child-button>
        </div>
        <h2>Jeux disponibles</h2>
        <div *ngIf="loadingGames()" class="loading">Chargement des jeux...</div>
        <div class="games-grid" *ngIf="!loadingGames()">
          <div
            *ngFor="let game of categoryGames()"
            class="game-card"
            [routerLink]="['/game', game.id]">
            <h3>{{ game.name }}</h3>
            <p *ngIf="game.description">{{ game.description }}</p>
            <div class="game-type">
              Type: {{ game.game_type }}
            </div>
          </div>
        </div>
        <div *ngIf="!loadingGames() && categoryGames().length === 0" class="empty-state">
          <p>Aucun jeu disponible pour cette sous-matière.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .subjects-container {
      padding: 1rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    @media (min-width: 768px) {
      .subjects-container {
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

    .subjects-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    @media (min-width: 480px) {
      .subjects-grid {
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1.5rem;
      }
    }

    .subject-card {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .subject-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .subject-card h2 {
      margin: 0 0 0.5rem 0;
      color: var(--theme-primary-color, #4CAF50);
    }

    .categories-view {
      margin-top: 2rem;
    }

    .back-button {
      margin-bottom: 1rem;
    }

    .categories-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    @media (min-width: 480px) {
      .categories-grid {
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 1.5rem;
      }
    }

    .category-card {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      color: inherit;
      display: block;
    }

    .category-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .category-card h3 {
      margin: 0 0 0.5rem 0;
      color: var(--theme-primary-color, #4CAF50);
    }

    .category-progress {
      margin-top: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .completed-badge {
      background-color: var(--theme-primary-color, #4CAF50);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.875rem;
      font-weight: 600;
      display: inline-block;
      width: fit-content;
    }

    .not-started {
      margin-top: 1rem;
      color: #999;
      font-size: 0.875rem;
    }

    .games-view {
      margin-top: 2rem;
    }

    .games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-top: 1.5rem;
    }

    .game-card {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      color: inherit;
      display: block;
    }

    .game-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .game-card h3 {
      margin: 0 0 0.5rem 0;
      color: var(--theme-primary-color, #4CAF50);
    }

    .game-type {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: #666;
      font-style: italic;
    }
  `]
})
export class SubjectsComponent implements OnInit {
  protected readonly application = inject(SubjectsApplication);
  private readonly authService = inject(ChildAuthService);
  private readonly infrastructure = inject(SubjectsInfrastructure);

  selectedSubjectId = signal<string | null>(null);
  selectedCategoryId = signal<string | null>(null);
  categoryGames = signal<Game[]>([]);
  loadingGames = signal<boolean>(false);

  constructor() {
    effect(() => {
      const subject = this.application.getSelectedSubject();
      this.selectedSubjectId.set(subject()?.id || null);
    });
  }

  async ngOnInit(): Promise<void> {
    await this.application.initialize();
  }

  async selectSubject(subjectId: string): Promise<void> {
    await this.application.selectSubject(subjectId);
  }

  goBack(): void {
    if (this.selectedCategoryId()) {
      this.selectedCategoryId.set(null);
      this.categoryGames.set([]);
    } else {
      this.selectedSubjectId.set(null);
    }
  }

  selectedSubject() {
    return this.application.getSelectedSubject();
  }

  async selectCategory(categoryId: string): Promise<void> {
    this.selectedCategoryId.set(categoryId);
    this.loadingGames.set(true);
    try {
      const games = await this.infrastructure.loadGamesByCategory(categoryId);
      this.categoryGames.set(games);
    } catch (error) {
      console.error('Erreur lors du chargement des jeux:', error);
    } finally {
      this.loadingGames.set(false);
    }
  }
}
