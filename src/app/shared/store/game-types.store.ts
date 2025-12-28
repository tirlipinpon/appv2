import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { GameType } from '../../features/teacher/types/game-type';
import { GameTypeService } from '../../features/teacher/services/game-type/game-type.service';
import { ErrorSnackbarService } from '../services/snackbar/error-snackbar.service';
import { setStoreError } from '../utils/store-error-helper';

export interface GameTypesState {
  gameTypes: GameType[];
  gameTypesById: Record<string, GameType>; // Key: gameTypeId
  isLoading: boolean;
  error: string[];
  isInitialized: boolean;
}

const initialState: GameTypesState = {
  gameTypes: [],
  gameTypesById: {},
  isLoading: false,
  error: [],
  isInitialized: false,
};

export const GameTypesStore = signalStore(
  { providedIn: 'root' },
  withDevtools('game-types'),
  withState(initialState),
  withComputed((store) => ({
    hasError: () => store.error().length > 0,
    hasGameTypes: () => store.gameTypes().length > 0,
  })),
  withMethods((store, gameTypeService = inject(GameTypeService), errorSnackbar = inject(ErrorSnackbarService)) => ({
    /**
     * Charge tous les types de jeux
     */
    loadGameTypes: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap(() => {
          // Si déjà chargé, retourner immédiatement
          if (store.gameTypes().length > 0) {
            patchState(store, { isLoading: false });
            return of(null);
          }

          return gameTypeService.getGameTypes().pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des types de jeux';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                const gameTypesById: Record<string, GameType> = {};
                result.gameTypes.forEach(gameType => {
                  gameTypesById[gameType.id] = gameType;
                });
                patchState(store, { 
                  gameTypes: result.gameTypes,
                  gameTypesById,
                  isLoading: false,
                  isInitialized: true
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des types de jeux';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Efface le cache
     */
    clearCache: () => {
      patchState(store, { 
        gameTypes: [],
        gameTypesById: {}
      });
    },

    /**
     * Efface les erreurs
     */
    clearError: () => {
      patchState(store, { error: [] });
    },

    /**
     * Marque le store comme initialisé
     */
    markAsInitialized: () => {
      patchState(store, { isInitialized: true });
    },

    /**
     * Vérifie si le store est initialisé
     */
    checkIsInitialized: () => {
      return store.isInitialized();
    },

    /**
     * Réinitialise le flag d'initialisation
     */
    resetInitialization: () => {
      patchState(store, { isInitialized: false });
    },
  }))
);

