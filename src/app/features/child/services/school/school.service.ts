import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { SupabaseService } from '../../../../services/supabase/supabase.service';
import type { School, SchoolCreate } from '../../types/school';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class SchoolService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Récupère toutes les écoles
   */
  getSchools(): Observable<School[]> {
    return from(
      this.supabaseService.client
        .from('schools')
        .select('*')
        .order('name', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching schools:', error);
          return [];
        }
        return data || [];
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Récupère une école par son ID
   */
  getSchoolById(schoolId: string): Observable<School | null> {
    return from(
      this.supabaseService.client
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .maybeSingle()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching school by id:', error);
          return null;
        }
        return data;
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Crée une nouvelle école
   */
  createSchool(schoolData: SchoolCreate): Observable<{ school: School | null; error: PostgrestError | null }> {
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
      })),
      catchError((error) => of({ school: null, error }))
    );
  }
}

