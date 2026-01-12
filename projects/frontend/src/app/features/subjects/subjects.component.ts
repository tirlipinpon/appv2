import { Component, inject, OnInit, effect, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SubjectsApplication } from './components/application/application';
import { SubjectsInfrastructure } from './components/infrastructure/infrastructure';
import { ChildAuthService } from '../../core/auth/child-auth.service';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar.component';
import { StarRatingComponent } from '../../shared/components/star-rating/star-rating.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../shared/components/breadcrumb/breadcrumb.component';
import { GamesStatsDisplayComponent } from '@shared/components/games-stats-display/games-stats-display.component';
import { GamesCounterComponent } from '@shared/components/games-counter/games-counter.component';
import { ProgressBadgeComponent } from '@shared/components/progress-badge/progress-badge.component';
import { GamesStatsService } from '@shared/services/games-stats/games-stats.service';
import { GameTypeStyleService } from '@shared/services/game-type-style/game-type-style.service';
import { Game } from '../../core/types/game.types';
import {
  GAME_TYPE_QCM,
  GAME_TYPE_MEMORY,
  GAME_TYPE_SIMON,
  GAME_TYPE_CHRONOLOGIE,
  GAME_TYPE_LIENS,
  GAME_TYPE_VRAI_FAUX,
  GAME_TYPE_CASE_VIDE,
  GAME_TYPE_IMAGE_INTERACTIVE,
  GAME_TYPE_REPONSE_LIBRE,
  getGameTypeVariations,
  normalizeGameTypeName,
} from '@shared/utils/game-type.util';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ProgressBarComponent,
    StarRatingComponent,
    BreadcrumbComponent,
    GamesStatsDisplayComponent,
    GamesCounterComponent,
    ProgressBadgeComponent,
  ],
  template: `
    <div class="subjects-container">
      <!-- Breadcrumb -->
      <app-breadcrumb [items]="breadcrumbItems()" />

      <div *ngIf="isLoading()" class="loading">
        Chargement...
      </div>

      <div *ngIf="error()" class="error">
        {{ error() }}
      </div>

      <!-- Liste des matières -->
      <div class="subjects-grid" *ngIf="!isLoading() && !selectedSubjectId()">
        <div
          *ngFor="let subject of filteredSubjects()"
          class="subject-card"
          (click)="selectSubject(subject.id)"
          (keydown.enter)="selectSubject(subject.id)"
          tabindex="0"
          role="button">
          <h2>{{ subject.name }}</h2>
          <p *ngIf="subject.description">{{ subject.description }}</p>
          <app-games-counter 
            [subjectId]="subject.id"
            [categoryIds]="getCategoryIdsForSubject(subject.id)"
            [childId]="getCurrentChildId()"
            [remaining]="getRemainingGamesForSubject(subject.id)?.remaining ?? null"
            [total]="getRemainingGamesForSubject(subject.id)?.total ?? null">
          </app-games-counter>
        </div>
      </div>

      <!-- Sous-matières d'une matière sélectionnée -->
      <div *ngIf="selectedSubjectId() && selectedSubject() && !selectedCategoryId()" class="categories-view">
        
        <!-- Catégories (sous-matières) -->
        <div *ngIf="filteredCategories().length > 0" class="categories-section">
          <h3>Sous-matières</h3>
          <div class="categories-grid">
            <div
              *ngFor="let category of filteredCategories()"
              class="category-card"
              (click)="selectCategory(category.id)"
              (keydown.enter)="selectCategory(category.id)"
              tabindex="0"
              role="button">
              <h3>{{ category.name }}</h3>
              <p *ngIf="category.description">{{ category.description }}</p>
              <app-games-counter 
                [categoryId]="category.id"
                [childId]="getCurrentChildId()"
                [remaining]="getRemainingGamesForCategory(category.id)?.remaining ?? null"
                [total]="getRemainingGamesForCategory(category.id)?.total ?? null">
              </app-games-counter>
              <app-games-stats-display 
                [categoryId]="category.id" 
                [childId]="getCurrentChildId()" />
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
            </div>
          </div>
        </div>

        <!-- Jeux directs de la matière -->
        <div *ngIf="subjectGames().length > 0" class="subject-games-section">
          <div class="games-header">
            <h3>Jeux de la matière</h3>
            <app-games-counter
              [subjectId]="selectedSubjectId()"
              [childId]="getCurrentChildId()"
              [remaining]="getRemainingSubjectGamesCount()"
              [total]="getTotalSubjectGamesCount()">
            </app-games-counter>
            <app-games-stats-display 
              [subjectId]="selectedSubjectId()" 
              [childId]="getCurrentChildId()" />
          </div>
          <div class="games-grid">
            <div
              *ngFor="let game of sortedSubjectGames()"
              class="game-card"
              [class.completed]="isGameCompleted(game.id)"
              [routerLink]="['/game', game.id]">
              <div class="game-card-header">
                <h3>{{ game.name }}</h3>
                <app-progress-badge
                  [score]="getGameScore(game.id)"
                  [hasAttempted]="hasGameAttempted(game.id)">
                </app-progress-badge>
              </div>
              <p *ngIf="game.description">{{ game.description }}</p>
              <div class="game-type-badge" [style.background-color]="getGameTypeStyle(game.game_type).bgColor" [style.color]="getGameTypeStyle(game.game_type).color">
                <span class="game-type-icon">{{ getGameTypeStyle(game.game_type).icon }}</span>
                <span class="game-type-label">{{ getGameTypeStyle(game.game_type).label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Jeux d'une sous-matière sélectionnée -->
      <div *ngIf="selectedCategoryId()" class="games-view">
        <div class="games-header" *ngIf="!loadingGames() && categoryGames().length > 0">
          <app-games-counter
            [categoryId]="selectedCategoryId()"
            [childId]="getCurrentChildId()"
            [remaining]="getRemainingGamesCount()"
            [total]="getTotalGamesCount()">
          </app-games-counter>
          <app-games-stats-display 
            [categoryId]="selectedCategoryId()" 
            [childId]="getCurrentChildId()" />
        </div>
        <div *ngIf="loadingGames()" class="loading">Chargement des jeux...</div>
        <div class="games-grid" *ngIf="!loadingGames()">
          <div
            *ngFor="let game of sortedGames()"
            class="game-card"
            [class.completed]="isGameCompleted(game.id)"
            [routerLink]="['/game', game.id]">
            <div class="game-card-header">
              <h3>{{ game.name }}</h3>
              <app-progress-badge
                [score]="getGameScore(game.id)"
                [hasAttempted]="hasGameAttempted(game.id)">
              </app-progress-badge>
            </div>
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

    .categories-section {
      margin-bottom: 3rem;
    }

    .categories-section h3 {
      margin-bottom: 1rem;
      color: var(--theme-text-color, #333);
      font-size: 1.25rem;
    }

    .subject-games-section {
      margin-top: 2rem;
    }

    .subject-games-section h3 {
      margin: 0;
      color: var(--theme-text-color, #333);
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


    .games-view {
      margin-top: 2rem;
    }

    .games-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
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
      position: relative;
    }

    .game-card.completed {
      opacity: 0.85;
      border: 2px solid #4CAF50;
    }

    .game-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .game-card.completed:hover {
      opacity: 1;
    }

    .game-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .game-card h3 {
      margin: 0;
      color: var(--theme-primary-color, #4CAF50);
      flex: 1;
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
  readonly authService = inject(ChildAuthService);
  private readonly infrastructure = inject(SubjectsInfrastructure);
  private readonly router = inject(Router);
  private readonly gamesStatsService = inject(GamesStatsService);
  private readonly gameTypeStyleService = inject(GameTypeStyleService);

  selectedSubjectId = signal<string | null>(null);
  selectedCategoryId = signal<string | null>(null);
  categoryGames = signal<Game[]>([]);
  subjectGames = signal<Game[]>([]);
  gameScores = signal<Map<string, number>>(new Map());
  loadingGames = signal<boolean>(false);

  // Signal pour stocker les catégories par matière (pour le filtrage)
  categoriesBySubject = signal<Map<string, any[]>>(new Map());

  // Signaux pour stocker les jeux par catégorie et par matière (pour calculer les restants)
  gamesByCategory = signal<Map<string, Game[]>>(new Map());
  gamesBySubject = signal<Map<string, Game[]>>(new Map());

  // Exposer les signals directement pour le template
  subjects = computed(() => this.application.getSubjects()());
  categories = computed(() => this.application.getCategories()());
  isLoading = computed(() => this.application.isLoading()());
  error = computed(() => this.application.getError()());
  selectedSubject = computed(() => this.application.getSelectedSubject()());

  // Computed signal pour filtrer les catégories avec des jeux
  // On cache seulement si les stats sont chargées ET total = 0
  // Si les stats ne sont pas encore chargées, on affiche la catégorie (pour ne pas cacher prématurément)
  filteredCategories = computed(() => {
    const allCategories = this.categories();
    const childId = this.getCurrentChildId();
    // Lire le signal statsByKey pour que le computed soit réactif aux changements
    const statsByKey = this.gamesStatsService.statsByKey();
    
    if (allCategories.length === 0) return [];
    
    return allCategories.filter((category: { id: string }) => {
      // Utiliser directement le store pour être réactif
      const categoryKey = childId ? `${childId}:category:${category.id}` : `category:${category.id}`;
      const cached = statsByKey[categoryKey];
      const stats = cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)
        ? { total: cached.total, stats: cached.stats }
        : null;
      
      // Si les stats ne sont pas encore chargées (null), on affiche la catégorie
      // On cache seulement si les stats sont chargées ET total = 0
      if (stats === null) {
        return true; // Afficher par défaut si stats pas encore chargées
      }
      // Cacher seulement si total = 0 (pas de jeux)
      return stats.total > 0;
    });
  });

  // Computed signal pour filtrer les matières avec des jeux (directs ou via catégories)
  filteredSubjects = computed(() => {
    const allSubjects = this.subjects();
    const childId = this.getCurrentChildId();
    const categoriesMap = this.categoriesBySubject();
    // Lire le signal statsByKey pour que le computed soit réactif aux changements
    const statsByKey = this.gamesStatsService.statsByKey();
    
    if (allSubjects.length === 0) return [];
    
    return allSubjects.filter((subject: { id: string }) => {
      // Vérifier si la matière a des jeux directs
      // Utiliser directement le store pour être réactif
      const subjectKey = childId ? `${childId}:subject:${subject.id}` : `subject:${subject.id}`;
      const subjectCached = statsByKey[subjectKey];
      const subjectStats = subjectCached && (Date.now() - subjectCached.timestamp < 5 * 60 * 1000) 
        ? { total: subjectCached.total, stats: subjectCached.stats }
        : null;
      
      if (subjectStats !== null && subjectStats.total > 0) {
        // Stats chargées et la matière a des jeux directs
        return true;
      }
      
      // Vérifier si les catégories ont été chargées pour cette matière
      const subjectCategories = categoriesMap.get(subject.id);
      
      // Si undefined, les catégories ne sont pas encore chargées, afficher par défaut
      if (subjectCategories === undefined) {
        return true;
      }
      
      // Si tableau vide, la matière n'a pas de catégories
      // Dans ce cas, vérifier uniquement les jeux directs
      if (subjectCategories.length === 0) {
        // Pas de catégories : vérifier uniquement les jeux directs
        // Si les stats sont chargées et total = 0, cacher
        if (subjectStats !== null) {
          // Stats chargées : cacher si total = 0
          return subjectStats.total > 0;
        }
        // Si les stats ne sont pas encore chargées, afficher par défaut
        // (elles seront chargées par l'effect et le computed se réexécutera)
        return true;
      }
      
      // La matière a des catégories : vérifier si au moins une catégorie a des jeux
      let hasCategoryWithGames = false;
      let allCategoriesStatsLoaded = true;
      
      for (const category of subjectCategories) {
        const categoryKey = childId ? `${childId}:category:${category.id}` : `category:${category.id}`;
        const categoryCached = statsByKey[categoryKey];
        const categoryStats = categoryCached && (Date.now() - categoryCached.timestamp < 5 * 60 * 1000)
          ? { total: categoryCached.total, stats: categoryCached.stats }
          : null;
        
        if (categoryStats === null) {
          // Stats pas encore chargées pour cette catégorie
          allCategoriesStatsLoaded = false;
        } else if (categoryStats.total > 0) {
          hasCategoryWithGames = true;
        }
      }
      
      // Si au moins une catégorie a des jeux, afficher la matière
      if (hasCategoryWithGames) {
        return true;
      }
      
      // Si toutes les stats sont chargées et aucune catégorie n'a de jeux, cacher
      // Sinon, afficher (pour ne pas cacher prématurément)
      if (allCategoriesStatsLoaded) {
        return false;
      }
      
      return true;
    });
  });
  
  // Jeux triés : d'abord les non complétés, puis les complétés
  sortedGames = computed(() => {
    const games = this.categoryGames();
    const scores = this.gameScores();
    
    // Séparer les jeux complétés et non complétés
    const incompleteGames = games.filter(game => {
      const score = scores.get(game.id);
      return score !== 100;
    });
    
    const completedGames = games.filter(game => {
      const score = scores.get(game.id);
      return score === 100;
    });
    
    // Retourner d'abord les non complétés, puis les complétés
    return [...incompleteGames, ...completedGames];
  });

  // Jeux directs de la matière triés : d'abord les non complétés, puis les complétés
  sortedSubjectGames = computed(() => {
    const games = this.subjectGames();
    const scores = this.gameScores();
    
    // Séparer les jeux complétés et non complétés
    const incompleteGames = games.filter(game => {
      const score = scores.get(game.id);
      return score !== 100;
    });
    
    const completedGames = games.filter(game => {
      const score = scores.get(game.id);
      return score === 100;
    });
    
    // Retourner d'abord les non complétés, puis les complétés
    return [...incompleteGames, ...completedGames];
  });
  
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

    // Recharger les jeux directs quand une matière est sélectionnée
    // (y compris quand on revient de la page de jeu)
    effect(() => {
      const subjectId = this.selectedSubjectId();
      const categoryId = this.selectedCategoryId();
      
      // Ne charger les jeux directs que si une matière est sélectionnée et aucune catégorie n'est sélectionnée
      if (subjectId && !categoryId) {
        // Vérifier si les jeux ne sont pas déjà chargés pour cette matière
        // On recharge toujours pour s'assurer que les scores sont à jour après avoir joué
        this.loadSubjectGames(subjectId);
      } else if (!subjectId) {
        // Nettoyer les jeux directs si aucune matière n'est sélectionnée
        this.subjectGames.set([]);
      }
    });

    // Charger les stats pour toutes les catégories quand elles sont chargées
    effect(() => {
      const cats = this.categories();
      const child = this.authService.getCurrentChild();
      const childId = child?.child_id;
      
      if (cats.length > 0 && childId) {
        const categoryIds = cats.map((cat: { id: string }) => cat.id);
        
        // Précharger les stats pour toutes les catégories
        // Cela permet au filtrage de fonctionner et à app-games-stats-display d'afficher les stats
        this.gamesStatsService.preloadStats(
          [],
          categoryIds,
          {
            subjectLoader: () => {
              throw new Error('Subject loader not used in this context');
            },
            categoryLoader: (categoryId: string) => 
              this.infrastructure.getGamesStatsForChildCategory(childId, categoryId)
          },
          childId
        );
      }
    });

    // Charger les stats pour toutes les matières et leurs catégories
    effect(() => {
      const subjects = this.subjects();
      const child = this.authService.getCurrentChild();
      const childId = child?.child_id;
      
      if (subjects.length > 0 && childId) {
        const subjectIds = subjects.map((subject: { id: string }) => subject.id);
        
        // Précharger les stats pour toutes les matières
        this.gamesStatsService.preloadStats(
          subjectIds,
          [],
          {
            subjectLoader: (subjectId: string) => 
              this.infrastructure.getGamesStatsForChildSubject(childId, subjectId),
            categoryLoader: () => {
              throw new Error('Category loader not used in this context');
            }
          },
          childId
        );

        // Charger les catégories pour chaque matière en parallèle
        // Utiliser .then() et .catch() car les effects ne peuvent pas être async
        this.loadCategoriesForSubjects(subjectIds, childId).catch((error) => {
          console.error('Erreur lors du chargement des catégories:', error);
        });
      }
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
    // Les jeux directs seront chargés par l'effect qui surveille selectedSubjectId
  }

  /**
   * Charge les jeux directs d'une matière
   * Méthode séparée pour pouvoir être appelée depuis l'effect
   */
  private async loadSubjectGames(subjectId: string): Promise<void> {
    this.loadingGames.set(true);
    try {
      const child = this.authService.getCurrentChild();
      const childId = child?.child_id;
      const games = await this.infrastructure.loadGamesBySubject(subjectId, childId);
      this.subjectGames.set(games);
      
      // Mettre à jour gamesBySubject pour le calcul des restants
      const currentGamesBySubject = new Map(this.gamesBySubject());
      currentGamesBySubject.set(subjectId, games);
      this.gamesBySubject.set(currentGamesBySubject);
      
      // Charger les stats de jeux pour la matière
      if (childId) {
        this.gamesStatsService.loadStatsForSubject(
          subjectId,
          () => this.infrastructure.getGamesStatsForChildSubject(childId, subjectId),
          childId
        );
      }
      
      // Charger les scores des jeux directs si l'enfant est connecté
      if (childId && games.length > 0) {
        const gameIds = games.map(g => g.id);
        const scores = await this.infrastructure.getGameScores(childId, gameIds);
        // Fusionner avec les scores existants
        const currentScores = new Map(this.gameScores());
        scores.forEach((score, gameId) => currentScores.set(gameId, score));
        this.gameScores.set(currentScores);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des jeux directs de la matière:', error);
      this.subjectGames.set([]);
    } finally {
      this.loadingGames.set(false);
    }
  }

  /**
   * Charge les catégories pour toutes les matières en parallèle
   * Méthode séparée pour pouvoir être appelée depuis l'effect avec await
   */
  private async loadCategoriesForSubjects(subjectIds: string[], childId: string): Promise<void> {
    await Promise.all(
      subjectIds.map(async (subjectId: string) => {
        try {
          const categories = await this.infrastructure.loadSubjectCategories(subjectId);
          const currentMap = new Map(this.categoriesBySubject());
          currentMap.set(subjectId, categories);
          this.categoriesBySubject.set(currentMap);
          
          // Charger les stats pour ces catégories
          if (categories.length > 0) {
            const categoryIds = categories.map((cat: { id: string }) => cat.id);
            this.gamesStatsService.preloadStats(
              [],
              categoryIds,
              {
                subjectLoader: () => {
                  throw new Error('Subject loader not used in this context');
                },
                categoryLoader: (categoryId: string) => 
                  this.infrastructure.getGamesStatsForChildCategory(childId, categoryId)
              },
              childId
            );

            // Charger les jeux de toutes les catégories en parallèle
            await Promise.all(
              categoryIds.map(async (categoryId: string) => {
                try {
                  const games = await this.infrastructure.loadGamesByCategory(categoryId, childId);
                  const currentGamesByCategory = new Map(this.gamesByCategory());
                  currentGamesByCategory.set(categoryId, games);
                  this.gamesByCategory.set(currentGamesByCategory);

                  // Charger les scores si l'enfant est connecté
                  if (childId && games.length > 0) {
                    const gameIds = games.map(g => g.id);
                    const scores = await this.infrastructure.getGameScores(childId, gameIds);
                    const currentScores = new Map(this.gameScores());
                    scores.forEach((score, gameId) => currentScores.set(gameId, score));
                    this.gameScores.set(currentScores);
                  }
                } catch (error) {
                  console.error(`Erreur lors du chargement des jeux pour la catégorie ${categoryId}:`, error);
                }
              })
            );
          }

          // Charger les jeux directs de la matière
          try {
            const games = await this.infrastructure.loadGamesBySubject(subjectId, childId);
            const currentGamesBySubject = new Map(this.gamesBySubject());
            currentGamesBySubject.set(subjectId, games);
            this.gamesBySubject.set(currentGamesBySubject);

            // Charger les scores si l'enfant est connecté
            if (childId && games.length > 0) {
              const gameIds = games.map(g => g.id);
              const scores = await this.infrastructure.getGameScores(childId, gameIds);
              const currentScores = new Map(this.gameScores());
              scores.forEach((score, gameId) => currentScores.set(gameId, score));
              this.gameScores.set(currentScores);
            }
          } catch (error) {
            console.error(`Erreur lors du chargement des jeux directs pour la matière ${subjectId}:`, error);
          }
        } catch (error) {
          console.error(`Erreur lors du chargement des catégories pour la matière ${subjectId}:`, error);
        }
      })
    );
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
      this.subjectGames.set([]);
      this.application.resetSelection();
    }
  }

  goToSubjects(): void {
    this.selectedSubjectId.set(null);
    this.selectedCategoryId.set(null);
    this.categoryGames.set([]);
    this.subjectGames.set([]);
    this.application.resetSelection();
  }

  goToSubject(): void {
    if (this.selectedCategoryId()) {
      this.selectedCategoryId.set(null);
      this.categoryGames.set([]);
      // Ne pas nettoyer subjectGames car ils doivent rester visibles
    }
  }


  async selectCategory(categoryId: string): Promise<void> {
    this.selectedCategoryId.set(categoryId);
    this.loadingGames.set(true);
    try {
      const child = this.authService.getCurrentChild();
      const childId = child?.child_id;
      const games = await this.infrastructure.loadGamesByCategory(categoryId, childId);
      this.categoryGames.set(games);
      
      // Mettre à jour gamesByCategory pour le calcul des restants
      const currentGamesByCategory = new Map(this.gamesByCategory());
      currentGamesByCategory.set(categoryId, games);
      this.gamesByCategory.set(currentGamesByCategory);
      
      // Charger les stats de jeux pour la catégorie
      if (childId) {
        this.gamesStatsService.loadStatsForCategory(
          categoryId,
          () => this.infrastructure.getGamesStatsForChildCategory(childId, categoryId),
          childId
        );
      }
      
      // Charger les scores des jeux si l'enfant est connecté
      if (childId && games.length > 0) {
        const gameIds = games.map(g => g.id);
        const scores = await this.infrastructure.getGameScores(childId, gameIds);
        // Fusionner avec les scores existants
        const currentScores = new Map(this.gameScores());
        scores.forEach((score, gameId) => currentScores.set(gameId, score));
        this.gameScores.set(currentScores);
      } else {
        this.gameScores.set(new Map());
      }
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
    
    // Mapping des types de jeux vers leurs labels (basé sur les constantes)
    const typeLabels: Record<string, string> = {
      [GAME_TYPE_QCM]: 'QCM',
      [GAME_TYPE_MEMORY]: 'Memory',
      [GAME_TYPE_CHRONOLOGIE]: 'Chronologie',
      [GAME_TYPE_SIMON]: 'Simon',
      [GAME_TYPE_IMAGE_INTERACTIVE]: 'Image interactive',
      [GAME_TYPE_REPONSE_LIBRE]: 'Réponse libre',
      [GAME_TYPE_VRAI_FAUX]: 'Vrai/Faux',
      [GAME_TYPE_LIENS]: 'Liens',
      [GAME_TYPE_CASE_VIDE]: 'Case vide',
    };
    
    // Normaliser le type pour la comparaison
    const normalizedType = normalizeGameTypeName(gameType);
    
    // Chercher dans les constantes et leurs variations
    for (const [constantType, label] of Object.entries(typeLabels)) {
      if (getGameTypeVariations(constantType).some(variation => 
        normalizeGameTypeName(variation) === normalizedType
      )) {
        return label;
      }
    }
    
    // Vérifier aussi 'click' qui est une variation de image_interactive
    if (normalizedType === normalizeGameTypeName('click')) {
      return typeLabels[GAME_TYPE_IMAGE_INTERACTIVE];
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
  /**
   * Récupère l'ID de l'enfant courant
   */
  getCurrentChildId(): string | null {
    const child = this.authService.getCurrentChild();
    return child?.child_id || null;
  }

  getGameTypeStyle(gameType: string | undefined): { label: string; icon: string; color: string; bgColor: string } {
    if (!gameType) {
      return { label: 'Non défini', icon: '❓', color: '#666', bgColor: '#f5f5f5' };
    }

    // Utiliser le service pour récupérer l'icône et la couleur depuis la DB
    const style = this.gameTypeStyleService.getGameTypeStyleSync(gameType);

    // Garder les valeurs de fallback pour bgColor (utilisées dans le template)
    const fallbackBgColors: Record<string, string> = {
      [GAME_TYPE_QCM]: '#e3f2fd',
      [GAME_TYPE_MEMORY]: '#f3e5f5',
      [GAME_TYPE_CHRONOLOGIE]: '#fff3e0',
      [GAME_TYPE_SIMON]: '#e8f5e9',
      [GAME_TYPE_IMAGE_INTERACTIVE]: '#fce4ec',
      [GAME_TYPE_REPONSE_LIBRE]: '#e1f5fe',
      [GAME_TYPE_VRAI_FAUX]: '#ffebee',
      [GAME_TYPE_LIENS]: '#efebe9',
      [GAME_TYPE_CASE_VIDE]: '#eceff1',
    };

    // Normaliser le type pour trouver le bgColor
    const normalizedType = normalizeGameTypeName(gameType);
    let bgColor = '#f5f5f5'; // Par défaut

    for (const [constantType, bg] of Object.entries(fallbackBgColors)) {
      if (normalizeGameTypeName(constantType) === normalizedType ||
          getGameTypeVariations(constantType).some(v => normalizeGameTypeName(v) === normalizedType)) {
        bgColor = bg;
        break;
      }
    }

    // Vérifier aussi 'click' qui est une variation de image_interactive
    if (normalizedType === normalizeGameTypeName('click')) {
      bgColor = fallbackBgColors[GAME_TYPE_IMAGE_INTERACTIVE];
    }

    // Formater le label
    const formattedLabel = gameType
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return {
      label: formattedLabel,
      icon: style.icon,
      color: style.colorCode,
      bgColor: bgColor,
    };
  }

  /**
   * Vérifie si un jeu est complété (score = 100%)
   */
  isGameCompleted(gameId: string): boolean {
    const score = this.gameScores().get(gameId);
    return score === 100;
  }

  /**
   * Vérifie si un jeu a été tenté (a un score, même si ce n'est pas 100%)
   */
  hasGameAttempted(gameId: string): boolean {
    const score = this.gameScores().get(gameId);
    // Vérifier si le score existe et est > 0 (un score de 0 signifie pas de tentative réussie)
    // Note: getGameScores ne retourne que les scores > 0 dans la Map
    return score !== undefined && score !== null && score > 0;
  }

  /**
   * Récupère le score d'un jeu
   */
  getGameScore(gameId: string): number {
    return this.gameScores().get(gameId) || 0;
  }

  /**
   * Calcule le nombre de jeux restants (non complétés)
   */
  getRemainingGamesCount(): number {
    const games = this.categoryGames();
    const scores = this.gameScores();
    return games.filter(game => scores.get(game.id) !== 100).length;
  }
  
  /**
   * Retourne le nombre total de jeux
   */
  getTotalGamesCount(): number {
    return this.categoryGames().length;
  }

  /**
   * Calcule le nombre de jeux directs restants (non complétés)
   */
  getRemainingSubjectGamesCount(): number {
    const games = this.subjectGames();
    const scores = this.gameScores();
    return games.filter(game => scores.get(game.id) !== 100).length;
  }
  
  /**
   * Retourne le nombre total de jeux directs
   */
  getTotalSubjectGamesCount(): number {
    return this.subjectGames().length;
  }

  /**
   * Retourne les IDs des catégories pour une matière donnée
   */
  getCategoryIdsForSubject(subjectId: string): string[] {
    const categories = this.categoriesBySubject().get(subjectId);
    return categories ? categories.map((cat: { id: string }) => cat.id) : [];
  }

  /**
   * Calcule les jeux restants pour une catégorie
   */
  getRemainingGamesForCategory(categoryId: string): { remaining: number; total: number } | null {
    const games = this.gamesByCategory().get(categoryId);
    if (!games || games.length === 0) {
      // Si les jeux ne sont pas encore chargés, retourner null pour utiliser les stats
      return null;
    }
    const scores = this.gameScores();
    const remaining = games.filter(game => scores.get(game.id) !== 100).length;
    return { remaining, total: games.length };
  }

  /**
   * Calcule les jeux restants pour une matière (directs + sous-matières)
   */
  getRemainingGamesForSubject(subjectId: string): { remaining: number; total: number } | null {
    const subjectGames = this.gamesBySubject().get(subjectId) || [];
    const categoryIds = this.getCategoryIdsForSubject(subjectId);
    const scores = this.gameScores();
    
    // Compter les jeux directs
    let totalGames = subjectGames.length;
    let remainingGames = subjectGames.filter(game => scores.get(game.id) !== 100).length;

    // Ajouter les jeux des sous-matières
    for (const catId of categoryIds) {
      const catGames = this.gamesByCategory().get(catId);
      if (catGames) {
        totalGames += catGames.length;
        remainingGames += catGames.filter(game => scores.get(game.id) !== 100).length;
      }
    }

    if (totalGames === 0) {
      return null;
    }

    return { remaining: remainingGames, total: totalGames };
  }
}
