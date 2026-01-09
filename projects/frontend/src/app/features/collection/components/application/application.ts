import { inject, Injectable } from '@angular/core';
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'collection.application.ts:15',message:'initialize ENTRY',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    const child = await this.authService.getCurrentChild();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'collection.application.ts:17',message:'initialize CHILD CHECK',data:{hasChild:!!child,childId:child?.child_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    if (child) {
      // Charger collectibles et badges en parallèle
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'collection.application.ts:20',message:'initialize LOADING START',data:{childId:child.child_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      await Promise.all([
        this.store.loadCollection({ childId: child.child_id }),
        this.badgesStore.loadBadges(),
        this.badgesStore.loadChildBadges(child.child_id),
      ]);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'collection.application.ts:25',message:'initialize LOADING COMPLETE',data:{childId:child.child_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
    }
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

