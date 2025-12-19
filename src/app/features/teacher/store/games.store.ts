import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of, forkJoin, concat } from 'rxjs';
import { toArray } from 'rxjs/operators';
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

    // Méthodes pour la génération IA (séquentielle - jeu par jeu)
    generateGamesWithAI: rxMethod<AIGameGenerationRequest>(
      pipe(
        tap(() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'games.store.ts:189',message:'generateGamesWithAI started',data:{numberOfGames:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          patchState(store, { isGenerating: true, generationProgress: 0, error: [], generatedGames: [] });
        }),
        switchMap((request) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'games.store.ts:191',message:'switchMap entered',data:{numberOfGames:request.numberOfGames},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          const numberOfGames = request.numberOfGames;
          const games$ = [];

          // Créer un observable pour chaque jeu à générer
          for (let i = 0; i < numberOfGames; i++) {
            games$.push(
              infrastructure.generateSingleGameWithAI({
                ...request,
                // Passer les jeux déjà générés dans cette session pour éviter les doublons
                alreadyGeneratedInSession: store.generatedGames().map(g => ({
                  question: g.question ?? null,
                  game_type_id: g.game_type_id,
                  metadata: g.metadata ?? null
                }))
              }).pipe(
                tap((result) => {
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'games.store.ts:198',message:'game generation result received',data:{hasError:!!result.error,hasGame:!!result.game,gameIndex:i},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                  // #endregion
                  if (result.error) {
                    throw new Error(result.error.message || 'Erreur génération jeu');
                  }
                  
                  if (result.game) {
                    // Ajouter le jeu généré à la liste
                    const newGame: GeneratedGameWithState = {
                      ...result.game,
                      _tempId: `temp-${Date.now()}-${i}`,
                      _isEditing: true,
                    };
                    
                    const currentGames = store.generatedGames();
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'games.store.ts:212',message:'before patchState',data:{currentGamesCount:currentGames.length,newProgress:Math.round(((i + 1) / numberOfGames) * 100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                    // #endregion
                    patchState(store, { 
                      generatedGames: [...currentGames, newGame],
                      generationProgress: Math.round(((i + 1) / numberOfGames) * 100)
                    });
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'games.store.ts:216',message:'after patchState',data:{newGamesCount:store.generatedGames().length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                    // #endregion
                  }
                }),
                catchError((error) => {
                  console.error(`Erreur génération jeu ${i + 1}:`, error);
                  // Continue même si un jeu échoue
                  return of(null);
                })
              )
            );
          }

          // Exécuter les observables de manière séquentielle (concat)
          return concat(...games$).pipe(
            toArray(), // Attendre que tous soient terminés
            tap(() => {
              patchState(store, { 
                isGenerating: false,
                generationProgress: 100
              });
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
          );
        })
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

