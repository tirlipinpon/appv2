import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseService } from '../../../../services/supabase/supabase.service';
import type { Subject } from '../../../teacher/types/subject';
import type { Child } from '../../types/child';

export interface Enrollment {
  id: string;
  child_id: string;
  school_id: string;
  school_year_id: string | null;
  subject_id: string;
  selected: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class ParentSubjectService {
  private readonly supabase = inject(SupabaseService);

  getChild(childId: string): Observable<{ child: Child | null; error: PostgrestError | null }> {
    return from(
      this.supabase.client
        .from('children')
        .select('*')
        .eq('id', childId)
        .single()
    ).pipe(map(({ data, error }) => ({ child: data as Child | null, error: error || null })));
  }

  getAssignedSubjectIdsForSchoolLevel(schoolId: string, schoolLevel: string): Observable<{ subjectIds: string[]; error: PostgrestError | null }> {
    return from(
      this.supabase.client
        .from('teacher_assignments')
        .select('subject_id')
        .eq('school_id', schoolId)
        .eq('school_level', schoolLevel || '')
        .is('deleted_at', null)
    ).pipe(
      map(({ data, error }) => {
        const ids = ((data as { subject_id: string }[] | null) || []).map(r => r.subject_id);
        return { subjectIds: ids, error: error || null };
      })
    );
  }

  getAvailableSubjectsForChild(child: Child): Observable<{ subjects: Subject[]; error: PostgrestError | null }> {
    const client = this.supabase.client;
    const schoolId = child.school_id;
    const schoolLevel = child.school_level;

    if (!schoolId) {
      return from(Promise.resolve({ subjects: [], error: null }));
    }

    // Utiliser École + Niveau avec clé normalisée (school_level_key) et ajouter extras/optionnelles.
    const simplify = (s: string) =>
      s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, '');
    const levelKey = simplify((schoolLevel || '').trim());

    const linksQuery = levelKey
      ? client.from('school_level_subjects')
          .select('subject:subjects(*)')
          .eq('school_id', schoolId)
          .eq('school_level_key', levelKey)
      : client.from('school_level_subjects')
          .select('subject:subjects(*)')
          .eq('school_id', schoolId);

    // Récupérer aussi les matières assignées par les profs pour cette école et ce niveau
    // D'abord récupérer les subject_id, puis récupérer les subjects
    const teacherAssignmentsQuery = client
      .from('teacher_assignments')
      .select('subject_id')
      .eq('school_id', schoolId)
      .eq('school_level', schoolLevel || '')
      .is('deleted_at', null);

    return from(Promise.all([
      linksQuery,
      client.from('subjects')
        .select('*')
        .in('type', ['extra', 'optionnelle'] as unknown as string[]),
      teacherAssignmentsQuery
    ])).pipe(
      switchMap(async ([links, extras, teacherAssignments]) => {
        const linkRows = (links.data as { subject: Subject }[] | null) || [];
        const linked = linkRows.map(r => r.subject);
        const extra = (extras.data as Subject[] | null) || [];
        
        // Extraire les subject_id des affectations
        const assignmentRows = (teacherAssignments.data as { subject_id: string }[] | null) || [];
        const teacherSubjectIds = [...new Set(assignmentRows.map(r => r.subject_id))];
        
        // Récupérer les subjects correspondants
        let teacherSubjects: Subject[] = [];
        if (teacherSubjectIds.length > 0) {
          const { data: subjectsData, error: subjectsError } = await client
            .from('subjects')
            .select('*')
            .in('id', teacherSubjectIds);
          teacherSubjects = (subjectsData as Subject[] | null) || [];
          if (subjectsError) {
            console.error('Error loading teacher assignment subjects:', subjectsError);
          }
        }
        
        const byId = new Map<string, Subject>();
        [...linked, ...extra, ...teacherSubjects].forEach(s => {
          if (s && s.id) {
            byId.set(s.id, s);
          }
        });
        return {
          subjects: Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)),
          error: (links.error as PostgrestError | null) || (extras.error as PostgrestError | null) || (teacherAssignments.error as PostgrestError | null) || null,
        };
      })
    );
  }

  getEnrollments(childId: string): Observable<{ enrollments: Enrollment[]; error: PostgrestError | null }> {
    return from(
      this.supabase.client
        .from('child_subject_enrollments')
        .select('*')
        .eq('child_id', childId)
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('❌ Error loading enrollments for child', childId, ':', error);
          console.error('Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
        }
        console.log('📊 Enrollments query result for child', childId, ':', { 
          count: data?.length || 0, 
          data, 
          error 
        });
        return { enrollments: (data as Enrollment[] | null) || [], error: error || null };
      })
    );
  }

  upsertEnrollment(enr: { child_id: string; school_id: string; school_year_id?: string | null; subject_id: string; selected: boolean }): Observable<{ enrollment: Enrollment | null; error: PostgrestError | null }> {
    console.log('🔄 [ParentSubjectService] upsertEnrollment called:', enr);
    
    // Approche UPDATE puis INSERT si nécessaire pour éviter les problèmes de contrainte ON CONFLICT
    return from(
      (async () => {
        // D'abord, essayer de mettre à jour l'enrollment existant
        // On cherche par child_id et subject_id (contrainte la plus probable)
        console.log('🔍 [ParentSubjectService] Checking for existing enrollment...');
        const { data: existing, error: selectError } = await this.supabase.client
          .from('child_subject_enrollments')
          .select('*')
          .eq('child_id', enr.child_id)
          .eq('subject_id', enr.subject_id)
          .maybeSingle();

        if (selectError) {
          console.error('❌ [ParentSubjectService] Error checking existing enrollment:', selectError);
          return { data: null, error: selectError };
        }

        if (existing) {
          console.log('📝 [ParentSubjectService] Updating existing enrollment:', existing);
          // Mise à jour de l'enrollment existant
          const { data: updated, error: updateError } = await this.supabase.client
            .from('child_subject_enrollments')
            .update({
              school_id: enr.school_id,
              school_year_id: enr.school_year_id ?? null,
              selected: enr.selected,
            })
            .eq('child_id', enr.child_id)
            .eq('subject_id', enr.subject_id)
            .select('*')
            .single();

          if (updateError) {
            console.error('❌ [ParentSubjectService] Error updating enrollment:', updateError);
          } else {
            console.log('✅ [ParentSubjectService] Enrollment updated:', updated);
          }
          return { data: updated as Enrollment | null, error: updateError };
        } else {
          console.log('➕ [ParentSubjectService] Inserting new enrollment...');
          // Insertion d'un nouvel enrollment
          const { data: inserted, error: insertError } = await this.supabase.client
            .from('child_subject_enrollments')
            .insert({
              child_id: enr.child_id,
              school_id: enr.school_id,
              school_year_id: enr.school_year_id ?? null,
              subject_id: enr.subject_id,
              selected: enr.selected,
            })
            .select('*')
            .single();

          if (insertError) {
            console.error('❌ [ParentSubjectService] Error inserting enrollment:', insertError);
            console.error('Insert error details:', {
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint,
              code: insertError.code
            });
          } else {
            console.log('✅ [ParentSubjectService] Enrollment inserted:', inserted);
          }
          return { data: inserted as Enrollment | null, error: insertError };
        }
      })()
    ).pipe(
      map(({ data, error }) => {
        console.log('📊 [ParentSubjectService] upsertEnrollment result:', { 
          hasEnrollment: !!data, 
          hasError: !!error,
          error: error ? { message: error.message, code: error.code } : null
        });
        return { enrollment: data as Enrollment | null, error: error || null };
      })
    );
  }

  searchSubjects(query: string): Observable<{ subjects: Subject[]; error: PostgrestError | null }> {
    const q = (query || '').trim();
    if (!q || q.length < 2) return from(Promise.resolve({ subjects: [], error: null }));
    return from(
      this.supabase.client
        .from('subjects')
        .select('*')
        .ilike('name', `%${q}%`)
        .order('name', { ascending: true })
        .limit(20)
    ).pipe(map(({ data, error }) => ({ subjects: (data as Subject[] | null) || [], error: error || null })));
  }
}


