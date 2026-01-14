import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { School, SchoolYear } from '../types/school';
import { Subject } from '../types/subject';
import { TeacherAssignment, TeacherAssignmentCreate, TeacherAssignmentUpdate } from '../types/teacher-assignment';
import { Infrastructure } from '../components/infrastructure/infrastructure';
import { ErrorSnackbarService, setStoreError } from '../../../shared';

export interface TeacherAssignmentState {
  schools: School[];
  subjects: Subject[];
  assignments: TeacherAssignment[];
  schoolYears: { id: string; label: string }[];
  isLoading: boolean;
  error: string[];
  isInitialized: boolean;
  pendingConfirmation?: {
    conflictingAssignments: Array<{ id: string; school_level: string }>;
    message: string;
    assignmentData: TeacherAssignmentCreate;
  };
}

const initialState: TeacherAssignmentState = {
  schools: [],
  subjects: [],
  assignments: [],
  schoolYears: [],
  isLoading: false,
  error: [],
  isInitialized: false,
};

export const TeacherAssignmentStore = signalStore(
  { providedIn: 'root' },
  withDevtools('teacher-assignments'),
  withState(initialState),
  withComputed((store) => ({
    hasError: () => store.error().length > 0,
    hasAssignments: () => store.assignments().length > 0,
    hasSchools: () => store.schools().length > 0,
    hasSubjects: () => store.subjects().length > 0,
  })),
  withMethods((store, infrastructure = inject(Infrastructure), errorSnackbar = inject(ErrorSnackbarService)) => ({
    loadSchools: rxMethod<void>(
      pipe(
        switchMap(() =>
          infrastructure.getSchools().pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des écoles';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                patchState(store, { schools: result.schools });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des écoles';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          )
        )
      )
    ),

    createSchool: rxMethod<Omit<School, 'id' | 'created_at' | 'updated_at'>>(
      pipe(
        switchMap((schoolData) =>
          infrastructure.createSchool(schoolData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création de l\'école';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.school) {
                patchState(store, { schools: [...store.schools(), result.school] });
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

    loadSchoolYears: rxMethod<string>(
      pipe(
        switchMap((schoolId) =>
          infrastructure.getSchoolYearsBySchool(schoolId).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des années scolaires';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                patchState(store, { schoolYears: result.schoolYears });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des années scolaires';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          )
        )
      )
    ),

    createSchoolYear: rxMethod<{ school_id: string; label: string; order_index?: number | null; is_active?: boolean }>(
      pipe(
        switchMap((schoolYearData) => {
          // Convert undefined to null/default values to match SchoolYear type
          const data: Omit<SchoolYear, 'id' | 'created_at' | 'updated_at'> = {
            school_id: schoolYearData.school_id,
            label: schoolYearData.label,
            order_index: schoolYearData.order_index ?? null,
            is_active: schoolYearData.is_active ?? true,
          };
          return infrastructure.createSchoolYear(data).pipe(
            switchMap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création de l\'année scolaire';
                setStoreError(store, errorSnackbar, errorMessage);
                return of(null);
              } else if (result.schoolYear) {
                const schoolId = result.schoolYear.school_id;
                if (schoolId) {
                  return infrastructure.getSchoolYearsBySchool(schoolId).pipe(
                    tap((yearsResult) => {
                      if (!yearsResult.error) {
                        patchState(store, { schoolYears: yearsResult.schoolYears });
                      }
                    })
                  );
                }
                return of(null);
              }
              return of(null);
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création de l\'année scolaire';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    loadSubjects: rxMethod<void>(
      pipe(
        switchMap(() =>
          infrastructure.getSubjects().pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des matières';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                patchState(store, { subjects: result.subjects });
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

    loadSubjectsForSchoolLevel: rxMethod<{ schoolId: string; schoolLevel: string }>(
      pipe(
        switchMap(({ schoolId, schoolLevel }) =>
          infrastructure.getSubjectsForSchoolLevel(schoolId, schoolLevel).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des matières pour le niveau';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                patchState(store, { subjects: result.subjects });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des matières pour le niveau';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          ))
        )
      )
    ),

    createSubject: rxMethod<Omit<Subject, 'id' | 'created_at' | 'updated_at'>>(
      pipe(
        switchMap((subjectData) =>
          infrastructure.createSubject(subjectData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création de la matière';
                setStoreError(store, errorSnackbar, errorMessage);
              } else if (result.subject) {
                patchState(store, { subjects: [...store.subjects(), result.subject] });
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

    loadAssignments: rxMethod<string>(
      pipe(
        switchMap((teacherId) =>
          infrastructure.getTeacherAssignments(teacherId).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des affectations';
                setStoreError(store, errorSnackbar, errorMessage);
              } else {
                patchState(store, { assignments: result.assignments, isInitialized: true });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des affectations';
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          )
        )
      )
    ),

    createAssignment: rxMethod<TeacherAssignmentCreate>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [], pendingConfirmation: undefined });
        }),
        switchMap((assignmentData) =>
          infrastructure.createAssignment(assignmentData).pipe(
            tap((result) => {
              if (result.requiresConfirmation) {
                // Demander confirmation à l'utilisateur
                patchState(store, { 
                  isLoading: false,
                  pendingConfirmation: result.requiresConfirmation
                });
              } else if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création de l\'affectation';
                setStoreError(store, errorSnackbar, errorMessage, false);
              } else if (result.assignment) {
                patchState(store, { 
                  assignments: [result.assignment, ...store.assignments()],
                  isLoading: false 
                });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création de l\'affectation';
              setStoreError(store, errorSnackbar, errorMessage, false);
              return of(null);
            })
          )
        )
      )
    ),

    confirmAndCreateAssignment: rxMethod<{
      assignmentData: TeacherAssignmentCreate;
      conflictingAssignmentIds: string[];
    }>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [], pendingConfirmation: undefined });
        }),
        switchMap(({ assignmentData, conflictingAssignmentIds }) =>
          infrastructure.createAssignmentWithConfirmation(assignmentData, conflictingAssignmentIds).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création de l\'affectation';
                setStoreError(store, errorSnackbar, errorMessage, false);
              } else if (result.assignment) {
                patchState(store, { 
                  assignments: [result.assignment, ...store.assignments()],
                  isLoading: false 
                });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création de l\'affectation';
              setStoreError(store, errorSnackbar, errorMessage, false);
              return of(null);
            })
          )
        )
      )
    ),

    clearPendingConfirmation: rxMethod<void>(
      pipe(
        tap(() => {
          patchState(store, { pendingConfirmation: undefined });
        })
      )
    ),

    updateAssignment: rxMethod<{ id: string; updates: TeacherAssignmentUpdate }>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap(({ id, updates }) => {
          const previous = store.assignments();
          // Optimistic update: update locally first
          const updatedAssignments = previous.map(a => 
            a.id === id ? { ...a, ...updates } : a
          );
          patchState(store, { assignments: updatedAssignments });
          
          return infrastructure.updateAssignment(id, updates).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la modification de l\'affectation';
                // rollback
                patchState(store, { assignments: previous });
                setStoreError(store, errorSnackbar, errorMessage, false);
              } else if (result.assignment) {
                // Update with server response
                const finalAssignments = previous.map(a => 
                  a.id === id ? result.assignment! : a
                );
                patchState(store, { 
                  assignments: finalAssignments,
                  isLoading: false 
                });
              } else {
                patchState(store, { isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la modification de l\'affectation';
              // rollback
              patchState(store, { assignments: previous });
              setStoreError(store, errorSnackbar, errorMessage, false);
              return of(null);
            })
          );
        })
      )
    ),

    deleteAssignment: rxMethod<string>(
      pipe(
        switchMap((assignmentId) => {
          const previous = store.assignments();
          // Optimistic update: remove locally first
          patchState(store, {
            assignments: previous.filter(a => a.id !== assignmentId),
          });
          return infrastructure.deleteAssignment(assignmentId).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la suppression de l\'affectation';
                // rollback
                patchState(store, { assignments: previous });
                setStoreError(store, errorSnackbar, errorMessage);
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la suppression de l\'affectation';
              // rollback
              patchState(store, { assignments: previous });
              setStoreError(store, errorSnackbar, errorMessage);
              return of(null);
            })
          );
        })
      )
    ),

    transferAssignment: rxMethod<{ assignmentId: string; newTeacherId: string }>(
      pipe(
        switchMap(({ assignmentId, newTeacherId }) => {
          const previous = store.assignments();
          // Optimistic update: remove locally first (car l'affectation est transférée)
          patchState(store, {
            assignments: previous.filter(a => a.id !== assignmentId),
            isLoading: true,
          });
          return infrastructure.transferAssignment(assignmentId, newTeacherId).pipe(
            tap((result) => {
              if (result.error) {
                // Message d'erreur plus explicite
                const errorMessage = result.error.message || 'Erreur lors du transfert de l\'affectation';
                // rollback
                patchState(store, { assignments: previous });
                setStoreError(store, errorSnackbar, errorMessage, false);
              } else {
                // Transfert réussi
                patchState(store, { error: [], isLoading: false });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du transfert de l\'affectation';
              // rollback
              patchState(store, { assignments: previous });
              setStoreError(store, errorSnackbar, errorMessage, false);
              return of(null);
            })
          );
        })
      )
    ),

    shareAssignment: rxMethod<{ assignmentId: string; newTeacherId: string; teacherId?: string }>(
      pipe(
        switchMap(({ assignmentId, newTeacherId, teacherId }) => {
          return infrastructure.shareAssignment(assignmentId, newTeacherId).pipe(
            switchMap((result) => {
              if (result.error) {
                // Message d'erreur plus explicite
                const errorMessage = result.error.message || 'Erreur lors du partage de l\'affectation';
                setStoreError(store, errorSnackbar, errorMessage, false);
                return of(null);
              }
              
              // Partage réussi : recharger les affectations pour s'assurer de l'état réel
              // Cela permet de récupérer l'affectation réactivée si elle existait déjà
              if (teacherId) {
                // Recharger les affectations via l'infrastructure
                return infrastructure.getTeacherAssignments(teacherId).pipe(
                  tap((reloadResult) => {
                    if (reloadResult.error) {
                      const errorMessage = reloadResult.error.message || 'Erreur lors du rechargement des affectations';
                      setStoreError(store, errorSnackbar, errorMessage, false);
                    } else {
                      patchState(store, { 
                        assignments: reloadResult.assignments, 
                        error: [], 
                        isLoading: false 
                      });
                    }
                  }),
                  switchMap(() => of(null))
                );
              }
              
              patchState(store, { error: [], isLoading: false });
              return of(null);
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du partage de l\'affectation';
              setStoreError(store, errorSnackbar, errorMessage, false);
              return of(null);
            })
          );
        })
      )
    ),

    setError: (error: string) => {
      setStoreError(store, errorSnackbar, error, false);
    },
    clearError: () => {
      patchState(store, { error: [] });
    },
    clearSubjects: () => {
      patchState(store, { subjects: [] });
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
