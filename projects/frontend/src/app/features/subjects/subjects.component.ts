import { Component, inject, OnInit, effect, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SubjectsApplication } from './components/application/application';
import { SubjectsInfrastructure } from './components/infrastructure/infrastructure';
import { ChildAuthService } from '../../core/auth/child-auth.service';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar.component';
import { StarRatingComponent } from '../../shared/components/star-rating/star-rating.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../shared/components/breadcrumb/breadcrumb.component';
import { Game } from '../../core/types/game.types';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ProgressBarComponent,
    StarRatingComponent,
    BreadcrumbComponent,
  ],
  template: `
    <div class="subjects-container">
      <!-- Breadcrumb -->
      <app-breadcrumb [items]="breadcrumbItems()" />
      
      <h1>{{ pageTitle() }}</h1>

      <div *ngIf="isLoading()" class="loading">
        Chargement...
      </div>

      <div *ngIf="error()" class="error">
        {{ error() }}
      </div>

      <!-- Liste des matières -->
      <div class="subjects-grid" *ngIf="!isLoading() && !selectedSubjectId()">
        <div
          *ngFor="let subject of subjects()"
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
      <div *ngIf="selectedSubjectId() && selectedSubject() && !selectedCategoryId()" class="categories-view">
        <h2>{{ selectedSubject()?.name }}</h2>
        <div class="categories-grid">
          <div
            *ngFor="let category of categories()"
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
        <div *ngIf="loadingGames()" class="loading">Chargement des jeux...</div>
        <div class="games-grid" *ngIf="!loadingGames()">
          <div
            *ngFor="let game of categoryGames()"
            class="game-card"
            [routerLink]="['/game', game.id]">
            <h3>{{ game.name }}</h3>
            <p *ngIf="game.description">{{ game.description }}</p>
            <div class="game-type-badge" [style.background-color]="getGameTypeStyle(game.game_type).bgColor" [style.color]="getGameTypeStyle(game.game_type).color">
              <span class="game-type-icon">{{ getGameTypeStyle(game.game_type).icon }}</span>
              <span class="game-type-label">{{ getGameTypeStyle(game.game_type).label }}</span>
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

    .game-type-badge {
      margin-top: 0.75rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      border: 2px solid transparent;
      transition: all 0.2s ease;
    }

    .game-type-badge:hover {
      transform: scale(1.05);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .game-type-icon {
      font-size: 1rem;
      line-height: 1;
    }

    .game-type-label {
      font-size: 0.875rem;
      font-weight: 600;
    }
  `]
})
export class SubjectsComponent implements OnInit {
  protected readonly application = inject(SubjectsApplication);
  private readonly authService = inject(ChildAuthService);
  private readonly infrastructure = inject(SubjectsInfrastructure);
  private readonly router = inject(Router);

  selectedSubjectId = signal<string | null>(null);
  selectedCategoryId = signal<string | null>(null);
  categoryGames = signal<Game[]>([]);
  loadingGames = signal<boolean>(false);

  // Exposer les signals directement pour le template
  subjects = computed(() => this.application.getSubjects()());
  categories = computed(() => this.application.getCategories()());
  isLoading = computed(() => this.application.isLoading()());
  error = computed(() => this.application.getError()());
  selectedSubject = computed(() => this.application.getSelectedSubject()());
  
  // Catégorie sélectionnée pour le breadcrumb
  selectedCategory = computed(() => {
    const categoryId = this.selectedCategoryId();
    if (!categoryId) return null;
    return this.categories().find((cat: { id: string }) => cat.id === categoryId) || null;
  });
  
  // Titre dynamique selon le contexte
  pageTitle = computed(() => {
    if (this.selectedCategoryId()) {
      return 'Jeux disponibles';
    }
    if (this.selectedSubjectId()) {
      return this.selectedSubject()?.name || 'Sous-matières';
    }
    return 'Choisis une matière';
  });

  // Breadcrumb items
  breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [];
    
    if (this.selectedSubjectId() || this.selectedCategoryId()) {
      items.push({
        label: 'Matières',
        action: () => this.goToSubjects()
      });
    }
    
    if (this.selectedSubjectId()) {
      items.push({
        label: this.selectedSubject()?.name || 'Matière',
        action: this.selectedCategoryId() ? () => this.goToSubject() : undefined,
        isActive: !this.selectedCategoryId()
      });
    }
    
    if (this.selectedCategoryId()) {
      items.push({
        label: this.selectedCategory()?.name || 'Sous-matière',
        action: () => this.goToSubject(),
        isActive: false
      });
      items.push({
        label: 'Jeux',
        isActive: true
      });
    }
    
