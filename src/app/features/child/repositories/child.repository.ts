import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseRepository } from '../../../shared/repositories/base-repository.service';
import { SupabaseService } from '../../../shared/services/supabase/supabase.service';
import { AuthCoreService } from '../../../core/auth/core/auth-core.service';
import { CacheService } from '../../../shared/services/cache/cache.service';
import { LoggerService } from '../../../shared/services/logging/logger.service';
import type { Child } from '../types/child';

/**
 * Repository pour la gestion des enfants
 * Principe SRP : Gère uniquement l'accès aux données enfants
 */
@Injectable({
  providedIn: 'root',
})
export class ChildRepository extends BaseRepository<Child> {
  constructor() {
    super('children', 'children-list', {
      supabaseService: inject(SupabaseService),
      authCoreService: inject(AuthCoreService),
      cacheService: inject(CacheService),
      logger: inject(LoggerService),
    });
  }

  /**
   * Récupère tous les enfants d'un parent
   */
  getAllByParentId(parentId: string): Observable<Child[]> {
    this.logger.debug('ChildRepository: getAllByParentId', { parentId });
    
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
        .eq('parent_id', parentId)
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          this.logger.error('ChildRepository: Error fetching children', error);
          return [];
        }
        return data || [];
      })
    );
  }

  /**
   * Récupère tous les enfants du parent connecté
   */
  getAllForCurrentUser(): Observable<Child[]> {
    const user = this.authCoreService.getCurrentUser();
    if (!user) {
      this.logger.warn('ChildRepository: No user authenticated');
      return from(Promise.resolve([]));
    }

    return this.cacheService.getOrLoad<Child[]>(
      `${this.cacheKey}-all`,
      () => from(
        this.supabaseService.client
          .from(this.tableName)
          .select('*')
          .eq('parent_id', user.id)
          .order('created_at', { ascending: false })
      ).pipe(
        map(({ data, error }) => {
          if (error) {
            this.logger.error('ChildRepository: Error fetching all children', error);
            return [];
          }
          return data || [];
        })
      ),
      user.id
    ).pipe(
      map(data => data ?? [])
    );
  }

  /**
   * Met à jour un enfant spécifique par son ID
   */
  updateById(childId: string, updates: Partial<Child>): Observable<{ data: Child | null; error: unknown }> {
    this.logger.debug('ChildRepository: updateById', { childId, updates });
    
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .update(updates)
        .eq('id', childId)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (!error) {
          const user = this.authCoreService.getCurrentUser();
          if (user) {
            this.cacheService.delete(`${this.cacheKey}-all`, user.id);
          }
        }
        return { data, error: error || null };
      })
    );
  }
}
