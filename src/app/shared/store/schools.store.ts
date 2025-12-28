import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { School, SchoolUpdate } from '../../features/teacher/types/school';
import { SchoolService } from '../../features/teacher/services/school/school.service';
import { ErrorSnackbarService } from '../services/snackbar/error-snackbar.service';
import { setStoreError } from '../utils/store-error-helper';

export interface SchoolsState {
  schools: School[];
  schoolsById: Record<string, School>; // Key: schoolId
  isLoading: boolean;
  error: string[];
  isInitialized: boolean;
}

const initialState: SchoolsState = {
  schools: [],
  schoolsById: {},
  isLoading: false,
  error: [],
  isInitialized: false,
};

export const SchoolsStore = signalStore(
  { providedIn: 'root' },
  withDevtools('schools'),
  withState(initialState),
  withComputed((store) => ({
    hasError: () => store.error().length > 0,
    hasSchools: () => store.schools().length > 0,
  })),
  withMethods((store, schoolService = inject(SchoolService), errorSnackbar = inject(ErrorSnackbarService)) => ({
    /**
     * Charge toutes les écoles
     */
    loadSchools: rxMethod<void>(
      pipe(
        switchMap(() => {
          // Si déjà initialisé, retourner immédiatement
          if (store.isInitialized()) {
            return of(null);
          }
          
          patchState(store, { isLoading: true, error: [] });

          return schoolService.getSchools().pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des écoles';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                const schoolsById: Record<string, School> = {};
                result.schools.forEach(school => {
                  schoolsById[school.id] = school;
                });
                patchState(store, { 
                  schools: result.schools,
                  schoolsById,
                  isLoading: false,
                  isInitialized: true
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des écoles';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Charge une école par son ID
     */
    loadSchoolById: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap((schoolId) => {
          // Vérifier si déjà en cache
          const cached = store.schoolsById()[schoolId];
          if (cached) {
            patchState(store, { isLoading: false });
            return of(null);
          }

          return schoolService.getSchoolById(schoolId).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement de l\'école';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.school) {
                patchState(store, { 
                  schools: [...store.schools(), result.school],
                  schoolsById: { 
                    ...store.schoolsById(), 
                    [schoolId]: result.school 
                  },
                  isLoading: false 
                });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement de l\'école';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Crée une nouvelle école
     */
    createSchool: rxMethod<Omit<School, 'id' | 'created_at' | 'updated_at'>>(
      pipe(
        switchMap((schoolData) =>
          schoolService.createSchool(schoolData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création de l\'école';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.school) {
                patchState(store, { 
                  schools: [...store.schools(), result.school],
                  schoolsById: { 
                    ...store.schoolsById(), 
                    [result.school.id]: result.school 
                  }
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création de l\'école';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Met à jour une école
     */
    updateSchool: rxMethod<{ id: string; updates: SchoolUpdate }>(
      pipe(
        switchMap(({ id, updates }) => {
          const previous = store.schools();
          // Optimistic update
          const updatedSchools = previous.map(s => 
            s.id === id ? { ...s, ...updates } : s
          );
          patchState(store, { schools: updatedSchools });
          
          return schoolService.updateSchool(id, updates).pipe(
            tap((result) => {
              if (result.error) {
                // Rollback
                patchState(store, { schools: previous });
                const errorMessage = result.error.message || 'Erreur lors de la mise à jour de l\'école';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.school) {
                // Update with server response
                const finalSchools = previous.map(s => 
                  s.id === id ? result.school! : s
                );
                patchState(store, { 
                  schools: finalSchools,
                  schoolsById: { 
                    ...store.schoolsById(), 
                    [result.school.id]: result.school 
                  }
                });
              }
            }),
            catchError((error) => {
              // Rollback
              patchState(store, { schools: previous });
              const errorMessage = error?.message || 'Erreur lors de la mise à jour de l\'école';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Efface le cache
     */
    clearCache: () => {
      patchState(store, { 
        schools: [],
        schoolsById: {}
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

    /**
     * Ajoute une école au cache (utilitaire pour les créations externes)
     */
    addSchoolToCache: (school: School) => {
      // Vérifier si l'école n'existe pas déjà
      if (!store.schoolsById()[school.id]) {
        patchState(store, {
          schools: [...store.schools(), school],
          schoolsById: {
            ...store.schoolsById(),
            [school.id]: school
          }
        });
      }
    },
  }))
);

