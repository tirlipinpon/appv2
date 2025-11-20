import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../../shared/services/supabase/supabase.service';
import type { Subject } from '../../types/subject';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class SubjectService {
  private readonly supabaseService = inject(SupabaseService);
  private static readonly DEBUG = true;

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
    const simplify = (s: string) => s
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toLowerCase().replace(/\s+/g, '');
    const normalizeKey = (lvl: string | null | undefined): string => simplify((lvl || '').trim());

    const targetKey = normalizeKey(schoolLevel);
    if (SubjectService.DEBUG) {
      console.log('[SubjectService:getSubjectsForSchoolLevel] params', { schoolId, schoolLevel, targetKey });
    }

    return from(Promise.all([
      client
        .from('school_level_subjects')
        .select('school_level_key, subject:subjects(*)')
        .eq('school_id', schoolId)
        .eq('school_level_key', targetKey),
      client
        .from('subjects')
        .select('*')
        .in('type', ['extra', 'optionnelle'] as unknown as string[])
    ])).pipe(
      map(([linksRes, extrasRes]) => {
        const linkRows = (linksRes.data as { school_level_key: string; subject: Subject }[] | null) || [];
        const filteredLinked = linkRows.map(row => row.subject as Subject);
        const extraSubjects = (extrasRes.data as Subject[] | null) || [];
        const byId = new Map<string, Subject>();
        [...filteredLinked, ...extraSubjects].forEach(s => byId.set(s.id, s));
        const subjects = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
        const error: PostgrestError | null =
          (linksRes.error as PostgrestError | null) ||
          (extrasRes.error as PostgrestError | null) ||
          null;
        if (SubjectService.DEBUG) {
          console.log('[SubjectService:getSubjectsForSchoolLevel] results', {
            linksCount: linkRows.length,
            extrasCount: extraSubjects.length,
            subjectsCount: subjects.length,
            firstSubjects: subjects.slice(0, 5).map(s => ({ id: s.id, name: s.name })),
            error,
          });
        }
        return { subjects, error };
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

  /**
   * Met à jour une matière existante
   */
  updateSubject(id: string, updates: Partial<Omit<Subject, 'id' | 'created_at' | 'updated_at'>>): Observable<{ subject: Subject | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('subjects')
        .update(updates)
        .eq('id', id)
        .select()
        .limit(1)
    ).pipe(
      map(({ data, error }) => {
        const rows = (data as Subject[] | null) || [];
        const logicalError = (rows.length === 0 && !error)
          ? ({ message: 'Aucune ligne mise à jour' } as PostgrestError)
          : null;
        return {
          subject: rows[0] || null,
          error: (error || logicalError) as PostgrestError | null,
        };
      })
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
    const simplify = (s: string) => s
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toLowerCase().replace(/\s+/g, '');
    const school_level_key = simplify(link.school_level || '');

    return from(
      this.supabaseService.client
        .from('school_level_subjects')
        .insert({
          subject_id: link.subject_id,
          school_id: link.school_id,
          school_level: link.school_level,
          school_level_key,
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

