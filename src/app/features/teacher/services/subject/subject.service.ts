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
   * Récupère les matières autorisées pour une école et un niveau:
   * - matières explicitement liées à (school_id, school_level)
   * - + matières 'extra' ou 'optionnelle' disponibles globalement
   */
  getSubjectsForSchoolLevel(schoolId: string, schoolLevel: string): Observable<{ subjects: Subject[]; error: PostgrestError | null }> {
    const client = this.supabaseService.client;
    return from(Promise.all([
      client
        .from('school_level_subjects')
        .select('subject:subjects(*)')
        .eq('school_id', schoolId)
        .eq('school_level', schoolLevel),
      client
        .from('subjects')
        .select('*')
        .in('type', ['extra', 'optionnelle'] as any)
    ])).pipe(
      map(([linked, extras]) => {
        const linkedSubjects = (linked.data || []).map((row: any) => row.subject as Subject);
        const extraSubjects = extras.data || [];
        const byId = new Map<string, Subject>();
        [...linkedSubjects, ...extraSubjects].forEach(s => byId.set(s.id, s));
        const merged = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
        const error = (linked.error as PostgrestError | null) || (extras.error as PostgrestError | null) || null;
        return { subjects: merged, error };
      })
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

