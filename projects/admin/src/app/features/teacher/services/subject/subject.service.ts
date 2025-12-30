import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from '../../../../shared';
import type { Subject } from '../../types/subject';
import type { PostgrestError } from '@supabase/supabase-js';
import type { Child } from '../../../child/types/child';

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
    schoolLevel: string | null,
    teacherId?: string | null
  ): Observable<{ count: number; error: PostgrestError | null }> {
    // Si teacherId est fourni, utiliser la fonction RPC pour contourner la politique RLS
    // La fonction RPC vérifie si l'enseignant a une affectation et retourne le compte
    if (teacherId) {
      return from(
        this.supabaseService.client.rpc('count_students_by_subject_for_teacher', {
          p_subject_id: subjectId,
          p_school_id: schoolId,
          p_school_level: schoolLevel,
          p_teacher_id: teacherId
        })
      ).pipe(
        map(({ data, error }) => {
          if (error) {
            return { count: 0, error: error || null };
          }
          const count = (data && data[0] && data[0].count) ? Number(data[0].count) : 0;
          return { count, error: null };
        })
      );
    }

    // Sinon, utiliser la méthode normale (pour compatibilité)
    let query = this.supabaseService.client
      .from('child_subject_enrollments')
      .select('child_id, school_id, child:children(school_level, school_id, is_active)')
      .eq('subject_id', subjectId)
      .eq('selected', true);

    return from(query).pipe(
      map(({ data, error }) => {
        if (error) {
          return { count: 0, error: error || null };
        }

        if (!data || data.length === 0) {
          return { count: 0, error: null };
        }

        const enrollments = (data as unknown) as {
          child_id: string;
          school_id: string | null;
          child: { school_level: string | null; school_id: string | null; is_active: boolean } | null;
        }[];

        const activeChildren = enrollments.filter(e => {
          const child = e.child;
          if (!child || !child.is_active) {
            return false;
          }
          if (schoolId) {
            const enrollmentSchoolId = e.school_id;
            const childSchoolId = child.school_id;
            if (enrollmentSchoolId !== schoolId && childSchoolId !== schoolId) {
              return false;
            }
          }
          if (schoolLevel && child.school_level !== schoolLevel) {
            return false;
          }
          return true;
        });

        const uniqueChildIds = new Set(activeChildren.map(e => e.child_id));

        return {
          count: uniqueChildIds.size,
          error: null,
        };
      })
    );
  }

  /**
   * Récupère la liste des enfants inscrits à une matière
   */
  getChildrenBySubject(
    subjectId: string,
    schoolId: string | null = null,
    schoolLevel: string | null = null,
    teacherId?: string | null
  ): Observable<{ children: Child[]; error: PostgrestError | null }> {
    // Si teacherId est fourni, utiliser la fonction RPC pour contourner la politique RLS
    // La fonction RPC vérifie si l'enseignant a une affectation et retourne les enfants
    if (teacherId) {
      return from(
        this.supabaseService.client.rpc('get_children_by_subject_for_teacher', {
          p_subject_id: subjectId,
          p_school_id: schoolId,
          p_school_level: schoolLevel,
          p_teacher_id: teacherId
        })
      ).pipe(
        map(({ data, error }) => {
          if (error) {
            return { children: [], error: error || null };
          }
          return { children: (data as Child[]) || [], error: null };
        })
      );
    }

    // Sinon, utiliser la méthode normale (pour compatibilité)
    let enrollmentsQuery = this.supabaseService.client
      .from('child_subject_enrollments')
      .select('child_id, school_id')
      .eq('subject_id', subjectId)
      .eq('selected', true);

    return from(enrollmentsQuery).pipe(
      switchMap(({ data: enrollments, error: enrollmentsError }) => {
        if (enrollmentsError || !enrollments || enrollments.length === 0) {
          return from(Promise.resolve({ children: [], error: enrollmentsError || null }));
        }

        let filteredEnrollments = enrollments;
        if (schoolId) {
          filteredEnrollments = enrollments.filter((e: any) => e.school_id === schoolId);
        }

        const childIds = filteredEnrollments.map((e: any) => e.child_id);

        if (childIds.length === 0) {
          return from(Promise.resolve({ children: [], error: null }));
        }

        let childrenQuery = this.supabaseService.client
          .from('children')
          .select('*')
          .in('id', childIds)
          .eq('is_active', true);

        if (schoolId) {
          childrenQuery = childrenQuery.eq('school_id', schoolId);
        }

        if (schoolLevel) {
          childrenQuery = childrenQuery.eq('school_level', schoolLevel);
        }

        return from(
          childrenQuery.order('firstname', { ascending: true })
        ).pipe(
          map(({ data: children, error: childrenError }) => {
            if (childrenError || !children) {
              return { children: [], error: childrenError || null };
            }

            const uniqueChildrenMap = new Map<string, Child>();
            children.forEach(child => {
              if (child && child.id && !uniqueChildrenMap.has(child.id)) {
                uniqueChildrenMap.set(child.id, child);
              }
            });

            return {
              children: Array.from(uniqueChildrenMap.values()),
              error: null,
            };
          })
        );
      })
    );
  }
}

