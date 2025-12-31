import { inject, Injectable } from '@angular/core';
import { DashboardStore } from '../../store/index';
import { ChildAuthService } from '../../../../core/auth/child-auth.service';

@Injectable({
  providedIn: 'root',
})
export class DashboardApplication {
  private readonly store = inject(DashboardStore);
  private readonly authService = inject(ChildAuthService);

  async initialize(): Promise<void> {
    const child = await this.authService.getCurrentChild();
    if (child) {
      await this.store.loadDashboard({ childId: child.child_id });
    }
  }

  getStatistics() {
    return this.store.statistics;
  }

  getRecentCollectibles() {
    return this.store.recentCollectibles;
  }

  isLoading() {
    return this.store.loading;
  }

  getError() {
    return this.store.error;
  }

  getSuccessRatePercentage() {
    return this.store.successRatePercentage;
  }
}

