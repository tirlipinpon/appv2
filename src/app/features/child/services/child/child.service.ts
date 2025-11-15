import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { SupabaseService } from '../../../../services/supabase/supabase.service';
import { AuthService } from '../../../../services/auth/auth.service';
import { ParentStore } from '../../../parent/store/index';
import type { Child, ChildUpdate } from '../../types/child';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class ChildService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly parentStore = inject(ParentStore);

  /**
   * Récupère l'ID du parent depuis le store ou la base de données
   */
  private getParentId(): Observable<string | null> {
    // Essayer d'abord d'utiliser le parent du store
    const parent = this.parentStore.parent();
    if (parent?.id) {
      return of(parent.id);
    }

    // Sinon, récupérer depuis la base de données
    const user = this.authService.getCurrentUser();
    if (!user) {
      return of(null);
    }

    return from(
      this.supabaseService.client
        .from('parents')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) {
          return null;
        }
        return data.id;
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Récupère tous les enfants du parent connecté
   */
  getChildren(): Observable<Child[]> {
    return this.getParentId().pipe(
      switchMap((parentId) => {
        if (!parentId) {
          return of([]);
        }

        return from(
          this.supabaseService.client
            .from('children')
            .select('*')
            .eq('parent_id', parentId)
            .order('created_at', { ascending: false })
        ).pipe(
          map(({ data, error }) => {
            if (error) {
              // Si la table n'existe pas, retourner un tableau vide
              if (error.code === '42P01') {
                return [];
              }
              console.error('Error fetching children:', error);
              return [];
            }
            return data || [];
          }),
          catchError(() => of([]))
        );
      })
    );
  }

  /**
   * Récupère un enfant spécifique par son ID
   */
  getChildById(childId: string): Observable<Child | null> {
    return from(
      this.supabaseService.client
        .from('children')
        .select('*')
        .eq('id', childId)
        .maybeSingle()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching child by id:', error);
          return null;
        }
        return data;
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Met à jour le profil enfant
   */
  updateChildProfile(childId: string, updates: ChildUpdate): Observable<{ child: Child | null; error: PostgrestError | null }> {
    if (!childId) {
      return of({
        child: null,
        error: { name: 'PostgrestError', message: 'Child ID is required', code: 'PGRST116', details: null, hint: null } as unknown as PostgrestError,
      });
    }

    return from(
      this.supabaseService.client
        .from('children')
        .update(updates)
        .eq('id', childId)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        child: data,
        error: error || null,
      })),
      catchError((error) => of({ child: null, error }))
    );
  }

  /**
   * Crée un profil enfant pour le parent connecté
   */
  createChildProfile(profileData: Omit<Child, 'id' | 'parent_id' | 'created_at' | 'updated_at'>): Observable<{ child: Child | null; error: PostgrestError | null }> {
    return this.getParentId().pipe(
      switchMap((parentId) => {
        if (!parentId) {
          return of({
            child: null,
            error: { name: 'PostgrestError', message: 'Parent not found', code: 'PGRST116', details: null, hint: null } as unknown as PostgrestError,
          });
        }

        return from(
          this.supabaseService.client
            .from('children')
            .insert({
              parent_id: parentId,
              ...profileData,
            })
            .select()
            .single()
        ).pipe(
          map(({ data, error }) => ({
            child: data,
            error: error || null,
          })),
          catchError((error) => of({ child: null, error }))
        );
      })
    );
  }
}

