import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed, effect } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { CollectionApplication } from './components/application/application';
import { CollectionFilter } from './types/collection.types';
import { ChildButtonComponent } from '../../shared/components/child-button/child-button.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar.component';
import { BadgeVisualComponent } from '../../shared/components/badge-visual/badge-visual.component';
import { BadgeLevelIndicatorComponent } from '../../shared/components/badge-level-indicator/badge-level-indicator.component';
import { BadgeNextLevelComponent } from '../../shared/components/badge-next-level/badge-next-level.component';
import { BadgesService } from '../../core/services/badges/badges.service';
import { DailyActivityCardComponent } from '../../shared/components/daily-activity-card/daily-activity-card.component';
import { getNextLevelMessage } from '../../core/utils/badge-progression.util';
import { BadgeWithStatus } from '../../core/types/badge.types';
import { ChildAuthService } from '../../core/auth/child-auth.service';

@Component({
  selector: 'app-collection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChildButtonComponent, ProgressBarComponent, BadgeVisualComponent, BadgeLevelIndicatorComponent, BadgeNextLevelComponent, DailyActivityCardComponent],
  template: `
    <div class="collection-container">
      <h1>Ma Collection</h1>

      <!-- Section Activité Quotidienne -->
      @if (application.dailyActivityStatus()) {
        <app-daily-activity-card
          [status]="application.dailyActivityStatus()!">
        </app-daily-activity-card>
      }

      <!-- Section Badges -->
      @if (!application.isLoading()() && !application.isLoadingBadges()()) {
        <div class="badges-section">
          <h2>Mes Badges</h2>

          <!-- Grille de badges -->
          <div class="badges-grid">
            @for (badge of application.getBadges()(); track badge.id) {
              <div
                class="badge-card"
                [class.unlocked]="badge.isUnlocked"
                [class.locked]="!badge.isUnlocked"
                [title]="getBadgeTooltip(badge)">
                <div class="badge-visual-wrapper">
                  <app-badge-visual
                    [badgeType]="badge.badge_type"
                    [value]="badge.value"
                    [level]="badge.level"
                    [isUnlocked]="badge.isUnlocked"
                    size="medium"
                    [showIcon]="true">
                  </app-badge-visual>
                  @if (badge.isUnlocked && badge.level) {
                    <app-badge-level-indicator
                      [level]="badge.level">
                    </app-badge-level-indicator>
                  }
                </div>
                <div class="badge-info">
                  <h3>{{ badge.name }}</h3>
                  @if (badge.description) {
                    <p>{{ badge.description }}</p>
                  }
                  @if (badge.isUnlocked && badge.unlockedAt) {
                    <div class="unlocked-date">
                      Débloqué le {{ formatDate(badge.unlockedAt) }}
                    </div>
                  }
                  <app-badge-next-level [message]="getNextLevelMessage(badge)" />
                </div>
              </div>
            }
          </div>

          @if (application.getBadges()().length === 0) {
            <div class="empty-state">
              <p>Aucun badge disponible pour le moment.</p>
            </div>
          }
        </div>
      }

      <!-- Section Jours Consécutifs -->
      @if (application.consecutiveGameDaysStatus()) {
        <div class="consecutive-days-section">
          <h2>🔥 Ma Série de Jours</h2>
          <div class="streak-stats">
            <div class="stat-card">
              <div class="stat-value">{{ application.consecutiveGameDaysStatus()!.currentStreak }}</div>
              <div class="stat-label">Jours consécutifs</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ application.consecutiveGameDaysStatus()!.maxStreak }}</div>
              <div class="stat-label">Meilleure série</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ application.consecutiveGameDaysStatus()!.currentLevel }}</div>
              <div class="stat-label">Niveau actuel</div>
            </div>
          </div>
          @if (application.consecutiveGameDaysStatus()!.isActive) {
            <div class="streak-active">
              ✅ Série active ! Continue demain pour débloquer le niveau {{ application.consecutiveGameDaysStatus()!.currentLevel + 1 }}
            </div>
          } @else {
            <div class="streak-broken">
              ⚠️ Série brisée. Rejoue aujourd'hui pour recommencer !
            </div>
          }
          @if (application.consecutiveGameDaysStatus()!.nextLevelDays > 0) {
            <div class="next-level-info">
              <p>Prochain niveau : {{ application.consecutiveGameDaysStatus()!.nextLevelDays }} jours consécutifs</p>
            </div>
          }
        </div>
      }

      @if (application.isLoading()()) {
        <div class="loading">
          Chargement de ta collection...
        </div>
      }

      @if (application.getError()()) {
        <div class="error">
          {{ application.getError()() }}
        </div>
      }

      @if (!application.isLoading()() && !application.getError()()) {
        <div class="collection-content">
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
            (buttonClick)="setFilter('all')"
            [variant]="application.getFilter()() === 'all' ? 'primary' : 'secondary'"
            size="small">
            Tous
          </app-child-button>
          <app-child-button
            (buttonClick)="setFilter('unlocked')"
            [variant]="application.getFilter()() === 'unlocked' ? 'primary' : 'secondary'"
            size="small">
            Débloqués
          </app-child-button>
          <app-child-button
            (buttonClick)="setFilter('locked')"
            [variant]="application.getFilter()() === 'locked' ? 'primary' : 'secondary'"
            size="small">
            Verrouillés
          </app-child-button>
        </div>

          <!-- Grille d'objets -->
          <div class="collectibles-grid">
            @for (collectible of application.getCollectibles()(); track collectible.id) {
              <div
                class="collectible-card"
                [class.unlocked]="collectible.isUnlocked"
                [class.locked]="!collectible.isUnlocked">
                <div class="collectible-image">
                  @if (collectible.image_url) {
                    <img
                      [src]="collectible.image_url"
                      [alt]="collectible.name"
                      [class]="collectible.isUnlocked ? '' : 'locked-image'">
                  }
                  @if (!collectible.image_url) {
                    <div class="placeholder-image">
                      {{ collectible.name.charAt(0) }}
                    </div>
                  }
                  @if (!collectible.isUnlocked) {
                    <div class="lock-overlay">
                      🔒
                    </div>
                  }
                </div>
                <div class="collectible-info">
                  <h3>{{ collectible.name }}</h3>
                  @if (collectible.description) {
                    <p>{{ collectible.description }}</p>
                  }
                  @if (collectible.isUnlocked && collectible.unlockedAt) {
                    <div class="unlocked-date">
                      Débloqué le {{ formatDate(collectible.unlockedAt) }}
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          @if (application.getCollectibles()().length === 0) {
            <div class="empty-state">
              <p>Aucun objet dans ta collection pour le moment.</p>
            </div>
          }
        </div>
      }
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

    /* Section Badges */
    .badges-section {
      margin-top: 2rem;
      margin-bottom: 4rem;
      padding-bottom: 2rem;
      border-bottom: 2px solid var(--theme-border-color, #e0e0e0);
    }

    .badges-section h2 {
      margin-bottom: 2rem;
      color: var(--theme-text-color, #333);
    }

    .badges-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .badges-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1.5rem;
    }
    @media (min-width: 768px) {
      .badges-grid {
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 2rem;
      }
    }

    .badge-card {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      text-align: center;
      cursor: help;
    }

    .badge-card.unlocked {
      border: 2px solid var(--theme-primary-color, #4CAF50);
    }

    .badge-card.locked {
      opacity: 0.7;
    }

    .badge-card.unlocked:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .badge-visual-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 1rem;
      position: relative;
    }

    .badge-info {
      text-align: center;
    }

    .badge-info h3 {
      margin: 0 0 0.5rem 0;
      color: var(--theme-text-color, #333);
      font-size: 1rem;
      font-weight: 600;
    }

    .badge-info p {
      margin: 0 0 0.5rem 0;
      color: #666;
      font-size: 0.875rem;
    }

    .badge-info .unlocked-date {
      font-size: 0.75rem;
      color: var(--theme-primary-color, #4CAF50);
      font-weight: 600;
      margin-top: 0.5rem;
    }

    .badge-info .locked-info {
      font-size: 0.75rem;
      color: #999;
      font-style: italic;
      margin-top: 0.5rem;
    }

    /* Section Jours Consécutifs */
    .consecutive-days-section {
      margin-top: 2rem;
      margin-bottom: 4rem;
      padding: 2rem;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      border-radius: var(--theme-border-radius, 12px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .consecutive-days-section h2 {
      margin-bottom: 1.5rem;
      color: var(--theme-text-color, #333);
      text-align: center;
    }

    .streak-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .streak-active {
      background: #4CAF50;
      color: white;
      padding: 1rem;
      border-radius: var(--theme-border-radius, 8px);
      text-align: center;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .streak-broken {
      background: #FF9800;
      color: white;
      padding: 1rem;
      border-radius: var(--theme-border-radius, 8px);
      text-align: center;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .next-level-info {
      text-align: center;
      color: #666;
      font-size: 0.875rem;
      margin-top: 1rem;
    }

    .next-level-info p {
      margin: 0;
    }
  `]
})
export class CollectionComponent implements OnInit, OnDestroy {
  protected readonly application = inject(CollectionApplication);
  private readonly badgesService = inject(BadgesService);
  private readonly authService = inject(ChildAuthService);
  private readonly router = inject(Router);
  private navigationSubscription?: Subscription;

