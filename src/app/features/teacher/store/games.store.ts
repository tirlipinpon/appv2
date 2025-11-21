import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { GameType } from '../types/game-type';
import { Game, GameCreate, GameUpdate } from '../types/game';
import { Infrastructure } from '../components/infrastructure/infrastructure';

export interface GamesState {
  games: Game[];
  gameTypes: GameType[];
  isLoading: boolean;
  error: string[];
}

const initialState: GamesState = {
  games: [],
  gameTypes: [],
  isLoading: false,
  error: [],
};

export const GamesStore = signalStore(
  { providedIn: 'root' },
  withDevtools('games'),
  withState(initialState),
  withComputed((store) => ({
    hasError: () => store.error().length > 0,
    hasGames: () => store.games().length > 0,
    hasGameTypes: () => store.gameTypes().length > 0,
  })),
  withMethods((store, infrastructure = inject(Infrastructure)) => ({
    loadGameTypes: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap(() =>
          infrastructure.getGameTypes().pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des types de jeux';
                patchState(store, { error: [errorMessage], isLoading: false });
              } else {
                patchState(store, { gameTypes: result.gameTypes, isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des types de jeux';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of(null);
            })
          )
        )
      )
    ),

    loadGamesBySubject: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap((subjectId) =>
          infrastructure.getGamesBySubject(subjectId).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des jeux';
                patchState(store, { error: [errorMessage], isLoading: false });
              } else {
                patchState(store, { games: result.games, isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des jeux';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of(null);
            })
          )
        )
      )
    ),

    createGame: rxMethod<GameCreate>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap((gameData) =>
          infrastructure.createGame(gameData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création du jeu';
                patchState(store, { error: [errorMessage], isLoading: false });
              } else if (result.game) {
                patchState(store, {
                  games: [result.game, ...store.games()],
                  isLoading: false,
                });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création du jeu';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of(null);
            })
          )
        )
      )
    ),

    updateGame: rxMethod<{ id: string; updates: GameUpdate }>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap(({ id, updates }) =>
          infrastructure.updateGame(id, updates).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la mise à jour du jeu';
                patchState(store, { error: [errorMessage], isLoading: false });
              } else if (result.game) {
                const currentGames = store.games();
                const updatedGames = currentGames.map((g) =>
                  g.id === id ? result.game! : g
                );
                patchState(store, { games: updatedGames, isLoading: false });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la mise à jour du jeu';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of(null);
            })
          )
        )
      )
    ),

    deleteGame: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap((gameId) => {
          const previous = store.games();
          // Optimistic update: remove locally first
          patchState(store, {
            games: previous.filter((g) => g.id !== gameId),
            isLoading: false,
          });
          return infrastructure.deleteGame(gameId).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la suppression du jeu';
                // rollback
                patchState(store, { games: previous, error: [errorMessage], isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la suppression du jeu';
              // rollback
              patchState(store, { games: previous, error: [errorMessage], isLoading: false });
              return of(null);
            })
          );
        })
      )
    ),

    setError: (error: string) => {
      patchState(store, { error: [error], isLoading: false });
    },
    clearError: () => {
      patchState(store, { error: [] });
    },
    clearGames: () => {
      patchState(store, { games: [] });
    },
  }))
);

