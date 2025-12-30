import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { ParentSubjectService, Enrollment, CategoryEnrollment } from '../../features/child/services/subject/parent-subject.service';
import { ErrorSnackbarService } from '../services/snackbar/error-snackbar.service';
import { setStoreError } from '../utils/store-error-helper';

export interface EnrollmentsState {
  enrollmentsByChild: Record<string, Enrollment[]>; // Key: childId
  categoryEnrollmentsByChild: Record<string, CategoryEnrollment[]>; // Key: childId
  isLoading: boolean;
  error: string[];
}

const initialState: EnrollmentsState = {
  enrollmentsByChild: {},
  categoryEnrollmentsByChild: {},
  isLoading: false,
  error: [],
};

export const EnrollmentsStore = signalStore(
  { providedIn: 'root' },
  withDevtools('enrollments'),
  withState(initialState),
  withComputed((store) => ({
    hasError: () => store.error().length > 0,
  })),
  withMethods((store, parentSubjectService = inject(ParentSubjectService), errorSnackbar = inject(ErrorSnackbarService)) => ({
    /**
     * Charge les inscriptions matière pour un enfant
     */
    loadEnrollments: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap((childId) => {
          const cached = store.enrollmentsByChild()[childId];
          
          // Si déjà en cache, retourner immédiatement
          if (cached !== undefined) {
            patchState(store, { isLoading: false });
            return of(null);
          }

          return parentSubjectService.getEnrollments(childId).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des inscriptions';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                patchState(store, { 
                  enrollmentsByChild: { 
                    ...store.enrollmentsByChild(), 
                    [childId]: result.enrollments 
                  },
                  isLoading: false 
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des inscriptions';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Charge les inscriptions catégories pour un enfant
     */
    loadCategoryEnrollments: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: [] })),
        switchMap((childId) => {
          const cached = store.categoryEnrollmentsByChild()[childId];
          
          // Si déjà en cache, retourner immédiatement
          if (cached !== undefined) {
            patchState(store, { isLoading: false });
            return of(null);
          }

          return parentSubjectService.getCategoryEnrollments(childId).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des inscriptions de catégories';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                patchState(store, { 
                  categoryEnrollmentsByChild: { 
                    ...store.categoryEnrollmentsByChild(), 
                    [childId]: result.enrollments 
                  },
                  isLoading: false 
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des inscriptions de catégories';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Crée ou met à jour une inscription matière
     */
    upsertEnrollment: rxMethod<{ child_id: string; school_id: string; school_year_id?: string | null; subject_id: string; selected: boolean }>(
      pipe(
        switchMap((enrollmentData) => {
          const previous = store.enrollmentsByChild()[enrollmentData.child_id] || [];
          
          return parentSubjectService.upsertEnrollment(enrollmentData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la sauvegarde de l\'inscription';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.enrollment) {
                // Mettre à jour le cache
                const existing = previous.findIndex(e => e.subject_id === result.enrollment!.subject_id);
                let updated: Enrollment[];
                if (existing >= 0) {
                  updated = [...previous];
                  updated[existing] = result.enrollment;
                } else {
                  updated = [...previous, result.enrollment];
                }
                
                patchState(store, { 
                  enrollmentsByChild: { 
                    ...store.enrollmentsByChild(), 
                    [enrollmentData.child_id]: updated 
                  }
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la sauvegarde de l\'inscription';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Crée ou met à jour une inscription catégorie
     */
    upsertCategoryEnrollment: rxMethod<{ child_id: string; subject_category_id: string; selected: boolean }>(
      pipe(
        switchMap((enrollmentData) => {
          const previous = store.categoryEnrollmentsByChild()[enrollmentData.child_id] || [];
          
          return parentSubjectService.upsertCategoryEnrollment(enrollmentData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la sauvegarde de l\'inscription de catégorie';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.enrollment) {
                // Mettre à jour le cache
                const existing = previous.findIndex(e => e.subject_category_id === result.enrollment!.subject_category_id);
                let updated: CategoryEnrollment[];
                if (existing >= 0) {
                  updated = [...previous];
                  updated[existing] = result.enrollment;
                } else {
                  updated = [...previous, result.enrollment];
                }
                
                patchState(store, { 
                  categoryEnrollmentsByChild: { 
                    ...store.categoryEnrollmentsByChild(), 
                    [enrollmentData.child_id]: updated 
                  }
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la sauvegarde de l\'inscription de catégorie';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Crée ou met à jour plusieurs inscriptions catégories en batch
     */
    upsertCategoryEnrollmentsBatch: rxMethod<{ child_id: string; subject_category_id: string; selected: boolean }[]>(
      pipe(
        switchMap((enrollments) => {
          if (enrollments.length === 0) {
            return of(null);
          }

          const childId = enrollments[0].child_id;
          const previous = store.categoryEnrollmentsByChild()[childId] || [];
          
          return parentSubjectService.upsertCategoryEnrollmentsBatch(enrollments).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la sauvegarde des inscriptions de catégories';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                patchState(store, { 
                  categoryEnrollmentsByChild: { 
                    ...store.categoryEnrollmentsByChild(), 
                    [childId]: result.enrollments 
                  }
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la sauvegarde des inscriptions de catégories';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    /**
     * Vérifie si un enfant a des inscriptions matière
     */
    hasEnrollments: (childId: string) => {
      const enrollments = store.enrollmentsByChild()[childId];
      return enrollments !== undefined && enrollments.length > 0;
    },

    /**
     * Vérifie si un enfant a des inscriptions catégories
     */
    hasCategoryEnrollments: (childId: string) => {
      const enrollments = store.categoryEnrollmentsByChild()[childId];
      return enrollments !== undefined && enrollments.length > 0;
    },

    /**
     * Efface le cache pour un enfant
     */
    clearChildCache: (childId: string) => {
      const enrollmentsCache = { ...store.enrollmentsByChild() };
      const categoryCache = { ...store.categoryEnrollmentsByChild() };
      delete enrollmentsCache[childId];
      delete categoryCache[childId];
      patchState(store, { 
        enrollmentsByChild: enrollmentsCache,
        categoryEnrollmentsByChild: categoryCache
      });
    },

    /**
     * Efface tous les caches
     */
    clearCache: () => {
      patchState(store, { 
        enrollmentsByChild: {},
        categoryEnrollmentsByChild: {}
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

