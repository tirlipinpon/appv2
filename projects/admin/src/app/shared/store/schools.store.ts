import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { School } from '../../features/teacher/types/school';
import { SchoolService } from '../../features/teacher/services/school/school.service';
import { ErrorSnackbarService } from '../services/snackbar/error-snackbar.service';
import { setStoreError } from '../utils/store-error-helper';

export interface SchoolsState {
  schools: School[];
  schoolsById: Record<string, School>; // Key: schoolId
  isLoading: boolean;
  error: string[];
}

const initialState: SchoolsState = {
  schools: [],
  schoolsById: {},
  isLoading: false,
  error: [],
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
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap(() => {
          // Si déjà chargé, retourner immédiatement
          if (store.schools().length > 0) {
            patchState(store, { isLoading: false });
            return of(null);
          }

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
                  schoolsById: { ...store.schoolsById(), ...schoolsById },
                  isLoading: false 
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
     * Charge une école spécifique par son ID
     */
    loadSchoolById: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap((schoolId) => {
          // Vérifier le cache
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
                const schoolsById = { ...store.schoolsById() };
                schoolsById[schoolId] = result.school;
                
                // Ajouter à la liste si pas déjà présent
                const schools = store.schools();
                const exists = schools.find(s => s.id === schoolId);
                if (!exists) {
                  patchState(store, { 
                    schools: [...schools, result.school],
                    schoolsById,
                    isLoading: false 
                  });
                } else {
                  patchState(store, { schoolsById, isLoading: false });
                }
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
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap((schoolData) =>
          schoolService.createSchool(schoolData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création de l\'école';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.school) {
                const schools = store.schools();
                const schoolsById = { ...store.schoolsById() };
                schoolsById[result.school.id] = result.school;
                patchState(store, { 
                  schools: [...schools, result.school],
                  schoolsById,
                  isLoading: false 
                });
              } else {
                patchState(store, { isLoading: false });
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
    updateSchool: rxMethod<{ id: string; updates: Partial<School> }>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap(({ id, updates }) =>
          schoolService.updateSchool(id, updates).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la mise à jour de l\'école';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.school) {
                const schools = store.schools().map(s => s.id === id ? result.school! : s);
                const schoolsById = { ...store.schoolsById() };
                schoolsById[id] = result.school;
                patchState(store, { 
                  schools,
                  schoolsById,
                  isLoading: false 
                });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la mise à jour de l\'école';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Ajoute une école au cache (méthode utilitaire)
     */
    addSchoolToCache: (school: School) => {
      const schools = store.schools();
      const exists = schools.find(s => s.id === school.id);
      if (!exists) {
        const schoolsById = { ...store.schoolsById() };
        schoolsById[school.id] = school;
        patchState(store, { 
          schools: [...schools, school],
          schoolsById
        });
      }
    },

    /**
     * Définit une erreur (méthode utilitaire)
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
  }))
);

