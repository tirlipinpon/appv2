import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of, forkJoin } from 'rxjs';
import { SubjectCategory, SubjectCategoryCreate, SubjectCategoryUpdate } from '../../features/teacher/types/subject';
import { SubjectCategoryService } from '../../features/teacher/services/subject-category/subject-category.service';
import { ErrorSnackbarService } from '../services/snackbar/error-snackbar.service';
import { setStoreError } from '../utils/store-error-helper';

export interface SubjectCategoriesState {
  categoriesBySubject: Record<string, SubjectCategory[]>; // Key: subjectId
  noCategoriesSubjects: Set<string>; // Sujets sans catégories (pour éviter de recharger)
  isLoading: boolean;
  error: string[];
}

const initialState: SubjectCategoriesState = {
  categoriesBySubject: {},
  noCategoriesSubjects: new Set<string>(),
  isLoading: false,
  error: [],
};

export const SubjectCategoriesStore = signalStore(
  { providedIn: 'root' },
  withDevtools('subject-categories'),
  withState(initialState),
  withComputed((store) => ({
    hasError: () => store.error().length > 0,
  })),
  withMethods((store, categoryService = inject(SubjectCategoryService), errorSnackbar = inject(ErrorSnackbarService)) => ({
    /**
     * Charge les catégories pour une matière
     */
    loadCategoriesForSubject: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap((subjectId) => {
          const cached = store.categoriesBySubject()[subjectId];
          const noCategories = store.noCategoriesSubjects().has(subjectId);
          
          // Si déjà en cache, retourner immédiatement
          if (cached !== undefined || noCategories) {
            patchState(store, { isLoading: false });
            return of(null);
          }

          return categoryService.getCategoriesBySubject(subjectId).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des catégories';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                const currentCache = store.categoriesBySubject();
                const newNoCategories = new Set(store.noCategoriesSubjects());
                
                if (result.categories.length > 0) {
                  patchState(store, { 
                    categoriesBySubject: { 
                      ...currentCache, 
                      [subjectId]: result.categories 
                    },
                    isLoading: false 
                  });
                } else {
                  newNoCategories.add(subjectId);
                  patchState(store, { 
                    noCategoriesSubjects: newNoCategories,
                    isLoading: false 
                  });
                }
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des catégories';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Charge les catégories pour plusieurs matières en batch
     */
    loadCategoriesBatch: rxMethod<string[]>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap((subjectIds) => {
          if (subjectIds.length === 0) {
            patchState(store, { isLoading: false });
            return of(null);
          }

          // Filtrer les IDs qui ne sont pas déjà en cache
          const cached = store.categoriesBySubject();
          const noCategories = store.noCategoriesSubjects();
          const idsToLoad = subjectIds.filter(id => 
            cached[id] === undefined && !noCategories.has(id)
          );

          if (idsToLoad.length === 0) {
            patchState(store, { isLoading: false });
            return of(null);
          }

          // Charger toutes les catégories en parallèle
          const categoryObservables = idsToLoad.map(subjectId =>
            categoryService.getCategoriesBySubject(subjectId)
          );

          return forkJoin(categoryObservables).pipe(
            tap((results) => {
              const currentCache = store.categoriesBySubject();
              const newCache = { ...currentCache };
              const newNoCategories = new Set(store.noCategoriesSubjects());
              
              idsToLoad.forEach((subjectId, index) => {
                const result = results[index];
                if (!result.error && result.categories && result.categories.length > 0) {
                  newCache[subjectId] = result.categories;
                } else if (!result.error) {
                  newNoCategories.add(subjectId);
                }
              });

              patchState(store, { 
                categoriesBySubject: newCache,
                noCategoriesSubjects: newNoCategories,
                isLoading: false 
              });
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des catégories en batch';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Crée une nouvelle catégorie
     */
    createCategory: rxMethod<SubjectCategoryCreate>(
      pipe(
        switchMap((categoryData) =>
          categoryService.createCategory(categoryData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création de la catégorie';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.category) {
                const currentCache = store.categoriesBySubject();
                const subjectId = result.category.subject_id;
                const existingCategories = currentCache[subjectId] || [];
                
                patchState(store, { 
                  categoriesBySubject: { 
                    ...currentCache, 
                    [subjectId]: [...existingCategories, result.category] 
                  },
                  noCategoriesSubjects: (() => {
                    const newSet = new Set(store.noCategoriesSubjects());
                    newSet.delete(subjectId);
                    return newSet;
                  })()
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création de la catégorie';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Met à jour une catégorie
     */
    updateCategory: rxMethod<{ id: string; updates: SubjectCategoryUpdate }>(
      pipe(
        switchMap(({ id, updates }) => {
          const currentCache = store.categoriesBySubject();
          // Trouver la catégorie dans le cache
          let found = false;
          const updatedCache: Record<string, SubjectCategory[]> = {};
          
          Object.keys(currentCache).forEach(subjectId => {
            const categories = currentCache[subjectId];
            const updatedCategories = categories.map(cat => {
              if (cat.id === id) {
                found = true;
                return { ...cat, ...updates };
              }
              return cat;
            });
            updatedCache[subjectId] = updatedCategories;
          });

          if (found) {
            patchState(store, { categoriesBySubject: updatedCache });
          }

          return categoryService.updateCategory(id, updates).pipe(
            tap((result) => {
              if (result.error) {
                // Rollback
                patchState(store, { categoriesBySubject: currentCache });
                const errorMessage = result.error.message || 'Erreur lors de la mise à jour de la catégorie';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.category) {
                // Update with server response
                const finalCache: Record<string, SubjectCategory[]> = {};
                Object.keys(currentCache).forEach(subjectId => {
                  const categories = currentCache[subjectId];
                  finalCache[subjectId] = categories.map(cat => 
                    cat.id === id ? result.category! : cat
                  );
                });
                patchState(store, { categoriesBySubject: finalCache });
              }
            }),
            catchError((error) => {
              // Rollback
              patchState(store, { categoriesBySubject: currentCache });
              const errorMessage = error?.message || 'Erreur lors de la mise à jour de la catégorie';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Supprime une catégorie
     */
    deleteCategory: rxMethod<string>(
      pipe(
        switchMap((categoryId) => {
          const currentCache = store.categoriesBySubject();
          // Trouver la catégorie dans le cache
          let foundCategory: SubjectCategory | null = null;
          const updatedCache: Record<string, SubjectCategory[]> = {};
          
          Object.keys(currentCache).forEach(subjectId => {
            const categories = currentCache[subjectId];
            const filtered = categories.filter(cat => {
              if (cat.id === categoryId) {
                foundCategory = cat;
                return false;
              }
              return true;
            });
            updatedCache[subjectId] = filtered;
          });

          if (foundCategory) {
            patchState(store, { categoriesBySubject: updatedCache });
          }

          return categoryService.deleteCategory(categoryId).pipe(
            tap((result) => {
              if (result.error) {
                // Rollback
                patchState(store, { categoriesBySubject: currentCache });
                const errorMessage = result.error.message || 'Erreur lors de la suppression de la catégorie';
                setStoreError(store, errorSnackbar, errorMessage);
              }
            }),
            catchError((error) => {
              // Rollback
              patchState(store, { categoriesBySubject: currentCache });
              const errorMessage = error?.message || 'Erreur lors de la suppression de la catégorie';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Vérifie si une matière a des catégories
     */
    hasCategories: (subjectId: string) => {
      const categories = store.categoriesBySubject()[subjectId];
      return categories !== undefined && categories.length > 0;
    },

    /**
     * Efface le cache pour une matière
     */
    clearSubjectCache: (subjectId: string) => {
      const currentCache = store.categoriesBySubject();
      const newCache = { ...currentCache };
      delete newCache[subjectId];
      const newNoCategories = new Set(store.noCategoriesSubjects());
      newNoCategories.delete(subjectId);
      patchState(store, { 
        categoriesBySubject: newCache,
        noCategoriesSubjects: newNoCategories
      });
    },

    /**
     * Efface tous les caches
     */
    clearCache: () => {
      patchState(store, { 
        categoriesBySubject: {},
        noCategoriesSubjects: new Set()
      });
    },

    /**
     * Efface les erreurs
     */
    clearError: () => {
      patchState(store, { error: [] });
    },
  }))
);

