import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../../services/supabase/supabase.service';
import type { Subject } from '../../types/subject';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class SubjectService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Récupère toutes les matières
   */
  getSubjects(): Observable<{ subjects: Subject[]; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('subjects')
        .select('*')
        .order('name', { ascending: true })
    ).pipe(
      map(({ data, error }) => ({
        subjects: data || [],
        error: error || null,
      }))
    );
  }

  /**
   * Crée une nouvelle matière
   */
  createSubject(subjectData: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Observable<{ subject: Subject | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('subjects')
        .insert(subjectData)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        subject: data,
        error: error || null,
      }))
    );
  }
}

