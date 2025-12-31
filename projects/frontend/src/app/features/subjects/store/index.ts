import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { inject } from '@angular/core';
import { pipe, switchMap, catchError, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SubjectsInfrastructure } from '../components/infrastructure/infrastructure';
import { Subject, SubjectCategoryWithProgress } from '../types/subject.types';

interface SubjectsState {
  subjects: Subject[];
  selectedSubjectId: string | null;
  categories: SubjectCategoryWithProgress[];
  loading: boolean;
  error: string | null;
  childId: string | null;
}

const initialState: SubjectsState = {
  subjects: [],
  selectedSubjectId: null,
  categories: [],
  loading: false,
  error: null,
  childId: null,
};

export const SubjectsStore = signalStore(
  { providedIn: 'root' },
  withDevtools('subjects'),
  withState(initialState),
  withComputed((state) => ({
    selectedSubject: () => {
      const id = state.selectedSubjectId();
      if (!id) return null;
      return state.subjects().find(s => s.id === id) || null;
    },
    hasCategories: () => state.categories().length > 0,
  })),
  withMethods((store, infrastructure = inject(SubjectsInfrastructure)) => ({
    setChildId(childId: string | null): void {
      patchState(store, { childId });
    },
    async loadSubjects(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const childId = store.childId();
        const subjects = await infrastructure.loadSubjects(childId);
        patchState(store, { subjects, loading: false });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur lors du chargement des matières';
        patchState(store, { error: errorMessage, loading: false });
      }
    },
    selectSubject: rxMethod<string>(
      pipe(
        tap((subjectId) => patchState(store, { selectedSubjectId: subjectId, loading: true, error: null })),
        switchMap((subjectId) =>
          infrastructure.loadSubjectCategories(subjectId).then(
            (categories) => {
              // Convertir en SubjectCategoryWithProgress
              const categoriesWithProgress: SubjectCategoryWithProgress[] = categories.map(cat => ({
                ...cat,
                progress: undefined, // Sera chargé séparément
              }));
              patchState(store, { categories: categoriesWithProgress, loading: false });
            },
            (error) => {
              patchState(store, { error: error.message, loading: false });
            }
          )
        ),
        catchError((error) => {
          patchState(store, { error: error.message, loading: false });
          return of(null);
        })
      )
    ),
    loadProgress: rxMethod<{ childId: string; categoryIds: string[] }>(
      pipe(
        switchMap(({ childId, categoryIds }) =>
          infrastructure.loadChildProgress(childId, categoryIds).then(
            (progressList) => {
              const categories = store.categories();
              const updatedCategories = categories.map(cat => {
                const progress = progressList.find(p => p.subject_category_id === cat.id);
                return {
                  ...cat,
                  progress: progress ? {
                    completed: progress.completed,
                    stars_count: progress.stars_count,
                    completion_percentage: progress.completion_percentage,
                    last_played_at: progress.last_played_at,
                  } : undefined,
                };
              });
              patchState(store, { categories: updatedCategories });
            }
          )
        ),
        catchError((error) => {
          patchState(store, { error: error.message });
          return of(null);
        })
      )
    ),
  }))
);

