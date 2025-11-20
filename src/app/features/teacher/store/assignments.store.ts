import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { School, SchoolYear } from '../types/school';
import { Subject } from '../types/subject';
import { TeacherAssignment, TeacherAssignmentCreate } from '../types/teacher-assignment';
import { Infrastructure } from '../components/infrastructure/infrastructure';

export interface TeacherAssignmentState {
  schools: School[];
  subjects: Subject[];
  assignments: TeacherAssignment[];
  schoolYears: { id: string; label: string }[];
  isLoading: boolean;
  error: string[];
}

const initialState: TeacherAssignmentState = {
  schools: [],
  subjects: [],
  assignments: [],
  schoolYears: [],
  isLoading: false,
  error: [],
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
  withMethods((store, infrastructure = inject(Infrastructure)) => ({
    loadSchools: rxMethod<void>(
      pipe(
        switchMap(() =>
          infrastructure.getSchools().pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des écoles';
                patchState(store, { error: [errorMessage] });
              } else {
                patchState(store, { schools: result.schools });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des écoles';
              patchState(store, { error: [errorMessage] });
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
                patchState(store, { error: [errorMessage] });
              } else if (result.school) {
                patchState(store, { schools: [...store.schools(), result.school] });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création de l\'école';
              patchState(store, { error: [errorMessage] });
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
                patchState(store, { error: [errorMessage] });
              } else {
                patchState(store, { schoolYears: result.schoolYears });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des années scolaires';
              patchState(store, { error: [errorMessage] });
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
                patchState(store, { error: [errorMessage] });
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
              patchState(store, { error: [errorMessage] });
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
                patchState(store, { error: [errorMessage] });
              } else {
                patchState(store, { subjects: result.subjects });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des matières';
              patchState(store, { error: [errorMessage] });
              return of(null);
            })
          )
        )
      )
    ),

    loadSubjectsForSchoolLevel: rxMethod<{ schoolId: string; schoolLevel: string }>(
      pipe(
        switchMap(({ schoolId, schoolLevel }) =>
          (console.log?.('[TeacherAssignmentStore] loadSubjectsForSchoolLevel params', { schoolId, schoolLevel }),
          infrastructure.getSubjectsForSchoolLevel(schoolId, schoolLevel).pipe(
            tap((result) => {
              console.log?.('[TeacherAssignmentStore] loadSubjectsForSchoolLevel result', {
                error: result.error,
                subjectsCount: result.subjects?.length,
                firstSubjects: (result.subjects || []).slice(0, 5).map(s => ({ id: s.id, name: s.name })),
              });
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors du chargement des matières pour le niveau';
                patchState(store, { error: [errorMessage] });
              } else {
                patchState(store, { subjects: result.subjects });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des matières pour le niveau';
              patchState(store, { error: [errorMessage] });
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
                patchState(store, { error: [errorMessage] });
              } else if (result.subject) {
                patchState(store, { subjects: [...store.subjects(), result.subject] });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la création de la matière';
              patchState(store, { error: [errorMessage] });
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
                patchState(store, { error: [errorMessage] });
              } else {
                patchState(store, { assignments: result.assignments });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors du chargement des affectations';
              patchState(store, { error: [errorMessage] });
              return of(null);
            })
          )
        )
      )
    ),

    createAssignment: rxMethod<TeacherAssignmentCreate>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: [] });
        }),
        switchMap((assignmentData) =>
          infrastructure.createAssignment(assignmentData).pipe(
            tap((result) => {
              if (result.error) {
                const errorMessage = result.error.message || 'Erreur lors de la création de l\'affectation';
                patchState(store, { error: [errorMessage], isLoading: false });
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
              patchState(store, { error: [errorMessage], isLoading: false });
              return of(null);
            })
          )
        )
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
                patchState(store, { assignments: previous, error: [errorMessage] });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Erreur lors de la suppression de l\'affectation';
              // rollback
              patchState(store, { assignments: previous, error: [errorMessage] });
              return of(null);
            })
          );
        })
      )
    ),

    setError: (error: string) => {
      patchState(store, { error: [error], isLoading: false });
    },
    clearError: () => {
      patchState(store, { error: [] });
    },
    clearSubjects: () => {
      patchState(store, { subjects: [] });
    },
  }))
);
