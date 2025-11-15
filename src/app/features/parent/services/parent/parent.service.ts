import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { SupabaseService } from '../../../../services/supabase/supabase.service';
import { AuthService } from '../../../../services/auth/auth.service';
import type { Parent, ParentUpdate } from '../../types/parent';
import type { ParentStatus } from '../../store/index';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class ParentService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  /**
   * Récupère le profil parent de l'utilisateur connecté
   */
  getParentProfile(): Observable<Parent | null> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return from(Promise.resolve(null));
    }

    return from(
      this.supabaseService.client
        .from('parents')
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching parent profile:', error);
          return null;
        }
        return data;
      })
    );
  }

  /**
   * Met à jour le profil parent de l'utilisateur connecté
   */
  updateParentProfile(updates: ParentUpdate): Observable<{ parent: Parent | null; error: PostgrestError | null }> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return from(
        Promise.resolve({
          parent: null,
          error: { name: 'PostgrestError', message: 'User not authenticated', code: 'PGRST116', details: null, hint: null } as unknown as PostgrestError,
        })
      );
    }

    return from(
      this.supabaseService.client
        .from('parents')
        .update(updates)
        .eq('profile_id', user.id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        parent: data,
        error: error || null,
      }))
    );
  }

  /**
   * Crée un profil parent pour l'utilisateur connecté
   */
  createParentProfile(profileData: Omit<Parent, 'id' | 'profile_id' | 'created_at' | 'updated_at'>): Observable<{ parent: Parent | null; error: PostgrestError | null }> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return from(
        Promise.resolve({
          parent: null,
          error: { name: 'PostgrestError', message: 'User not authenticated', code: 'PGRST116', details: null, hint: null } as unknown as PostgrestError,
        })
      );
    }

    return from(
      this.supabaseService.client
        .from('parents')
        .insert({
          profile_id: user.id,
          ...profileData,
        })
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        parent: data,
        error: error || null,
      }))
    );
  }

  /**
   * Vérifie si des enfants sont inscrits pour un parent donné
   */
  checkChildrenEnrolled(parentId: string): Observable<boolean> {
    return from(
      this.supabaseService.client
        .from('children')
        .select('id')
        .eq('parent_id', parentId)
        .limit(1)
        .maybeSingle()
    ).pipe(
      map(({ data, error }) => {
        // Si la table n'existe pas, l'erreur sera gérée et on retourne false
        if (error && error.code === '42P01') {
          // Table does not exist
          return false;
        }
        return data !== null;
      }),
      catchError(() => {
        // Si la table n'existe pas encore, retourner false
        return of(false);
      })
    );
  }

  /**
   * Vérifie si le profil parent est complété
   */
  private isProfileComplete(parent: Parent | null): boolean {
    if (!parent) {
      return false;
    }
    // On considère le profil complété si les champs essentiels sont remplis
    return !!(parent.fullname && parent.phone && parent.address && parent.city);
  }

  /**
   * Vérifie le statut du profil parent (profil complété et enfants inscrits)
   */
  checkParentStatus(): Observable<ParentStatus> {
    return this.getParentProfile().pipe(
      switchMap((parent: Parent | null) => {
        if (!parent) {
          return of({ isProfileComplete: false, hasChildrenEnrolled: false });
        }

        const isProfileComplete = this.isProfileComplete(parent);
        const childrenCheck$ = this.checkChildrenEnrolled(parent.id);

        return childrenCheck$.pipe(
          map((hasChildren) => ({
            isProfileComplete,
            hasChildrenEnrolled: hasChildren,
          }))
        );
      }),
      catchError(() => of({ isProfileComplete: false, hasChildrenEnrolled: false }))
    );
  }
}

