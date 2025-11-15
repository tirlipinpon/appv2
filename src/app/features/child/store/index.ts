import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { Child, ChildUpdate } from '../types/child';
import { Infrastructure } from '../components/infrastructure/infrastructure';

export interface ChildState {
  children: Child[];
  selectedChild: Child | null;
  isLoading: boolean;
  error: string[];
}

const initialState: ChildState = {
  children: [],
  selectedChild: null,
  isLoading: false,
  error: [],
};

export const ChildStore = signalStore(
  { providedIn: 'root' },
  withDevtools('child'),
  withState(initialState),
  withComputed((store) => ({
    hasChildren: () => store.children().length > 0,
    hasError: () => store.error().length > 0,
    childrenCount: () => store.children().length,
  })),
  withMethods((store, infrastructure = inject(Infrastructure)) => ({
    /**
     * Charge tous les enfants du parent
     */
    loadChildren: rxMethod<void>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap(() =>
          infrastructure.getChildren().pipe(
            tap((children) => {
              patchState(store, { children, isLoading: false });
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des enfants';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of([]);
            })
          )
        )
      )
    ),

    /**
     * Charge un enfant spécifique par son ID
     */
    loadChildById: rxMethod<string>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap((childId) =>
          infrastructure.getChildById(childId).pipe(
            tap((child) => {
              patchState(store, { selectedChild: child, isLoading: false });
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement de l\'enfant';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Met à jour le profil enfant
     */
    updateChildProfile: rxMethod<{ childId: string; updates: ChildUpdate }>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap(({ childId, updates }) => {
          if (!childId) {
            const errorMessage = 'ID de l\'enfant requis pour la mise à jour';
            patchState(store, { error: [errorMessage], isLoading: false });
            return of({ child: null, error: null });
          }

          return infrastructure.updateChildProfile(childId, updates).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la mise à jour du profil enfant';
                patchState(store, { error: [errorMessage], isLoading: false });
              } else if (result.child) {
                // Mettre à jour l'enfant dans la liste
                const children = store.children();
                const updatedChildren = children.map(c => c.id === result.child!.id ? result.child! : c);
                patchState(store, { 
                  children: updatedChildren,
                  selectedChild: result.child,
                  isLoading: false 
                });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la mise à jour du profil enfant';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of({ child: null, error });
            })
          );
        })
      )
    ),

    /**
     * Crée un profil enfant
     */
    createChildProfile: rxMethod<Omit<Child, 'id' | 'parent_id' | 'created_at' | 'updated_at'>>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap((profileData) =>
          infrastructure.createChildProfile(profileData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création du profil enfant';
                patchState(store, { error: [errorMessage], isLoading: false });
              } else if (result.child) {
                // Ajouter le nouvel enfant à la liste
                const children = store.children();
                patchState(store, { 
                  children: [...children, result.child],
                  selectedChild: result.child,
                  isLoading: false 
                });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création du profil enfant';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of({ child: null, error });
            })
          )
        )
      )
    ),

    /**
     * Définit l'enfant sélectionné (méthode utilitaire pour mise à jour manuelle)
     */
    setSelectedChild: (child: Child | null) => {
      patchState(store, { selectedChild: child, isLoading: false });
    },

    /**
     * Définit la liste des enfants (méthode utilitaire pour mise à jour manuelle)
     */
    setChildren: (children: Child[]) => {
      patchState(store, { children, isLoading: false });
    },

    /**
     * Définit une erreur (méthode utilitaire pour mise à jour manuelle)
     */
    setError: (error: string) => {
      patchState(store, { error: [error], isLoading: false });
    },

    /**
     * Efface les erreurs
     */
    clearError: () => {
      patchState(store, { error: [] });
    },
  }))
);

