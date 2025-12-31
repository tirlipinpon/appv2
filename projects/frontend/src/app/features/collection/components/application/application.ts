import { inject, Injectable } from '@angular/core';
import { CollectionStore } from '../../store/index';
import { ChildAuthService } from '../../../../core/auth/child-auth.service';
import { CollectionFilter } from '../../types/collection.types';

@Injectable({
  providedIn: 'root',
})
export class CollectionApplication {
  private readonly store = inject(CollectionStore);
  private readonly authService = inject(ChildAuthService);

  async initialize(): Promise<void> {
    const child = await this.authService.getCurrentChild();
    if (child) {
      await this.store.loadCollection({ childId: child.child_id });
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
}

