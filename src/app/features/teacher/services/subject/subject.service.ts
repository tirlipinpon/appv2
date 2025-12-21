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
    if (SubjectService.DEBUG) {
      console.log('[SubjectService:getSubjectsForSchoolLevel] params', { schoolId, schoolLevel });
    }

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
      map(([linksRes, extrasRes]) => {
        const linkRows = (linksRes.data as { subject: Subject }[] | null) || [];
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

  /**
   * Compte le nombre d'enfants inscrits à une matière pour une école et un niveau donnés
   * Note: Le school_level est stocké dans la table children, pas dans child_subject_enrollments
   */
  countStudentsBySubject(
    subjectId: string,
    schoolId: string | null,
    schoolLevel: string | null
  ): Observable<{ count: number; error: PostgrestError | null }> {
    // Joindre avec la table children pour obtenir le school_level et filtrer
    let query = this.supabaseService.client
      .from('child_subject_enrollments')
      .select('child_id, child:children(school_level, school_id, is_active)')
      .eq('subject_id', subjectId)
      .eq('selected', true);

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }

    // Récupérer les données et filtrer par school_level côté client
    // car Supabase ne permet pas de filtrer directement sur les colonnes de la table jointe
    return from(query).pipe(
      map(({ data, error }) => {
        if (error) {
          return { count: 0, error: error || null };
        }

        if (!data || data.length === 0) {
          return { count: 0, error: null };
        }

        // Filtrer les résultats par school_level et is_active
        // Note: Supabase retourne child comme un objet unique pour une relation one-to-one
        const enrollments = (data as unknown) as Array<{
          child_id: string;
          child: { school_level: string | null; school_id: string | null; is_active: boolean } | null;
        }>;

        const filtered = enrollments.filter(e => {
          const child = e.child;
          
          // Vérifier que l'enfant existe et est actif
          if (!child || !child.is_active) return false;
          
          // Vérifier school_id si spécifié
          if (schoolId && child.school_id !== schoolId) return false;
          
          // Vérifier school_level si spécifié
          if (schoolLevel && child.school_level !== schoolLevel) return false;
          
          return true;
        });

        return {
          count: filtered.length,
          error: null,
        };
      })
    );
  }
}

