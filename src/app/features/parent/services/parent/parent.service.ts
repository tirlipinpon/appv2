import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../../services/supabase/supabase.service';
import { AuthService } from '../../../../services/auth/auth.service';
import type { Parent, ParentUpdate } from '../../types/parent';
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
}

