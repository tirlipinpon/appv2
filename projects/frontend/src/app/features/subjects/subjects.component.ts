import { Component, inject, OnInit, OnDestroy, effect, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { SubjectsApplication } from './components/application/application';
import { SubjectsInfrastructure } from './components/infrastructure/infrastructure';
import { ChildAuthService } from '../../core/auth/child-auth.service';
import { StarsDisplayComponent } from '../../shared/components/stars-display/stars-display.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../shared/components/breadcrumb/breadcrumb.component';
import { GamesStatsDisplayComponent } from '@shared/components/games-stats-display/games-stats-display.component';
import { GamesCounterComponent } from '@shared/components/games-counter/games-counter.component';
import { ProgressBadgeComponent } from '@shared/components/progress-badge/progress-badge.component';
import { GamesStatsService } from '@shared/services/games-stats/games-stats.service';
import { GameTypeStyleService } from '@shared/services/game-type-style/game-type-style.service';
import { Game } from '../../core/types/game.types';
import { SubjectCategoryWithProgress } from './types/subject.types';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    StarsDisplayComponent,
    BreadcrumbComponent,
    GamesStatsDisplayComponent,
    GamesCounterComponent,
    ProgressBadgeComponent,
  ],
  template: `
    <div class="subjects-container">
      <!-- Breadcrumb -->
      <app-breadcrumb [items]="breadcrumbItems()" />

      @if (isLoading()) {
        <div class="loading">
          Chargement...
        </div>
      }

      @if (error()) {
        <div class="error">
          {{ error() }}
        </div>
      }

      <!-- Liste des matières -->
      @if (!isLoading() && !selectedSubjectId()) {
        <div class="subjects-grid">
          @for (subject of filteredSubjects(); track subject.id) {
            <div
              class="subject-card"
              (click)="selectSubject(subject.id)"
              (keydown.enter)="selectSubject(subject.id)"
              tabindex="0"
              role="button">
              <h2>{{ subject.name }}</h2>
              @if (subject.description) {
                <p>{{ subject.description }}</p>
              }
          <app-games-counter 
            [subjectId]="subject.id"
            [categoryIds]="getCategoryIdsForSubject(subject.id)"
            [childId]="getCurrentChildId()"
            [remaining]="getRemainingGamesForSubject(subject.id)?.remaining ?? null"
            [total]="getRemainingGamesForSubject(subject.id)?.total ?? null">
          </app-games-counter>
              <app-stars-display 
                [count]="getSubjectTotalStars(subject.id)"
                [type]="'subject'"
                [entityId]="subject.id"
                color="silver"
                orientation="vertical"
                position="absolute"
                alignment="right">
              </app-stars-display>
              @if (getTeachersForSubject(subject.id).length > 0) {
                <div class="subject-teachers">
                  Prof: {{ formatTeachersNames(getTeachersForSubject(subject.id)) }}
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Sous-matières d'une matière sélectionnée -->
      @if (selectedSubjectId() && selectedSubject() && !selectedCategoryId()) {
        <div class="categories-view">
          
          <!-- Catégories (sous-matières) -->
          @if (filteredCategories().length > 0) {
            <div class="categories-section">
              <h3>Sous-matières</h3>
              <div class="categories-grid">
                @for (category of filteredCategories(); track category.id) {
                  <div
                    class="category-card"
                    (click)="selectCategory(category.id)"
                    (keydown.enter)="selectCategory(category.id)"
                    tabindex="0"
                    role="button">
                    <h3>{{ category.name }}</h3>
                    @if (category.description) {
                      <p>{{ category.description }}</p>
                    }
              <app-games-counter 
                [categoryId]="category.id"
                [childId]="getCurrentChildId()"
                [remaining]="getRemainingGamesForCategory(category.id)?.remaining ?? null"
                [total]="getRemainingGamesForCategory(category.id)?.total ?? null">
              </app-games-counter>
                    <app-games-stats-display 
                      [categoryId]="category.id" 
                      [childId]="getCurrentChildId()" />
                    <app-stars-display 
                      [count]="getCategoryStars(category.id)"
                      [type]="'category'"
                      [entityId]="category.id"
                      color="gold"
                      orientation="vertical"
                      position="absolute"
                      alignment="right">
                    </app-stars-display>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Jeux directs de la matière -->
          @if (subjectGames().length > 0) {
            <div class="subject-games-section">
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
              @for (game of sortedSubjectGames(); track game.id) {
                <div
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
                  @if (game.description) {
                    <p>{{ game.description }}</p>
                  }
              <div class="game-type-badge" [style.background-color]="getGameTypeStyle(game.game_type).bgColor" [style.color]="getGameTypeStyle(game.game_type).color">
                <span class="game-type-icon">{{ getGameTypeStyle(game.game_type).icon }}</span>
                  <span class="game-type-label">{{ getGameTypeStyle(game.game_type).label }}</span>
                </div>
              </div>
            }
          </div>
            </div>
          }
        </div>
      }

      <!-- Jeux d'une sous-matière sélectionnée -->
      @if (selectedCategoryId()) {
        <div class="games-view">
          @if (!loadingGames() && categoryGames().length > 0) {
            <div class="games-header">
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
          }
          @if (loadingGames()) {
            <div class="loading">Chargement des jeux...</div>
          }
          @if (!loadingGames()) {
            <div class="games-grid">
              @for (game of sortedGames(); track game.id) {
                <div
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
                  @if (game.description) {
                    <p>{{ game.description }}</p>
                  }
            <div class="game-type-badge" [style.background-color]="getGameTypeStyle(game.game_type).bgColor" [style.color]="getGameTypeStyle(game.game_type).color">
              <span class="game-type-icon">{{ getGameTypeStyle(game.game_type).icon }}</span>
                  <span class="game-type-label">{{ getGameTypeStyle(game.game_type).label }}</span>
                </div>
              </div>
            }
            </div>
          }
          @if (!loadingGames() && categoryGames().length === 0) {
            <div class="empty-state">
              <p>Aucun jeu disponible pour cette sous-matière.</p>
            </div>
          }
        </div>
      }
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
      position: relative;
    }

    .subject-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .subject-card h2 {
      margin: 0 0 0.5rem 0;
      color: var(--theme-primary-color, #4CAF50);
    }

    .subject-teachers {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      font-size: 0.875rem;
      color: var(--theme-text-secondary-color, #666);
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
      position: relative;
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
export class SubjectsComponent implements OnInit, OnDestroy {
  protected readonly application = inject(SubjectsApplication);
  readonly authService = inject(ChildAuthService);
  private readonly infrastructure = inject(SubjectsInfrastructure);
  private readonly router = inject(Router);
  private readonly gamesStatsService = inject(GamesStatsService);
  private readonly gameTypeStyleService = inject(GameTypeStyleService);
  private routerSubscription?: Subscription;

  selectedSubjectId = signal<string | null>(null);
  selectedCategoryId = signal<string | null>(null);
  categoryGames = signal<Game[]>([]);
  subjectGames = signal<Game[]>([]);
  gameScores = signal<Map<string, number>>(new Map());
  loadingGames = signal<boolean>(false);

  // Signal pour stocker les catégories par matière (pour le filtrage)
  categoriesBySubject = signal<Map<string, SubjectCategoryWithProgress[]>>(new Map());

  // Signaux pour stocker les jeux par catégorie et par matière (pour calculer les restants)
  gamesByCategory = signal<Map<string, Game[]>>(new Map());
  gamesBySubject = signal<Map<string, Game[]>>(new Map());

  // Signal pour stocker les profs par matière
  teachersBySubject = signal<Map<string, string[]>>(new Map());

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

        // Charger les profs pour toutes les matières (avec childId pour filtrer par école/niveau)
        this.infrastructure.getTeachersForSubjects(subjectIds, childId).then((teachersMap) => {
          this.teachersBySubject.set(teachersMap);
        }).catch((error) => {
          console.error('[SubjectsComponent] Erreur lors du chargement des professeurs:', error);
          console.error('[SubjectsComponent] Détails de l\'erreur:', error);
        });
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.application.initialize();
    
    // Charger les progressions de toutes les matières
    await this.application.loadAllSubjectsProgress();
    
    // Charger les progressions de toutes les catégories
    await this.application.loadAllCategoriesProgress();
    
    // Écouter les événements de navigation pour recharger la progression quand on revient sur /subjects
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(async (event: NavigationEnd) => {
        // Si on navigue vers /subjects, recharger la progression
        if (event.urlAfterRedirects.startsWith('/subjects')) {
          await this.application.loadAllSubjectsProgress();
          await this.application.loadAllCategoriesProgress();
          
          // Recharger les progressions des catégories dans categoriesBySubject
          const child = this.authService.getCurrentChild();
          if (child) {
            const categoriesMap = new Map(this.categoriesBySubject());
            for (const [subjectId, categories] of categoriesMap.entries()) {
              if (categories.length > 0) {
                const categoryIds = categories.map((cat: { id: string }) => cat.id);
                const progressList = await this.infrastructure.loadChildProgress(child.child_id, categoryIds);
                const updatedCategories: SubjectCategoryWithProgress[] = categories.map(cat => {
                  const progress = progressList.find(p => p.subject_category_id === cat.id);
                  return {
                    ...cat,
                    progress: progress ? {
                      completed: progress.completed,
                      stars_count: progress.stars_count,
                      completion_percentage: progress.completion_percentage,
                      completion_count: progress.completion_count,
                      last_completed_at: progress.last_completed_at,
                      last_played_at: progress.last_played_at,
                    } : cat.progress,
                  } as SubjectCategoryWithProgress;
                });
                categoriesMap.set(subjectId, updatedCategories);
              }
            }
            this.categoriesBySubject.set(categoriesMap);
          }
          
          // Recharger aussi la progression des catégories si une matière est sélectionnée
          const subjectId = this.selectedSubjectId();
          if (subjectId) {
            await this.application.selectSubject(subjectId);
          } else {
            // Si aucune matière n'est sélectionnée, recharger les progressions de toutes les matières
            // pour s'assurer que les étoiles s'affichent correctement dans les cartes
            await this.application.loadAllSubjectsProgress();
          }
        }
      });
    
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

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
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
          
          // Charger les progressions des catégories
          let categoriesWithProgress: SubjectCategoryWithProgress[] = categories.map(cat => ({ ...cat, progress: undefined }));
          if (categories.length > 0) {
            const categoryIds = categories.map((cat: { id: string }) => cat.id);
            const progressList = await this.infrastructure.loadChildProgress(childId, categoryIds);
            categoriesWithProgress = categories.map(cat => {
              const progress = progressList.find(p => p.subject_category_id === cat.id);
              return {
                ...cat,
                progress: progress ? {
                  completed: progress.completed,
                  stars_count: progress.stars_count,
                  completion_percentage: progress.completion_percentage,
                  completion_count: progress.completion_count,
                  last_completed_at: progress.last_completed_at,
                  last_played_at: progress.last_played_at,
                } : undefined,
              } as SubjectCategoryWithProgress;
            });
          }
          
          const currentMap = new Map(this.categoriesBySubject());
          currentMap.set(subjectId, categoriesWithProgress);
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

  /**
   * Retourne le nombre d'étoiles d'une catégorie
   * Retourne 1 si la catégorie est complétée, 0 sinon (pas le nombre total de complétions)
   */
  getCategoryStars(categoryId: string): number {
    // Chercher dans les catégories de la matière sélectionnée
    const category = this.categories().find(cat => cat.id === categoryId);
    if (category?.progress) {
      // Retourner le nombre d'étoiles (stars_count) qui correspond au nombre de fois complétée
      return category.progress.stars_count ?? 0;
    }
    
    // Si pas trouvé, chercher dans toutes les catégories chargées (categoriesBySubject)
    const categoriesMap = this.categoriesBySubject();
    for (const categories of categoriesMap.values()) {
      const foundCategory = categories.find(cat => cat.id === categoryId);
      if (foundCategory?.progress) {
        // Retourner le nombre d'étoiles (stars_count) qui correspond au nombre de fois complétée
        return foundCategory.progress.stars_count ?? 0;
      }
    }
    
    return 0;
  }

  /**
   * Calcule le total d'étoiles pour une matière (matière + sous-matières)
   * Retourne 1 étoile par sous-matière complétée + 1 étoile si la matière elle-même est complétée
   */
  getSubjectTotalStars(subjectId: string): number {
    let totalStars = 0;
    
    // 1. Ajouter les étoiles de la matière principale (stars_count)
    const subjectProgress = this.application.getSubjectProgress(subjectId);
    if (subjectProgress) {
      totalStars += subjectProgress.stars_count ?? 0;
    }
    
    // 2. Ajouter les étoiles de chaque sous-matière (stars_count)
    // Utiliser categoriesBySubject pour récupérer les catégories de cette matière spécifique
    const categoriesForSubject = this.categoriesBySubject().get(subjectId) || [];
    categoriesForSubject.forEach(category => {
      if (category.progress) {
        totalStars += category.progress.stars_count ?? 0;
      }
    });
    
    // Si pas trouvé dans categoriesBySubject, essayer this.categories() (pour la matière sélectionnée)
    if (categoriesForSubject.length === 0) {
      const categories = this.categories();
      // Vérifier que les catégories appartiennent bien à cette matière
      categories.forEach(category => {
        if (category.subject_id === subjectId && category.progress) {
          totalStars += category.progress.stars_count ?? 0;
        }
      });
    }
    
    return totalStars;
  }

  /**
   * Récupère les noms des professeurs pour une matière
   */
  getTeachersForSubject(subjectId: string): string[] {
    return this.teachersBySubject().get(subjectId) || [];
  }

  /**
   * Formate les noms des professeurs pour l'affichage
   * Format: "M. Dupont, Mme Martin"
   */
  formatTeachersNames(teacherNames: string[]): string {
    if (teacherNames.length === 0) {
      return '';
    }
    return teacherNames.join(', ');
  }
}
