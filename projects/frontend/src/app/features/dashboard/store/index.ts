import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { inject } from '@angular/core';
import { pipe, switchMap, catchError, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DashboardInfrastructure } from '../components/infrastructure/infrastructure';
import { ChildStatistics } from '../../../core/types/game.types';

interface DashboardState {
  statistics: ChildStatistics | null;
  recentCollectibles: any[];
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  statistics: null,
  recentCollectibles: [],
  loading: false,
  error: null,
};

export const DashboardStore = signalStore(
  { providedIn: 'root' },
  withDevtools('dashboard'),
  withState(initialState),
  withComputed((state) => ({
    hasStatistics: () => state.statistics() !== null,
    successRatePercentage: () => {
      const stats = state.statistics();
      return stats ? Math.round(stats.success_rate) : 0;
    },
  })),
  withMethods((store, infrastructure = inject(DashboardInfrastructure)) => ({
    loadDashboard: rxMethod<{ childId: string }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ childId }) =>
          Promise.all([
            infrastructure.loadChildStatistics(childId),
            infrastructure.loadRecentCollectibles(childId, 5),
          ]).then(
            ([statistics, recentCollectibles]) => {
              patchState(store, {
                statistics,
                recentCollectibles,
                loading: false,
              });
            },
            (error) => {
              patchState(store, { error: error.message, loading: false });
            }
          )
        ),
        catchError((error) => {
          patchState(store, { error: error.message, loading: false });
          return of(null);
        })
      )
    ),
  }))
);

