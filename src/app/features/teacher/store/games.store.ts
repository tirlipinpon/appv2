import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of, forkJoin } from 'rxjs';
import { GameType } from '../types/game-type';
import { Game, GameCreate, GameUpdate } from '../types/game';
import { Infrastructure } from '../components/infrastructure/infrastructure';
import { GeneratedGameWithState, AIGameGenerationRequest } from '../types/ai-game-generation';

export interface GamesState {
  games: Game[];
  gameTypes: GameType[];
  isLoading: boolean;
  error: string[];
  // États pour la génération IA
  generatedGames: GeneratedGameWithState[];
  isGenerating: boolean;
  generationProgress: number;
}

const initialState: GamesState = {
  games: [],
  gameTypes: [],
  isLoading: false,
  error: [],
  generatedGames: [],
  isGenerating: false,
  generationProgress: 0,
};

export const GamesStore = signalStore(
  { providedIn: 'root' },
  withDevtools('games'),
  withState(initialState),
  withComputed((store) => ({
    hasError: () => store.error().length > 0,
    hasGames: () => store.games().length > 0,
    hasGameTypes: () => store.gameTypes().length > 0,
    hasGeneratedGames: () => store.generatedGames().length > 0,
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

    // Méthodes pour la génération IA
    generateGamesWithAI: rxMethod<AIGameGenerationRequest>(
      pipe(
        tap(() => patchState(store, { isGenerating: true, generationProgress: 0, error: [] })),
        switchMap((request) =>
          infrastructure.generateGamesWithAI(request).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la génération des jeux';
                patchState(store, { 
                  error: [errorMessage], 
                  isGenerating: false,
                  generationProgress: 0
                });
              } else if (result.games) {
                // Ajouter des IDs temporaires et l'état d'édition
                const gamesWithState: GeneratedGameWithState[] = result.games.map((game, index) => ({
                  ...game,
                  _tempId: `temp-${Date.now()}-${index}`,
                  _isEditing: false,
                }));
                patchState(store, { 
                  generatedGames: gamesWithState, 
                  isGenerating: false,
                  generationProgress: 100
                });
              } else {
                patchState(store, { isGenerating: false, generationProgress: 0 });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la génération des jeux';
              patchState(store, { 
                error: [errorMessage], 
                isGenerating: false,
                generationProgress: 0
              });
              return of(null);
            })
          )
        )
      )
    ),

    validateGeneratedGames: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap(() => {
          const gamesToSave = store.generatedGames();
          
          if (gamesToSave.length === 0) {
            patchState(store, { isLoading: false });
            return of(null);
          }

          // Créer tous les jeux en parallèle
          const createObservables = gamesToSave.map(game => {
            const { _tempId, _isEditing, ...gameData } = game;
            return infrastructure.createGame(gameData);
          });

          return forkJoin(createObservables).pipe(
            tap((results) => {
              const errors: string[] = [];
              const createdGames: Game[] = [];

              results.forEach((result, index) => {
                if (result.error) {
                  errors.push(`Jeu ${index + 1}: ${result.error.message}`);
                } else if (result.game) {
                  createdGames.push(result.game);
                }
              });

              if (errors.length > 0) {
                patchState(store, { 
                  error: errors, 
                  isLoading: false 
                });
              } else {
                patchState(store, {
                  games: [...createdGames, ...store.games()],
                  generatedGames: [],
                  isLoading: false,
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la sauvegarde des jeux';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of(null);
            })
          );
        })
      )
    ),

    updateGeneratedGame: (tempId: string, updates: Partial<GameCreate>) => {
      const currentGames = store.generatedGames();
      const updatedGames = currentGames.map(game => 
        game._tempId === tempId 
          ? { ...game, ...updates }
          : game
      );
      patchState(store, { generatedGames: updatedGames });
    },

    toggleEditGeneratedGame: (tempId: string) => {
      const currentGames = store.generatedGames();
      const updatedGames = currentGames.map(game => 
        game._tempId === tempId 
          ? { ...game, _isEditing: !game._isEditing }
          : game
      );
      patchState(store, { generatedGames: updatedGames });
    },

    removeGeneratedGame: (tempId: string) => {
      const currentGames = store.generatedGames();
      const filteredGames = currentGames.filter(game => game._tempId !== tempId);
      patchState(store, { generatedGames: filteredGames });
    },

    clearGeneratedGames: () => {
      patchState(store, { 
        generatedGames: [], 
        isGenerating: false, 
        generationProgress: 0 
      });
    },
  }))
);

