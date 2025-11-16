import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../../services/supabase/supabase.service';
import { AuthService } from '../../../../services/auth/auth.service';
import type { Teacher, TeacherUpdate } from '../../types/teacher';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class TeacherService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  /**
   * Récupère le profil professeur de l'utilisateur connecté
   */
  getTeacherProfile(): Observable<Teacher | null> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return from(Promise.resolve(null));
    }

    return from(
      this.supabaseService.client
        .from('teachers')
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching teacher profile:', error);
          return null;
        }
        return data;
      })
    );
  }

  /**
   * Met à jour le profil professeur de l'utilisateur connecté
   */
  updateTeacherProfile(updates: TeacherUpdate): Observable<{ teacher: Teacher | null; error: PostgrestError | null }> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return from(
        Promise.resolve({
          teacher: null,
          error: { name: 'PostgrestError', message: 'User not authenticated', code: 'PGRST116', details: null, hint: null } as unknown as PostgrestError,
        })
      );
    }

    return from(
      this.supabaseService.client
        .from('teachers')
        .update(updates)
        .eq('profile_id', user.id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        teacher: data,
        error: error || null,
      }))
    );
  }

  /**
   * Crée un profil professeur pour l'utilisateur connecté
   */
  createTeacherProfile(profileData: Omit<Teacher, 'id' | 'profile_id' | 'created_at' | 'updated_at'>): Observable<{ teacher: Teacher | null; error: PostgrestError | null }> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return from(
        Promise.resolve({
          teacher: null,
          error: { name: 'PostgrestError', message: 'User not authenticated', code: 'PGRST116', details: null, hint: null } as unknown as PostgrestError,
        })
      );
    }

    return from(
      this.supabaseService.client
        .from('teachers')
        .insert({
          profile_id: user.id,
          ...profileData,
        })
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        teacher: data,
        error: error || null,
      }))
    );
  }
}

