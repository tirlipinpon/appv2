import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject } from '@angular/core';
import { pipe, switchMap, catchError, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CollectionInfrastructure } from '../components/infrastructure/infrastructure';
import { Collectible, ChildCollectible } from '../../../core/types/game.types';
import { CollectibleWithStatus, CollectionFilter } from '../types/collection.types';

interface CollectionState {
  collectibles: Collectible[];
  unlockedCollectibles: ChildCollectible[];
  filter: CollectionFilter;
  loading: boolean;
  error: string | null;
}

const initialState: CollectionState = {
  collectibles: [],
  unlockedCollectibles: [],
  filter: 'all',
  loading: false,
  error: null,
};

export const CollectionStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((state) => ({
    collectiblesWithStatus: () => {
      const collectibles = state.collectibles();
      const unlocked = state.unlockedCollectibles();
      const filter = state.filter();

      return collectibles
        .map(collectible => {
          const unlockedItem = unlocked.find(u => u.collectible_id === collectible.id);
          return {
            ...collectible,
            isUnlocked: !!unlockedItem,
            unlockedAt: unlockedItem?.unlocked_at,
          } as CollectibleWithStatus;
        })
        .filter(item => {
          if (filter === 'all') return true;
          if (filter === 'unlocked') return item.isUnlocked;
          if (filter === 'locked') return !item.isUnlocked;
          return true;
        });
    },
    unlockedCount: () => state.unlockedCollectibles().length,
    totalCount: () => state.collectibles().length,
    completionPercentage: () => {
      const total = state.collectibles().length;
      if (total === 0) return 0;
      return Math.round((state.unlockedCollectibles().length / total) * 100);
    },
  })),
  withMethods((store, infrastructure = inject(CollectionInfrastructure)) => ({
    loadCollection: rxMethod<{ childId: string }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ childId }) =>
          Promise.all([
            infrastructure.loadAllCollectibles(),
            infrastructure.loadUnlockedCollectibles(childId),
          ]).then(
            ([collectibles, unlocked]) => {
              patchState(store, {
                collectibles,
                unlockedCollectibles: unlocked,
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
    setFilter: (filter: CollectionFilter) => {
      patchState(store, { filter });
    },
  }))
);