  // Cache de progression actuelle par type de badge
  // Utiliser un objet Record au lieu d'un Map pour une meilleure réactivité
  private readonly badgeProgressCache = signal<Record<string, number | { minutes: number; games: number }>>({});
  
  // Flag pour éviter les appels multiples simultanés
  private isLoadingProgress = false;

  constructor() {
    // Écouter les événements de navigation pour recharger les données quand on revient sur /collection
    this.navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(async (event: NavigationEnd) => {
        // Si on navigue vers /collection, recharger les données et la progression
        if (event.urlAfterRedirects.includes('/collection')) {
          await this.application.initialize();
          // Attendre un peu pour que les badges soient bien chargés
          setTimeout(async () => {
            await this.loadBadgeProgress();
          }, 300);
        }
      });

    // Recharger la progression quand les badges changent
    effect(() => {
      const badges = this.application.getBadges()();
      const isLoading = this.application.isLoadingBadges()();
      // Si les badges sont chargés et qu'on n'est plus en train de charger, recharger la progression
      if (badges.length > 0 && !isLoading && !this.isLoadingProgress) {
        // Utiliser setTimeout pour éviter les appels multiples pendant le chargement
        setTimeout(() => {
          this.loadBadgeProgress();
        }, 300);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.application.initialize();
    await this.loadBadgeProgress();
  }

  /**
   * Charge la progression actuelle pour tous les badges qui en ont besoin
   */
  private async loadBadgeProgress(): Promise<void> {
    // Éviter les appels multiples simultanés
    if (this.isLoadingProgress) {
      return;
    }

    const child = this.authService.getCurrentChild();
    if (!child) {
      return;
    }

    this.isLoadingProgress = true;

    try {
      const progressRecord: Record<string, number | { minutes: number; games: number }> = {};

      // Charger la progression pour les badges qui en ont besoin
      const badgeTypes = ['perfect_games_count', 'daily_streak_responses', 'consecutive_correct'];
      
      for (const badgeType of badgeTypes) {
        try {
          const progress = await this.badgesService.getCurrentProgress(child.child_id, badgeType);
          if (progress !== null) {
            progressRecord[badgeType] = progress;
          }
        } catch (error) {
          console.error(`[CollectionComponent] Erreur lors du chargement de la progression pour ${badgeType}:`, error);
        }
      }

      // Mettre à jour le cache (créer un nouvel objet pour déclencher la réactivité)
      // Angular détecte les changements par référence, donc on doit créer un nouvel objet
      // Utiliser JSON.parse(JSON.stringify()) pour créer une copie profonde et forcer la détection
      this.badgeProgressCache.set(JSON.parse(JSON.stringify(progressRecord)));
    } finally {
      this.isLoadingProgress = false;
    }
  }

  ngOnDestroy(): void {
    // Nettoyer la souscription pour éviter les fuites mémoire
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
    }
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

  getBadgeTooltip(badge: BadgeWithStatus): string {
    let tooltip = badge.description || badge.name;
    if (badge.isUnlocked) {
      tooltip += `\nDébloqué le ${this.formatDate(badge.unlockedAt!)}`;
      if (badge.level) {
        tooltip += ` - Niveau ${badge.level}`;
      }
      if (badge.value !== undefined) {
        tooltip += `\nValeur obtenue : ${badge.value}`;
      }
    }
    const nextMessage = this.getNextLevelMessage(badge);
    if (nextMessage) {
      tooltip += `\n${nextMessage}`;
    }
    return tooltip;
  }

  /**
   * Récupère le message du prochain niveau pour un badge
   * Fonctionne pour les badges débloqués ET verrouillés
   * Affiche la progression actuelle et ce qui reste à faire
   * Utilise un computed pour être réactif aux changements de progression
   */
  getNextLevelMessageForBadge(badge: BadgeWithStatus): string | null {
    // Lire le cache pour déclencher la réactivité
    const cache = this.badgeProgressCache();
    
    // Pour consecutive_game_days, utiliser nextLevelDays du status avec progression actuelle
    if (badge.badge_type === 'consecutive_game_days') {
      const status = this.application.consecutiveGameDaysStatus();
      if (status) {
        const currentProgress = status.currentStreak;
        return getNextLevelMessage(badge, undefined, currentProgress);
      }
    }
    
    // Pour daily_activity, utiliser nextLevelTarget du status avec progression actuelle
    if (badge.badge_type === 'daily_activity') {
      const status = this.application.dailyActivityStatus();
      if (status) {
        const currentProgress = {
          minutes: status.totalActiveMinutes,
          games: status.totalGamesCompleted,
        };
        return getNextLevelMessage(badge, undefined, currentProgress);
      }
    }

    // Pour les autres badges, récupérer la progression depuis le cache
    const progress = cache[badge.badge_type];
    if (progress !== undefined) {
      return getNextLevelMessage(badge, undefined, progress);
    }

    // Si pas de progression disponible, afficher juste le seuil
    return getNextLevelMessage(badge);
  }

  /**
   * @deprecated Utiliser getNextLevelMessageForBadge à la place
   * Gardé pour compatibilité avec getBadgeTooltip
   */
  getNextLevelMessage(badge: BadgeWithStatus): string | null {
    return this.getNextLevelMessageForBadge(badge);
  }
}
