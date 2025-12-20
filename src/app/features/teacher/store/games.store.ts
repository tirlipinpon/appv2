import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of, forkJoin, range } from 'rxjs';
import { toArray, concatMap } from 'rxjs/operators';
import { GameType } from '../types/game-type';
import { Game, GameCreate, GameUpdate } from '../types/game';
import { Infrastructure } from '../components/infrastructure/infrastructure';
import { GeneratedGameWithState, AIGameGenerationRequest, AIRawResponse } from '../types/ai-game-generation';

export interface GamesState {
  games: Game[];
  gameTypes: GameType[];
  isLoading: boolean;
  error: string[];
  // États pour la génération IA
  generatedGames: GeneratedGameWithState[];
  isGenerating: boolean;
  generationProgress: number;
  // Historique des réponses de l'IA pour conversation
  aiResponseHistory: {userPrompt: string, aiResponse: AIRawResponse}[];
}

const initialState: GamesState = {
  games: [],
  gameTypes: [],
  isLoading: false,
  error: [],
  generatedGames: [],
  isGenerating: false,
  generationProgress: 0,
  aiResponseHistory: [],
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
          patchState(store, { isGenerating: true, generationProgress: 0, error: [], generatedGames: [] });
        }),
        switchMap((request) => {
          const numberOfGames = request.numberOfGames;
          
          // Utiliser range et concatMap pour générer les jeux séquentiellement avec un accumulateur
          return range(0, numberOfGames).pipe(
            concatMap((i) => {
              // Calculer les types déjà créés dans cette session (état mis à jour)
              const alreadyCreatedTypeIds = store.generatedGames().map(g => g.game_type_id);
              
              // Calculer les types restants à créer
              let remainingGameTypeIds: string[] | undefined = undefined;
              if (request.selectedGameTypeIds && request.selectedGameTypeIds.length > 0) {
                // Types non encore utilisés
                const unusedTypes = request.selectedGameTypeIds.filter(
                  typeId => !alreadyCreatedTypeIds.includes(typeId)
                );
                
                if (unusedTypes.length > 0) {
                  // Il reste des types non utilisés → les utiliser
                  remainingGameTypeIds = unusedTypes;
                } else {
                  // Tous les types ont été utilisés → réutiliser les types mais en variant
                  // Compter combien de fois chaque type a été utilisé
                  const typeUsageCount = new Map<string, number>();
                  request.selectedGameTypeIds.forEach(typeId => {
                    const count = alreadyCreatedTypeIds.filter(id => id === typeId).length;
                    typeUsageCount.set(typeId, count);
                  });
                  
                  // Trouver le type le moins utilisé
                  let leastUsedType = request.selectedGameTypeIds[0];
                  let minCount = typeUsageCount.get(leastUsedType) || 0;
                  
                  request.selectedGameTypeIds.forEach(typeId => {
                    const count = typeUsageCount.get(typeId) || 0;
                    if (count < minCount) {
                      minCount = count;
                      leastUsedType = typeId;
                    }
                  });
                  
                  // Utiliser le type le moins utilisé
                  remainingGameTypeIds = [leastUsedType];
                }
              }
              
              // Récupérer l'historique actuel
              const currentHistory = store.aiResponseHistory();
              
              return infrastructure.generateSingleGameWithAI({
                ...request,
                remainingGameTypeIds: remainingGameTypeIds // Passer les types restants
              }).pipe(
                tap((result) => {
                  if (result.error) {
                    throw new Error(result.error.message || 'Erreur génération jeu');
                  }
                  
                  if (result.game && result.rawResponse && result.userPrompt) {
                    // Ajouter la nouvelle entrée à l'historique (limité à 10)
                    const updatedHistory = [...currentHistory, {
                      userPrompt: result.userPrompt,
                      aiResponse: result.rawResponse
                    }].slice(-10); // Garder les 10 dernières
                    
                    // Ajouter le jeu généré à la liste
                    const newGame: GeneratedGameWithState = {
                      ...result.game,
                      _tempId: `temp-${Date.now()}-${i}`,
                      _isEditing: true,
                    };
                    
                    const currentGames = store.generatedGames();
                    patchState(store, { 
                      generatedGames: [...currentGames, newGame],
                      aiResponseHistory: updatedHistory,
                      generationProgress: Math.round(((i + 1) / numberOfGames) * 100)
                    });
                  }
                }),
                catchError((error) => {
                  console.error(`Erreur génération jeu ${i + 1}:`, error);
                  // Continue même si un jeu échoue
                  return of(null);
                })
              );
            }),
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
            // On retire uniquement les propriétés spécifiques à l'UI avant l'envoi à l'API
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { _tempId, _isEditing, ...gameData } = game;
            return infrastructure.createGame(gameData as GameCreate);
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
        generationProgress: 0,
        aiResponseHistory: [] 
      });
    },
  }))
);