    return items;
  });

  constructor() {
    effect(() => {
      const subject = this.selectedSubject();
      this.selectedSubjectId.set(subject?.id || null);
    });
  }

  async ngOnInit(): Promise<void> {
    await this.application.initialize();
    
    // Vérifier le state du router pour la navigation automatique
    const state = history.state as { subjectId?: string; categoryId?: string } | null;
    
    if (state?.subjectId) {
      await this.application.selectSubject(state.subjectId);
      if (state.categoryId) {
        // Attendre un peu pour que le subject soit chargé
        setTimeout(async () => {
          await this.selectCategory(state.categoryId!);
          // Nettoyer le state après utilisation
          history.replaceState({}, '');
        }, 100);
      } else {
        // Nettoyer le state après utilisation
        history.replaceState({}, '');
      }
    }
  }

  async selectSubject(subjectId: string): Promise<void> {
    await this.application.selectSubject(subjectId);
  }

  goBack(): void {
    if (this.selectedCategoryId()) {
      // Retour depuis les jeux vers les catégories
      this.selectedCategoryId.set(null);
      this.categoryGames.set([]);
    } else {
      // Retour depuis les catégories vers les matières
      // Réinitialiser à la fois le signal local et le store
      this.selectedSubjectId.set(null);
      this.application.resetSelection();
    }
  }

  goToSubjects(): void {
    this.selectedSubjectId.set(null);
    this.selectedCategoryId.set(null);
    this.categoryGames.set([]);
    this.application.resetSelection();
  }

  goToSubject(): void {
    if (this.selectedCategoryId()) {
      this.selectedCategoryId.set(null);
      this.categoryGames.set([]);
    }
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

  /**
   * Formate le type de jeu pour l'affichage
   */
  getGameTypeLabel(gameType: string | undefined): string {
    if (!gameType) return 'Non défini';
    
    // Mapping des types de jeux vers leurs labels
    const typeLabels: Record<string, string> = {
      'qcm': 'QCM',
      'memory': 'Memory',
      'chronologie': 'Chronologie',
      'simon': 'Simon',
      'image_interactive': 'Image interactive',
      'reponse_libre': 'Réponse libre',
      'vrai_faux': 'Vrai/Faux',
      'liens': 'Liens',
      'case_vide': 'Case vide',
      'click': 'Click'
    };
    
    // Si le type existe dans le mapping, l'utiliser
    if (typeLabels[gameType]) {
      return typeLabels[gameType];
    }
    
    // Sinon, formater le type : remplacer les underscores par des espaces et capitaliser
    return gameType
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Retourne les informations de style (couleur, icône) pour un type de jeu
   */
  getGameTypeStyle(gameType: string | undefined): { label: string; icon: string; color: string; bgColor: string } {
    if (!gameType) {
      return { label: 'Non défini', icon: '❓', color: '#666', bgColor: '#f5f5f5' };
    }

    const typeStyles: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
      'qcm': { label: 'QCM', icon: '📝', color: '#1976d2', bgColor: '#e3f2fd' },
      'memory': { label: 'Memory', icon: '🧠', color: '#7b1fa2', bgColor: '#f3e5f5' },
      'chronologie': { label: 'Chronologie', icon: '⏱️', color: '#f57c00', bgColor: '#fff3e0' },
      'simon': { label: 'Simon', icon: '🎮', color: '#388e3c', bgColor: '#e8f5e9' },
      'image_interactive': { label: 'Image interactive', icon: '🖼️', color: '#c2185b', bgColor: '#fce4ec' },
      'reponse_libre': { label: 'Réponse libre', icon: '✍️', color: '#0288d1', bgColor: '#e1f5fe' },
      'vrai_faux': { label: 'Vrai/Faux', icon: '✓✗', color: '#d32f2f', bgColor: '#ffebee' },
      'liens': { label: 'Liens', icon: '🔗', color: '#5d4037', bgColor: '#efebe9' },
      'case_vide': { label: 'Case vide', icon: '📋', color: '#455a64', bgColor: '#eceff1' },
      'click': { label: 'Click', icon: '👆', color: '#00796b', bgColor: '#e0f2f1' }
    };

    if (typeStyles[gameType]) {
      return typeStyles[gameType];
    }

    // Par défaut, formater le type
    const formattedLabel = gameType
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return { label: formattedLabel, icon: '🎯', color: '#666', bgColor: '#f5f5f5' };
  }
}
