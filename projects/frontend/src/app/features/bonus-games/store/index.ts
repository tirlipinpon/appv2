import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { inject } from '@angular/core';
import { pipe, switchMap, catchError, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { BonusGamesInfrastructure } from '../components/infrastructure/infrastructure';
import { BonusGame, ChildBonusGameUnlock } from '../../../core/types/game.types';

interface BonusGamesState {
  bonusGames: BonusGame[];
  unlockedGames: ChildBonusGameUnlock[];
  loading: boolean;
  error: string | null;
}

const initialState: BonusGamesState = {
  bonusGames: [],
  unlockedGames: [],
  loading: false,
  error: null,
};

export const BonusGamesStore = signalStore(
  { providedIn: 'root' },
  withDevtools('bonus-games'),
  withState(initialState),
  withComputed((state) => ({
    gamesWithStatus: () => {
      const games = state.bonusGames();
      const unlocked = state.unlockedGames();
      return games.map(game => ({
        ...game,
        isUnlocked: unlocked.some(u => u.bonus_game_id === game.id),
        unlockData: unlocked.find(u => u.bonus_game_id === game.id),
      }));
    },
    unlockedCount: () => state.unlockedGames().length,
    totalCount: () => state.bonusGames().length,
  })),
  withMethods((store, infrastructure = inject(BonusGamesInfrastructure)) => ({
    loadBonusGames: rxMethod<{ childId: string }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ childId }) =>
          Promise.all([
            infrastructure.loadAllBonusGames(),
            infrastructure.loadUnlockedBonusGames(childId),
          ]).then(
            ([games, unlocked]) => {
              patchState(store, {
                bonusGames: games,
                unlockedGames: unlocked,
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

