import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { Subject } from '../../features/teacher/types/subject';
import { SubjectService } from '../../features/teacher/services/subject/subject.service';
import { ErrorSnackbarService } from '../services/snackbar/error-snackbar.service';
import { setStoreError } from '../utils/store-error-helper';

export interface SubjectsState {
  allSubjects: Subject[];
  subjectsBySchoolLevel: Record<string, Subject[]>; // Key: `${schoolId}:${schoolLevel}`
  subjectsByIds: Record<string, Subject>; // Key: subjectId
  searchResults: Subject[];
  isLoading: boolean;
  error: string[];
}

const initialState: SubjectsState = {
  allSubjects: [],
  subjectsBySchoolLevel: {},
  subjectsByIds: {},
  searchResults: [],
  isLoading: false,
  error: [],
};

export const SubjectsStore = signalStore(
  { providedIn: 'root' },
  withDevtools('subjects'),
  withState(initialState),
  withComputed((store) => ({
    hasError: () => store.error().length > 0,
    hasSubjects: () => store.allSubjects().length > 0,
    hasSearchResults: () => store.searchResults().length > 0,
  })),
  withMethods((store, subjectService = inject(SubjectService), errorSnackbar = inject(ErrorSnackbarService)) => ({
    /**
     * Charge toutes les matières
     */
    loadAllSubjects: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap(() =>
          subjectService.getSubjects().pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des matières';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                const subjectsByIds: Record<string, Subject> = {};
                result.subjects.forEach(subject => {
                  subjectsByIds[subject.id] = subject;
                });
                patchState(store, { 
                  allSubjects: result.subjects,
                  subjectsByIds: { ...store.subjectsByIds(), ...subjectsByIds },
                  isLoading: false 
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des matières';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Charge les matières pour une école et un niveau spécifiques
     */
    loadSubjectsForSchoolLevel: rxMethod<{ schoolId: string; schoolLevel: string }>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap(({ schoolId, schoolLevel }) => {
          const cacheKey = `${schoolId}:${schoolLevel}`;
          const cached = store.subjectsBySchoolLevel()[cacheKey];
          
          // Si déjà en cache, retourner immédiatement
          if (cached && cached.length > 0) {
            patchState(store, { isLoading: false });
            return of(null);
          }

          return subjectService.getSubjectsForSchoolLevel(schoolId, schoolLevel).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des matières pour le niveau';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                const subjectsByIds: Record<string, Subject> = {};
                result.subjects.forEach(subject => {
                  subjectsByIds[subject.id] = subject;
                });
                patchState(store, { 
                  subjectsBySchoolLevel: { 
                    ...store.subjectsBySchoolLevel(), 
                    [cacheKey]: result.subjects 
                  },
                  subjectsByIds: { ...store.subjectsByIds(), ...subjectsByIds },
                  isLoading: false 
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des matières pour le niveau';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Charge les matières par leurs IDs
     */
    loadSubjectsByIds: rxMethod<string[]>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap((subjectIds) => {
          // Filtrer les IDs déjà en cache
          const cached = store.subjectsByIds();
          const missingIds = subjectIds.filter(id => !cached[id]);
          
          // Si tous sont en cache, retourner immédiatement
          if (missingIds.length === 0) {
            patchState(store, { isLoading: false });
            return of(null);
          }

          // Pour l'instant, on charge toutes les matières si on a besoin de certaines
          // TODO: Créer une méthode dans SubjectService pour charger par IDs
          return subjectService.getSubjects().pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des matières';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                const subjectsByIds: Record<string, Subject> = {};
                result.subjects.forEach(subject => {
                  subjectsByIds[subject.id] = subject;
                });
                patchState(store, { 
                  subjectsByIds: { ...store.subjectsByIds(), ...subjectsByIds },
                  isLoading: false 
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des matières';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Crée une nouvelle matière
     */
    createSubject: rxMethod<Omit<Subject, 'id' | 'created_at' | 'updated_at'>>(
      pipe(
        switchMap((subjectData) =>
          subjectService.createSubject(subjectData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création de la matière';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.subject) {
                patchState(store, { 
                  allSubjects: [...store.allSubjects(), result.subject],
                  subjectsByIds: { 
                    ...store.subjectsByIds(), 
                    [result.subject.id]: result.subject 
                  }
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création de la matière';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          )
        )
      )
    ),

    /**
     * Met à jour une matière
     */
    updateSubject: rxMethod<{ id: string; updates: Partial<Omit<Subject, 'id' | 'created_at' | 'updated_at'>> }>(
      pipe(
        switchMap(({ id, updates }) => {
          const previous = store.allSubjects();
          // Optimistic update
          const updatedSubjects = previous.map(s => 
            s.id === id ? { ...s, ...updates } : s
          );
          patchState(store, { allSubjects: updatedSubjects });
          
          return subjectService.updateSubject(id, updates).pipe(
            tap((result) => {
              if (result.error) {
                // Rollback
                patchState(store, { allSubjects: previous });
                const errorMessage = result.error.message || 'Erreur lors de la mise à jour de la matière';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.subject) {
                // Update with server response
                const finalSubjects = previous.map(s => 
                  s.id === id ? result.subject! : s
                );
                patchState(store, { 
                  allSubjects: finalSubjects,
                  subjectsByIds: { 
                    ...store.subjectsByIds(), 
                    [result.subject.id]: result.subject 
                  }
                });
              }
            }),
            catchError((error) => {
              // Rollback
              patchState(store, { allSubjects: previous });
              const errorMessage = error?.message || 'Erreur lors de la mise à jour de la matière';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Efface le cache pour une école/niveau
     */
    clearSchoolLevelCache: (schoolId: string, schoolLevel: string) => {
      const cacheKey = `${schoolId}:${schoolLevel}`;
      const cache = { ...store.subjectsBySchoolLevel() };
      delete cache[cacheKey];
      patchState(store, { subjectsBySchoolLevel: cache });
    },

    /**
     * Efface tous les caches
     */
    clearCache: () => {
      patchState(store, { 
        subjectsBySchoolLevel: {},
        subjectsByIds: {},
        searchResults: []
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

