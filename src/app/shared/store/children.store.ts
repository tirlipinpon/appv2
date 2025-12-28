import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { Child, ChildUpdate } from '../../features/child/types/child';
import { ChildService } from '../../features/child/services/child/child.service';
import { ErrorSnackbarService } from '../services/snackbar/error-snackbar.service';
import { setStoreError } from '../utils/store-error-helper';

export interface ChildrenState {
  children: Child[];
  currentChild: Child | null;
  childrenById: Record<string, Child>; // Key: childId
  isLoading: boolean;
  error: string[];
  isInitialized: boolean;
}

const initialState: ChildrenState = {
  children: [],
  currentChild: null,
  childrenById: {},
  isLoading: false,
  error: [],
  isInitialized: false,
};

export const ChildrenStore = signalStore(
  { providedIn: 'root' },
  withDevtools('children'),
  withState(initialState),
  withComputed((store) => ({
    hasError: () => store.error().length > 0,
    hasChildren: () => store.children().length > 0,
    hasCurrentChild: () => store.currentChild() !== null,
  })),
  withMethods((store, childService = inject(ChildService), errorSnackbar = inject(ErrorSnackbarService)) => ({
    /**
     * Charge tous les enfants du parent connecté
     */
    loadChildren: rxMethod<void>(
      pipe(
        switchMap(() => {
          // Si déjà initialisé, retourner immédiatement
          if (store.isInitialized()) {
            return of(null);
          }
          
          patchState(store, { isLoading: true, error: [] });
          return childService.getChildren().pipe(
            tap((children) => {
              const childrenById: Record<string, Child> = {};
              children.forEach(child => {
                childrenById[child.id] = child;
              });
              patchState(store, { 
                children,
                childrenById,
                isLoading: false,
                isInitialized: true
              });
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des enfants';
              setStoreError(store, errorSnackbar, errorMessage);
              return of([]);
            })
          );
        })
      )
    ),

    /**
     * Charge un enfant spécifique par son ID
     */
    loadChildById: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap((childId) => {
          // Vérifier si déjà en cache
          const cached = store.childrenById()[childId];
          if (cached) {
            patchState(store, { currentChild: cached, isLoading: false });
            return of(null);
          }

          return childService.getChildById(childId).pipe(
            tap((child) => {
              if (child) {
                patchState(store, { 
                  currentChild: child,
                  childrenById: { 
                    ...store.childrenById(), 
                    [childId]: child 
                  },
                  isLoading: false 
                });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement de l\'enfant';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Crée un nouvel enfant
     */
    createChild: rxMethod<Omit<Child, 'id' | 'parent_id' | 'created_at' | 'updated_at' | 'is_active'>>(
      pipe(
        switchMap((childData) =>
          childService.createChildProfile(childData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création de l\'enfant';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.child) {
                patchState(store, { 
                  children: [result.child, ...store.children()],
                  childrenById: { 
                    ...store.childrenById(), 
                    [result.child.id]: result.child 
                  }
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création de l\'enfant';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Met à jour un enfant
     */
    updateChild: rxMethod<{ childId: string; updates: ChildUpdate }>(
      pipe(
        switchMap(({ childId, updates }) => {
          const previous = store.children();
          // Optimistic update
          const updatedChildren = previous.map(c => 
            c.id === childId ? { ...c, ...updates } : c
          );
          patchState(store, { children: updatedChildren });
          
          return childService.updateChildProfile(childId, updates).pipe(
            tap((result) => {
              if (result.error) {
                // Rollback
                patchState(store, { children: previous });
                const errorMessage = result.error.message || 'Erreur lors de la mise à jour de l\'enfant';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.child) {
                // Update with server response
                const finalChildren = previous.map(c => 
                  c.id === childId ? result.child! : c
                );
                patchState(store, { 
                  children: finalChildren,
                  childrenById: { 
                    ...store.childrenById(), 
                    [result.child.id]: result.child 
                  },
                  currentChild: store.currentChild()?.id === childId ? result.child : store.currentChild()
                });
              }
            }),
            catchError((error) => {
              // Rollback
              patchState(store, { children: previous });
              const errorMessage = error?.message || 'Erreur lors de la mise à jour de l\'enfant';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Définit le statut actif d'un enfant
     */
    setActiveStatus: rxMethod<{ childId: string; isActive: boolean }>(
      pipe(
        switchMap(({ childId, isActive }) => {
          const previous = store.children();
          // Optimistic update
          const updatedChildren = previous.map(c => 
            c.id === childId ? { ...c, is_active: isActive } : c
          );
          patchState(store, { children: updatedChildren });
          
          return childService.setChildActiveStatus(childId, isActive).pipe(
            tap((result) => {
              if (result.error) {
                // Rollback
                patchState(store, { children: previous });
                const errorMessage = result.error.message || 'Erreur lors de la modification du statut';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.child) {
                // Update with server response
                const finalChildren = previous.map(c => 
                  c.id === childId ? result.child! : c
                );
                patchState(store, { 
                  children: finalChildren,
                  childrenById: { 
                    ...store.childrenById(), 
                    [result.child.id]: result.child 
                  }
                });
              }
            }),
            catchError((error) => {
              // Rollback
              patchState(store, { children: previous });
              const errorMessage = error?.message || 'Erreur lors de la modification du statut';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Définit l'enfant courant
     */
    setCurrentChild: (child: Child | null) => {
      patchState(store, { currentChild: child });
    },

    /**
     * Efface le cache
     */
    clearCache: () => {
      patchState(store, { 
        children: [],
        currentChild: null,
        childrenById: {}
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

