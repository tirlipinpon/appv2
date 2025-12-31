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
import { ErrorSnackbarService, setStoreError } from '../../../shared';
import { ImageUploadService } from '../components/games/services/image-upload/image-upload.service';
import type { ImageInteractiveData } from '@shared/games';

export interface GamesState {
  games: Game[];
  gameTypes: GameType[];
  isLoading: boolean;
  error: string[];
  currentSubjectId: string | null; // Track le subjectId courant pour filtrer les jeux
  currentCategoryId: string | null; // Track le categoryId courant pour filtrer les jeux
  // Stats de jeux par matière/catégorie
  statsBySubject: Record<string, { stats: Record<string, number>; total: number }>; // Key: subjectId
  statsByCategory: Record<string, { stats: Record<string, number>; total: number }>; // Key: categoryId
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
  currentSubjectId: null,
  currentCategoryId: null,
  statsBySubject: {},
  statsByCategory: {},
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
  withMethods((store, infrastructure = inject(Infrastructure), errorSnackbar = inject(ErrorSnackbarService), imageUploadService = inject(ImageUploadService)) => ({
    loadGameTypes: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap(() =>
          infrastructure.getGameTypes().pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des types de jeux';
                setStoreError(store, errorSnackbar, errorMessage, false);
              } else {
                patchState(store, { gameTypes: result.gameTypes, isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des types de jeux';
              setStoreError(store, errorSnackbar, errorMessage, false);
              return of(null);
            })
          )
        )
      )
    ),

    loadGamesBySubject: rxMethod<{ subjectId: string; categoryId?: string }>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap(({ subjectId, categoryId }) =>
          infrastructure.getGamesBySubject(subjectId, categoryId).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des jeux';
                setStoreError(store, errorSnackbar, errorMessage, false);
              } else {
                patchState(store, { 
                  games: result.games, 
                  currentSubjectId: subjectId,
                  currentCategoryId: categoryId || null,
                  isLoading: false 
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des jeux';
              setStoreError(store, errorSnackbar, errorMessage, false);
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
                setStoreError(store, errorSnackbar, errorMessage, false);
              } else if (result.game) {
                // Ajouter le jeu s'il correspond au subjectId ou categoryId courant
                const currentSubjectId = store.currentSubjectId();
                const currentCategoryId = store.currentCategoryId();
                if (result.game.subject_id === currentSubjectId || result.game.subject_category_id === currentCategoryId) {
                  patchState(store, {
                    games: [result.game, ...store.games()],
                    isLoading: false,
                  });
                } else {
                  // Le jeu est créé mais ne correspond pas à la matière/sous-catégorie courante, ne pas l'ajouter à la liste
                  patchState(store, { isLoading: false });
                }
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création du jeu';
              setStoreError(store, errorSnackbar, errorMessage, false);
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
                setStoreError(store, errorSnackbar, errorMessage, false);
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
              setStoreError(store, errorSnackbar, errorMessage, false);
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
          const gameToDelete = previous.find((g) => g.id === gameId);
          
          // Vérifier si c'est un jeu "click" avec une image à supprimer
          const isImageInteractive = gameToDelete && gameToDelete.metadata && 
            'image_url' in gameToDelete.metadata && 
            typeof gameToDelete.metadata['image_url'] === 'string' &&
            (gameToDelete.metadata['image_url'] as string).length > 0;
          
          const imageUrl = isImageInteractive 
            ? (gameToDelete.metadata as unknown as ImageInteractiveData).image_url 
            : null;
          
          // Supprimer l'image du storage si elle existe
          const deleteImage$ = imageUrl 
            ? imageUploadService.deleteImage(imageUrl).pipe(
                catchError((error) => {
                  // Ne pas bloquer la suppression du jeu si l'image ne peut pas être supprimée
                  console.warn('Erreur lors de la suppression de l\'image:', error);
                  return of({ success: true, error: null });
                })
              )
            : of({ success: true, error: null });
          
          // Optimistic update: remove locally first
          patchState(store, {
            games: previous.filter((g) => g.id !== gameId),
            isLoading: false,
          });
          
          // Supprimer l'image puis le jeu
          return deleteImage$.pipe(
            switchMap(() => infrastructure.deleteGame(gameId)),
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la suppression du jeu';
                // rollback
                patchState(store, { games: previous });
                setStoreError(store, errorSnackbar, errorMessage, false);
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la suppression du jeu';
              // rollback
              patchState(store, { games: previous });
              setStoreError(store, errorSnackbar, errorMessage, false);
              return of(null);
            })
          );
        })
      )
    ),

    setError: (error: string) => {
      setStoreError(store, errorSnackbar, error, false);
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
                isGenerating: false,
                generationProgress: 0
              });
              setStoreError(store, errorSnackbar, errorMessage);
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
                // Afficher toutes les erreurs
                errors.forEach(err => errorSnackbar.showError(err));
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
              setStoreError(store, errorSnackbar, errorMessage, false);
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

    /**
     * Charge les stats de jeux pour plusieurs matières en batch
     */
    loadStatsBySubjectsBatch: rxMethod<{ subjectIds: string[]; skipAssignmentCheck?: boolean }>(
      pipe(
        switchMap(({ subjectIds, skipAssignmentCheck = false }) => {
          if (subjectIds.length === 0) {
            return of(null);
          }

          // Filtrer les IDs qui ne sont pas déjà en cache
          const cached = store.statsBySubject();
          const idsToLoad = subjectIds.filter(id => !cached[id]);

          if (idsToLoad.length === 0) {
            return of(null);
          }

          return infrastructure.getGamesStatsBySubjectsBatch(idsToLoad, skipAssignmentCheck).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des stats de jeux';
                setStoreError(store, errorSnackbar, errorMessage, false);
              } else {
                const currentStats = store.statsBySubject();
                const newStats: Record<string, { stats: Record<string, number>; total: number }> = { ...currentStats };
                
                result.statsBySubject.forEach((statsData, subjectId) => {
                  newStats[subjectId] = {
                    stats: statsData.stats,
                    total: statsData.total
                  };
                });

                patchState(store, { statsBySubject: newStats });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des stats de jeux';
              setStoreError(store, errorSnackbar, errorMessage, false);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Charge les stats de jeux pour plusieurs catégories en batch
     */
    loadStatsByCategoriesBatch: rxMethod<string[]>(
      pipe(
        switchMap((categoryIds) => {
          if (categoryIds.length === 0) {
            return of(null);
          }

          // Filtrer les IDs qui ne sont pas déjà en cache
          const cached = store.statsByCategory();
          const idsToLoad = categoryIds.filter(id => !cached[id]);

          if (idsToLoad.length === 0) {
            return of(null);
          }

          return infrastructure.getGamesStatsByCategoriesBatch(idsToLoad).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des stats de jeux par catégorie';
                setStoreError(store, errorSnackbar, errorMessage, false);
              } else {
                const currentStats = store.statsByCategory();
                const newStats: Record<string, { stats: Record<string, number>; total: number }> = { ...currentStats };
                
                result.statsByCategory.forEach((statsData, categoryId) => {
                  newStats[categoryId] = {
                    stats: statsData.stats,
                    total: statsData.total
                  };
                });

                patchState(store, { statsByCategory: newStats });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des stats de jeux par catégorie';
              setStoreError(store, errorSnackbar, errorMessage, false);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Efface le cache des stats
     */
    clearStatsCache: () => {
      patchState(store, { 
        statsBySubject: {},
        statsByCategory: {}
      });
    },
  }))
);

