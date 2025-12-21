import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { Teacher, TeacherUpdate } from '../types/teacher';
import { Infrastructure } from '../components/infrastructure/infrastructure';
import { ErrorSnackbarService } from '../../../shared/services/snackbar/error-snackbar.service';
import { setStoreError } from '../../../shared/utils/store-error-helper';

export interface TeacherState {
  teacher: Teacher | null;
  isLoading: boolean;
  error: string[];
}

const initialState: TeacherState = {
  teacher: null,
  isLoading: false,
  error: [],
};

export const TeacherStore = signalStore(
  { providedIn: 'root' },
  withDevtools('teacher'),
  withState(initialState),
  withComputed((store) => ({
    hasTeacher: () => store.teacher() !== null,
    hasError: () => store.error().length > 0,
  })),
  withMethods((store, infrastructure = inject(Infrastructure), errorSnackbar = inject(ErrorSnackbarService)) => ({
    /**
     * Charge le profil professeur
     */
    loadTeacherProfile: rxMethod<void>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap(() =>
          infrastructure.getTeacherProfile().pipe(
            tap((teacher) => {
              patchState(store, { teacher, isLoading: false });
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement du profil professeur';
              setStoreError(store, errorSnackbar, errorMessage, false);
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Met à jour le profil professeur
     */
    updateTeacherProfile: rxMethod<TeacherUpdate>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap((updates) =>
          infrastructure.updateTeacherProfile(updates).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la mise à jour du profil professeur';
                setStoreError(store, errorSnackbar, errorMessage, false);
              } else if (result.teacher) {
                patchState(store, { teacher: result.teacher, isLoading: false });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la mise à jour du profil professeur';
              setStoreError(store, errorSnackbar, errorMessage, false);
              return of({ teacher: null, error });
            })
          )
        )
      )
    ),

    /**
     * Définit le professeur (méthode utilitaire pour mise à jour manuelle)
     */
    setTeacher: (teacher: Teacher | null) => {
      patchState(store, { teacher, isLoading: false });
    },

    /**
     * Définit une erreur (méthode utilitaire pour mise à jour manuelle)
     */
    setError: (error: string) => {
      setStoreError(store, errorSnackbar, error, false);
    },

    /**
     * Efface les erreurs
     */
    clearError: () => {
      patchState(store, { error: [] });
    },

    /**
     * Crée un profil professeur
     */
    createTeacherProfile: rxMethod<Omit<Teacher, 'id' | 'profile_id' | 'created_at' | 'updated_at'>>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap((profileData) =>
          infrastructure.createTeacherProfile(profileData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création du profil professeur';
                setStoreError(store, errorSnackbar, errorMessage, false);
              } else if (result.teacher) {
                patchState(store, { teacher: result.teacher, isLoading: false });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création du profil professeur';
              setStoreError(store, errorSnackbar, errorMessage, false);
              return of({ teacher: null, error });
            })
          )
        )
      )
    ),
  }))
);

