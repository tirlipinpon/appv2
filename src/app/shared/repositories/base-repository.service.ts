import { inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { AuthCoreService } from '../../core/auth/core/auth-core.service';
import { CacheService } from '../services/cache/cache.service';
import { LoggerService } from '../services/logging/logger.service';
import type { PostgrestError } from '@supabase/supabase-js';

export interface RepositoryResult<T> {
  data: T | null;
  error: PostgrestError | null;
}

/**
 * Classe abstraite de base pour tous les repositories
 * Principe DIP : Abstraction pour la couche de données
 * Principe OCP : Extensible par héritage
 */
export abstract class BaseRepository<T> {
  protected readonly supabaseService = inject(SupabaseService);
  protected readonly authCoreService = inject(AuthCoreService);
  protected readonly cacheService = inject(CacheService);
  protected readonly logger = inject(LoggerService);

  protected abstract readonly tableName: string;
  protected abstract readonly cacheKey: string;

  /**
   * Récupère un enregistrement par ID
   */
  getById(id: string): Observable<T | null> {
    this.logger.debug(`${this.tableName}: getById`, { id });
    
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .maybeSingle()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          this.logger.error(`${this.tableName}: Error fetching by ID`, error);
          return null;
        }
        return data;
      })
    );
  }

  /**
   * Récupère un enregistrement par profile_id avec cache
   */
  getByProfileId(): Observable<T | null> {
    const user = this.authCoreService.getCurrentUser();
    if (!user) {
      this.logger.warn(`${this.tableName}: No user authenticated`);
      return from(Promise.resolve(null));
    }

    this.logger.debug(`${this.tableName}: getByProfileId`, { userId: user.id });

    return this.cacheService.getOrLoad(
      this.cacheKey,
      () => from(
        this.supabaseService.client
          .from(this.tableName)
          .select('*')
          .eq('profile_id', user.id)
          .maybeSingle()
      ).pipe(
        map(({ data, error }) => {
          if (error) {
            this.logger.error(`${this.tableName}: Error fetching by profile_id`, error);
            return null;
          }
          return data;
        })
      ),
      user.id
    );
  }

  /**
   * Crée un nouvel enregistrement
   */
  create(data: Partial<T>): Observable<RepositoryResult<T>> {
    const user = this.authCoreService.getCurrentUser();
    if (!user) {
      this.logger.warn(`${this.tableName}: No user authenticated for create`);
      return from(Promise.resolve({
        data: null,
        error: { 
          message: 'User not authenticated', 
          code: 'PGRST116', 
          details: null, 
          hint: null 
        } as unknown as PostgrestError,
      }));
    }

    this.logger.debug(`${this.tableName}: create`, { data });

    return from(
      this.supabaseService.client
        .from(this.tableName)
        .insert({
          profile_id: user.id,
          ...data,
        })
        .select()
        .single()
    ).pipe(
      map(({ data: result, error }) => {
        if (!error && result) {
          this.cacheService.set(this.cacheKey, result, user.id);
        }
        return { data: result, error: error || null };
      })
    );
  }

  /**
   * Met à jour un enregistrement par profile_id
   */
  update(updates: Partial<T>): Observable<RepositoryResult<T>> {
    const user = this.authCoreService.getCurrentUser();
    if (!user) {
      this.logger.warn(`${this.tableName}: No user authenticated for update`);
      return from(Promise.resolve({
        data: null,
        error: { 
          message: 'User not authenticated', 
          code: 'PGRST116', 
          details: null, 
          hint: null 
        } as unknown as PostgrestError,
      }));
    }

    this.logger.debug(`${this.tableName}: update`, { updates });

    return from(
      this.supabaseService.client
        .from(this.tableName)
        .update(updates)
        .eq('profile_id', user.id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (!error && data) {
          this.cacheService.set(this.cacheKey, data, user.id);
        } else if (error) {
          this.cacheService.delete(this.cacheKey, user.id);
        }
        return { data, error: error || null };
      })
    );
  }

  /**
   * Supprime un enregistrement par ID
   */
  delete(id: string): Observable<{ success: boolean; error: PostgrestError | null }> {
    const user = this.authCoreService.getCurrentUser();
    this.logger.debug(`${this.tableName}: delete`, { id });

    return from(
      this.supabaseService.client
        .from(this.tableName)
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (!error && user) {
          this.cacheService.delete(this.cacheKey, user.id);
        }
        return { success: !error, error: error || null };
      })
    );
  }

  /**
   * Vide le cache pour ce repository
   */
  clearCache(): void {
    const user = this.authCoreService.getCurrentUser();
    if (user) {
      this.cacheService.delete(this.cacheKey, user.id);
    }
  }

  /**
   * Récupère la valeur actuelle du cache sans faire d'appel API
   */
  getCachedValue(): T | null | undefined {
    const user = this.authCoreService.getCurrentUser();
    if (!user) {
      return null;
    }
    return this.cacheService.get(this.cacheKey);
  }
}
