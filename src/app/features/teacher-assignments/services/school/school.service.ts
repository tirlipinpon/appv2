import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../../services/supabase/supabase.service';
import type { School, SchoolUpdate } from '../../types/school';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class SchoolService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Récupère toutes les écoles
   */
  getSchools(): Observable<{ schools: School[]; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('schools')
        .select('*')
        .order('name', { ascending: true })
    ).pipe(
      map(({ data, error }) => ({
        schools: data || [],
        error: error || null,
      }))
    );
  }

  /**
   * Récupère une école par ID
   */
  getSchoolById(id: string): Observable<{ school: School | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('schools')
        .select('*')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => ({
        school: data,
        error: error || null,
      }))
    );
  }

  /**
   * Crée une nouvelle école
   */
  createSchool(schoolData: Omit<School, 'id' | 'created_at' | 'updated_at'>): Observable<{ school: School | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('schools')
        .insert(schoolData)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        school: data,
        error: error || null,
      }))
    );
  }

  /**
   * Met à jour une école
   */
  updateSchool(id: string, updates: SchoolUpdate): Observable<{ school: School | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('schools')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        school: data,
        error: error || null,
      }))
    );
  }
}


