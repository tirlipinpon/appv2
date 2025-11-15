import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { Parent, ParentUpdate } from '../types/parent';
import { Infrastructure } from '../components/infrastructure/infrastructure';

export interface ParentStatus {
  isProfileComplete: boolean;
  hasChildrenEnrolled: boolean;
}

export interface ParentState {
  parent: Parent | null;
  isLoading: boolean;
  error: string[];
  status: ParentStatus | null;
}

const initialState: ParentState = {
  parent: null,
  isLoading: false,
  error: [],
  status: null,
};

export const ParentStore = signalStore(
  { providedIn: 'root' },
  withDevtools('parent'),
  withState(initialState),
  withComputed((store) => ({
    hasParent: () => store.parent() !== null,
    hasError: () => store.error().length > 0,
    isProfileComplete: () => store.status()?.isProfileComplete ?? false,
    hasChildrenEnrolled: () => store.status()?.hasChildrenEnrolled ?? false,
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

    /**
     * Vérifie le statut du profil parent (profil complété et enfants inscrits)
     */
    checkParentStatus: rxMethod<void>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap(() =>
          infrastructure.checkParentStatus().pipe(
            tap((status) => {
              patchState(store, { status, isLoading: false });
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la vérification du statut';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Crée un profil parent
     */
    createParentProfile: rxMethod<Omit<Parent, 'id' | 'profile_id' | 'created_at' | 'updated_at'>>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap((profileData) =>
          infrastructure.createParentProfile(profileData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création du profil parent';
                patchState(store, { error: [errorMessage], isLoading: false });
              } else if (result.parent) {
                patchState(store, { parent: result.parent, isLoading: false });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création du profil parent';
              patchState(store, { error: [errorMessage], isLoading: false });
              return of({ parent: null, error });
            })
          )
        )
      )
    ),
  }))
);


