import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { Parent, ParentUpdate } from '../types/parent';
import { Infrastructure } from '../components/infrastructure/infrastructure';

export interface ParentState {
  parent: Parent | null;
  isLoading: boolean;
  error: string[];
}

const initialState: ParentState = {
  parent: null,
  isLoading: false,
  error: [],
};

export const ParentStore = signalStore(
  { providedIn: 'root' },
  withDevtools('parent'),
  withState(initialState),
  withComputed((store) => ({
    hasParent: () => store.parent() !== null,
    hasError: () => store.error().length > 0,
  })),
  withMethods((store, infrastructure = inject(Infrastructure)) => ({
    /**
     * Charge le profil parent
     */
    loadParentProfile: rxMethod<void>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap(() =>
          infrastructure.getParentProfile().pipe(
            tap((parent) => {
              patchState(store, { parent, isLoading: false });
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement du profil parent';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Met à jour le profil parent
     */
    updateParentProfile: rxMethod<ParentUpdate>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap((updates) =>
          infrastructure.updateParentProfile(updates).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la mise à jour du profil parent';
                patchState(store, { error: [errorMessage], isLoading: false });
              } else if (result.parent) {
                patchState(store, { parent: result.parent, isLoading: false });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la mise à jour du profil parent';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of({ parent: null, error });
            })
          )
        )
      )
    ),

    /**
     * Définit le parent (méthode utilitaire pour mise à jour manuelle)
     */
    setParent: (parent: Parent | null) => {
      patchState(store, { parent, isLoading: false });
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


