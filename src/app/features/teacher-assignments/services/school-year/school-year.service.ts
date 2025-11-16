import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../../services/supabase/supabase.service';
import type { SchoolYear } from '../../types/school';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class SchoolYearService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Récupère les années scolaires d'une école
   */
  getSchoolYearsBySchool(schoolId: string): Observable<{ schoolYears: SchoolYear[]; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('school_years')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('order_index', { ascending: true })
    ).pipe(
      map(({ data, error }) => ({
        schoolYears: data || [],
        error: error || null,
      }))
    );
  }

  /**
   * Crée une nouvelle année scolaire
   */
  createSchoolYear(schoolYearData: Omit<SchoolYear, 'id' | 'created_at' | 'updated_at'>): Observable<{ schoolYear: SchoolYear | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('school_years')
        .insert(schoolYearData)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        schoolYear: data,
        error: error || null,
      }))
    );
  }
}


