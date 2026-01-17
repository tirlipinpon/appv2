import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { GamesStatsWrapperService } from '../games-stats/games-stats-wrapper.service';
import { CategoriesCacheService } from '../categories-cache/categories-cache.service';
import { Infrastructure } from '../../../features/teacher/components/infrastructure/infrastructure';

/**
 * Service pour calculer le nombre total de jeux d'une matière
 * Inclut les jeux directs de la matière + les jeux de toutes les catégories
 */
@Injectable({
  providedIn: 'root',
})
export class SubjectTotalGamesService {
  private readonly gamesStatsService = inject(GamesStatsWrapperService);
  private readonly categoriesCacheService = inject(CategoriesCacheService);
  private readonly infrastructure = inject(Infrastructure);

  /**
   * Calcule le nombre total de jeux pour une matière
   * Inclut : jeux directs (subject_id) + jeux des catégories (subject_category_id)
   * @param subjectId - ID de la matière
   * @param skipAssignmentCheck - Si true, skip la vérification d'assignments (optimisation)
   * @returns Observable avec le total de jeux
   */
  getTotalGamesCount(subjectId: string, skipAssignmentCheck = false): Observable<{ total: number; error: unknown | null }> {
    if (!subjectId) {
      return of({ total: 0, error: null });
    }

    // 1. Récupérer les jeux directs de la matière
    const directGames$ = this.infrastructure.getGamesStatsBySubject(subjectId, undefined, skipAssignmentCheck).pipe(
      map(({ total, error }) => ({ directTotal: error ? 0 : total, error: error || null })),
      catchError((error) => of({ directTotal: 0, error }))
    );

    // 2. Récupérer les catégories de la matière
    const categories$ = this.categoriesCacheService.loadCategory(subjectId).pipe(
      map(({ categories, error }) => ({ categories: error ? [] : categories, error: error || null })),
      catchError((error) => of({ categories: [], error }))
    );

    // 3. Combiner les deux et calculer le total
    return forkJoin({
      directGames: directGames$,
      categories: categories$,
    }).pipe(
      switchMap(({ directGames, categories }) => {
        // Si pas de catégories, retourner uniquement les jeux directs
        if (categories.categories.length === 0) {
          return of({
            total: directGames.directTotal,
            error: directGames.error || categories.error || null,
          });
        }

        // 4. Pour chaque catégorie, récupérer le nombre de jeux
        const categoryStats$ = categories.categories.map((category) =>
          this.infrastructure.getGamesStatsByCategory(category.id).pipe(
            map(({ total, error }) => ({ total: error ? 0 : total, error: error || null })),
            catchError((error) => of({ total: 0, error }))
          )
        );

        // Attendre toutes les stats des catégories
        return forkJoin(categoryStats$).pipe(
          map((categoryTotals) => {
            // Calculer la somme des jeux des catégories
            const categoriesTotal = categoryTotals.reduce((sum, cat) => sum + cat.total, 0);

            // Total = jeux directs + jeux des catégories
            const total = directGames.directTotal + categoriesTotal;

            // Gérer les erreurs (si au moins une erreur, on la retourne, sinon null)
            const errors = [
              directGames.error,
              categories.error,
              ...categoryTotals.map((cat) => cat.error),
            ].filter((e) => e !== null);

            return {
              total,
              error: errors.length > 0 ? errors[0] : null,
            };
          })
        );
      }),
      catchError((error) => of({ total: 0, error }))
    );
  }
}
