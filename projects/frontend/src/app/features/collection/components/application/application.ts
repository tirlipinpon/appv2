import { inject, Injectable, Injector, runInInjectionContext } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { firstValueFrom, combineLatest } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { CollectionStore } from '../../store/index';
import { BadgesStore } from '../../../badges/store/index';
import { ChildAuthService } from '../../../../core/auth/child-auth.service';
import { CollectionFilter } from '../../types/collection.types';
import { ConsecutiveGameDaysService } from '../../../../core/services/badges/consecutive-game-days.service';
import { ConsecutiveGameDaysStatus } from '../../../../core/types/consecutive-game-days.types';
import { DailyActivityService } from '../../../../core/services/badges/daily-activity.service';
import { DailyActivityStatus } from '../../../../core/types/daily-activity.types';
import { signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CollectionApplication {
  private readonly store = inject(CollectionStore);
  private readonly badgesStore = inject(BadgesStore);
  private readonly authService = inject(ChildAuthService);
  private readonly consecutiveGameDaysService = inject(ConsecutiveGameDaysService);
  private readonly dailyActivityService = inject(DailyActivityService);
  private readonly injector = inject(Injector);
  
  // Signal pour le statut des jours consécutifs
  private readonly _consecutiveGameDaysStatus = signal<ConsecutiveGameDaysStatus | null>(null);
  readonly consecutiveGameDaysStatus = this._consecutiveGameDaysStatus.asReadonly();
  
  // Signal pour le statut de l'activité quotidienne
  private readonly _dailyActivityStatus = signal<DailyActivityStatus | null>(null);
  readonly dailyActivityStatus = this._dailyActivityStatus.asReadonly();

  async initialize(): Promise<void> {
    const child = await this.authService.getCurrentChild();
    if (child) {
      // Charger collectibles et badges en parallèle
      // Les rxMethod retournent void, donc on lance les chargements et on surveille les signaux loading
      this.store.loadCollection({ childId: child.child_id });
      this.badgesStore.loadBadges();
      this.badgesStore.loadChildBadges(child.child_id);
      
      // Charger le statut des jours consécutifs
      try {
        const status = await this.consecutiveGameDaysService.getConsecutiveGameDaysStatus(child.child_id);
        this._consecutiveGameDaysStatus.set(status);
      } catch (error) {
        console.error('[CollectionApplication] Erreur lors du chargement du statut des jours consécutifs:', error);
        this._consecutiveGameDaysStatus.set(null);
      }
      
      // Charger le statut de l'activité quotidienne en forçant le recalcul
      try {
        console.log('[CollectionApplication] Recalcul de l\'activité quotidienne pour child:', child.child_id);
        const activityResult = await this.dailyActivityService.recalculateAndGetStatus(child.child_id);
        console.log('[CollectionApplication] Résultat du recalcul:', activityResult);
        
        // Extraire uniquement les propriétés de DailyActivityStatus (newLevelsUnlocked est déjà dans DailyActivityStatus)
        const activityStatus: DailyActivityStatus = {
          activityDate: activityResult.activityDate,
          totalActiveMinutes: activityResult.totalActiveMinutes,
          totalGamesCompleted: activityResult.totalGamesCompleted,
          maxLevelToday: activityResult.maxLevelToday,
          levelsUnlockedToday: activityResult.levelsUnlockedToday,
          newLevelsUnlocked: activityResult.newLevelsUnlocked,
          nextLevelTarget: activityResult.nextLevelTarget,
          progressPercentage: activityResult.progressPercentage,
          status: activityResult.status,
        };
        console.log('[CollectionApplication] Mise à jour du signal avec:', activityStatus);
        this._dailyActivityStatus.set(activityStatus);
        console.log('[CollectionApplication] Signal mis à jour, valeur actuelle:', this._dailyActivityStatus());
        
        // Si de nouveaux niveaux ont été débloqués, afficher une notification
        if (activityStatus.newLevelsUnlocked && activityStatus.newLevelsUnlocked.length > 0) {
          console.log('[CollectionApplication] Nouveaux niveaux débloqués:', activityStatus.newLevelsUnlocked);
          // TODO: Afficher une notification de badge débloqué si nécessaire
        }
      } catch (error) {
        console.error('[CollectionApplication] Erreur lors du chargement du statut d\'activité quotidienne:', error);
        this._dailyActivityStatus.set(null);
      }
      
      // Attendre que tous les chargements soient terminés en surveillant les signaux loading de manière réactive
      await this.waitForLoadingComplete();
    }
  }

  /**
   * Attend que tous les chargements soient terminés en utilisant les Observables des signaux
   */
  private async waitForLoadingComplete(): Promise<void> {
    // Utiliser runInInjectionContext pour appeler toObservable dans un contexte d'injection
    const collectionLoading$ = runInInjectionContext(this.injector, () => 
      toObservable(this.store.loading)
    );
    const badgesLoading$ = runInInjectionContext(this.injector, () => 
      toObservable(this.badgesStore.loading)
    );
    
    // Attendre que les deux signaux loading soient à false
    // Utiliser combineLatest pour surveiller les deux en parallèle
    // filter pour ne prendre que quand les deux sont false
    // take(1) pour compléter après la première émission valide
    await firstValueFrom(
      combineLatest([collectionLoading$, badgesLoading$]).pipe(
        filter(([collectionLoading, badgesLoading]) => !collectionLoading && !badgesLoading),
        take(1)
      )
    );
  }

  setFilter(filter: CollectionFilter): void {
    this.store.setFilter(filter);
  }

  getCollectibles() {
    return this.store.collectiblesWithStatus;
  }

  getUnlockedCount() {
    return this.store.unlockedCount;
  }

  getTotalCount() {
    return this.store.totalCount;
  }

  getCompletionPercentage() {
    return this.store.completionPercentage;
  }

  isLoading() {
    return this.store.loading;
  }

  getError() {
    return this.store.error;
  }

  getFilter() {
    return this.store.filter;
  }

  // Méthodes pour les badges
  getBadges() {
    return this.badgesStore.badgesWithStatus;
  }

  getBadgesUnlockedCount() {
    return this.badgesStore.unlockedCount;
  }

  getBadgesTotalCount() {
    return this.badgesStore.totalCount;
  }

  getBadgesCompletionPercentage() {
    return this.badgesStore.completionPercentage;
  }

  isLoadingBadges() {
    return this.badgesStore.loading;
  }
}

