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
        .in('type', ['extra', 'optionnelle'] as unknown as string[])
    ])).pipe(
      map(([linked, extras]) => {
        const linkedRows = (linked.data as { subject: Subject }[] | null) || [];
        const linkedSubjects = linkedRows.map((row) => row.subject as Subject);
        const extraSubjects = (extras.data as Subject[] | null) || [];
        const byId = new Map<string, Subject>();
        [...linkedSubjects, ...extraSubjects].forEach(s => byId.set(s.id, s));
        const merged = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
        const error: PostgrestError | null = (linked.error as PostgrestError | null) || (extras.error as PostgrestError | null) || null;
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

  // ===== Liens matière <-> (école, niveau) =====
  getSubjectLinks(subjectId: string): Observable<{ links: { id: string; school_id: string; school_level: string; required: boolean }[]; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('school_level_subjects')
        .select('id, school_id, school_level, required')
        .eq('subject_id', subjectId)
        .order('school_id', { ascending: true })
    ).pipe(
      map(({ data, error }) => ({
        links: (data as { id: string; school_id: string; school_level: string; required: boolean }[] | null) || [],
        error: error || null,
      }))
    );
  }

  addSubjectLink(link: { subject_id: string; school_id: string; school_level: string; required?: boolean }): Observable<{ link: { id: string; subject_id: string; school_id: string; school_level: string; required: boolean } | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('school_level_subjects')
        .insert({
          subject_id: link.subject_id,
          school_id: link.school_id,
          school_level: link.school_level,
          required: link.required ?? true,
        })
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        link: data as { id: string; subject_id: string; school_id: string; school_level: string; required: boolean } | null,
        error: error || null,
      }))
    );
  }

  deleteSubjectLink(linkId: string): Observable<{ error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('school_level_subjects')
        .delete()
        .eq('id', linkId)
    ).pipe(
      map(({ error }) => ({
        error: error || null,
      }))
    );
  }
}

