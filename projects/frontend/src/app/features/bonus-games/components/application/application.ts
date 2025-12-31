import { inject, Injectable } from '@angular/core';
import { BonusGamesStore } from '../../store/index';
import { ChildAuthService } from '../../../../core/auth/child-auth.service';

@Injectable({
  providedIn: 'root',
})
export class BonusGamesApplication {
  private readonly store = inject(BonusGamesStore);
  private readonly authService = inject(ChildAuthService);

  async initialize(): Promise<void> {
    const child = await this.authService.getCurrentChild();
    if (child) {
      await this.store.loadBonusGames({ childId: child.child_id });
    }
  }

  getGames() {
    return this.store.gamesWithStatus;
  }

  getUnlockedCount() {
    return this.store.unlockedCount;
  }

  getTotalCount() {
    return this.store.totalCount;
  }

  isLoading() {
    return this.store.loading;
  }

  getError() {
    return this.store.error;
  }
}

