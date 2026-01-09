import { inject, Injectable } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { firstValueFrom, combineLatest } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { CollectionStore } from '../../store/index';
import { BadgesStore } from '../../../badges/store/index';
import { ChildAuthService } from '../../../../core/auth/child-auth.service';
import { CollectionFilter } from '../../types/collection.types';

@Injectable({
  providedIn: 'root',
})
export class CollectionApplication {
  private readonly store = inject(CollectionStore);
  private readonly badgesStore = inject(BadgesStore);
  private readonly authService = inject(ChildAuthService);

  async initialize(): Promise<void> {
    const child = await this.authService.getCurrentChild();
    if (child) {
      // Charger collectibles et badges en parallèle
      // Les rxMethod retournent void, donc on lance les chargements et on surveille les signaux loading
      this.store.loadCollection({ childId: child.child_id });
      this.badgesStore.loadBadges();
      this.badgesStore.loadChildBadges(child.child_id);
      
      // Attendre que tous les chargements soient terminés en surveillant les signaux loading de manière réactive
      await this.waitForLoadingComplete();
    }
  }

  /**
   * Attend que tous les chargements soient terminés en utilisant les Observables des signaux
   */
  private async waitForLoadingComplete(): Promise<void> {
    const collectionLoading$ = toObservable(this.store.loading);
    const badgesLoading$ = toObservable(this.badgesStore.loading);
    
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

