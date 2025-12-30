import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { BaseRepository } from '../../../shared/repositories/base-repository.service';
import type { Parent } from '../types/parent';

/**
 * Repository pour la gestion des parents
 * Principe SRP : Gère uniquement l'accès aux données parents
 */
@Injectable({
  providedIn: 'root',
})
export class ParentRepository extends BaseRepository<Parent> {
  protected readonly tableName = 'parents';
  protected readonly cacheKey = 'parent-profile';

  /**
   * Vérifie si des enfants sont inscrits pour un parent donné
   */
  checkChildrenEnrolled(parentId: string): Observable<boolean> {
    this.logger.debug('ParentRepository: checkChildrenEnrolled', { parentId });

    return from(
      this.supabaseService.client
        .from('children')
        .select('id')
        .eq('parent_id', parentId)
        .limit(1)
        .maybeSingle()
    ).pipe(
      map(({ data, error }) => {
        if (error && error.code === '42P01') {
          return false;
        }
        return data !== null;
      }),
      catchError(() => {
        this.logger.warn('ParentRepository: Table children does not exist yet');
        return of(false);
      })
    );
  }
}
