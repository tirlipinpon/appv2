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
   * Récupère l'ID du parent (qui est l'ID de l'utilisateur auth.users.id)
   * Dans la table children, parent_id fait référence à auth.users.id, pas à parents.id
   */
  private getParentId(): Observable<string | null> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return of(null);
    }
    // parent_id dans children fait référence à auth.users.id directement
    return of(user.id);
  }

  /**
   * Récupère tous les enfants du parent connecté (actifs et inactifs)
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
  createChildProfile(profileData: Omit<Child, 'id' | 'parent_id' | 'created_at' | 'updated_at' | 'is_active'>): Observable<{ child: Child | null; error: PostgrestError | null }> {
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
              is_active: true, // Nouveaux enfants sont actifs par défaut
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

  /**
   * Définit le statut actif d'un enfant (activate/désactivate)
   */
  setChildActiveStatus(childId: string, isActive: boolean): Observable<{ child: Child | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('children')
        .update({ is_active: isActive })
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
}

