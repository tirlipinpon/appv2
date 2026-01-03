import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { inject } from '@angular/core';
import { pipe, switchMap, catchError, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { StatisticsService } from '../../../core/services/statistics/statistics.service';
import { ChildStatistics } from '../../../core/types/game.types';

interface SettingsState {
  statistics: ChildStatistics | null;
  loading: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  statistics: null,
  loading: false,
  error: null,
};

export const SettingsStore = signalStore(
  { providedIn: 'root' },
  withDevtools('settings'),
  withState(initialState),
  withComputed((state) => ({
    hasStatistics: () => state.statistics() !== null,
  })),
  withMethods((store, statisticsService = inject(StatisticsService)) => ({
    loadStatistics: rxMethod<{ childId: string }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ childId }) =>
          statisticsService.loadChildStatistics(childId).then(
            (statistics) => {
              patchState(store, { statistics, loading: false });
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

