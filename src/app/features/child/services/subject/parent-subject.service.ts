import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseService } from '../../../../shared/services/supabase/supabase.service';
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

  getAvailableSubjectsForChild(child: Child): Observable<{ subjects: (Subject & { school_level?: string | null })[]; error: PostgrestError | null }> {
    const client = this.supabase.client;
    const schoolId = child.school_id;
    const schoolLevel = child.school_level;

    if (!schoolId) {
      return from(Promise.resolve({ subjects: [], error: null }));
    }

    // Utiliser École + Niveau avec le code belge direct (M1-M3, P1-P6, S1-S6)
    const linksQuery = schoolLevel
      ? client.from('school_level_subjects')
          .select('subject:subjects(*), school_level')
          .eq('school_id', schoolId)
          .eq('school_level', schoolLevel)
      : client.from('school_level_subjects')
          .select('subject:subjects(*), school_level')
          .eq('school_id', schoolId);

    // Récupérer les matières assignées par les profs pour cette école et ce niveau (FILTRER par niveau)
    const teacherAssignmentsQuery = client
      .from('teacher_assignments')
      .select('subject_id, school_level')
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
        const linkRows = (links.data as { subject: Subject; school_level: string }[] | null) || [];
        const linked = linkRows.map(r => ({ ...r.subject, school_level: r.school_level }));
        const extra = (extras.data as Subject[] | null) || [];
        
        // Extraire les subject_id et school_level des affectations (TOUS les niveaux)
        const assignmentRows = (teacherAssignments.data as { subject_id: string; school_level: string }[] | null) || [];
        const teacherSubjectIds = [...new Set(assignmentRows.map(r => r.subject_id))];
        const assignmentLevels = new Map<string, string>();
        assignmentRows.forEach(r => {
          assignmentLevels.set(r.subject_id, r.school_level);
        });
        
        // Récupérer les subjects correspondants
        let teacherSubjects: (Subject & { school_level?: string | null })[] = [];
        if (teacherSubjectIds.length > 0) {
          const { data: subjectsData, error: subjectsError } = await client
            .from('subjects')
            .select('*')
            .in('id', teacherSubjectIds);
          teacherSubjects = ((subjectsData as Subject[] | null) || []).map(s => ({
            ...s,
            school_level: assignmentLevels.get(s.id) || null
          }));
          if (subjectsError) {
            console.error('Error loading teacher assignment subjects:', subjectsError);
          }
        }
        
        // Combiner toutes les matières avec leur niveau
        const byId = new Map<string, Subject & { school_level?: string | null }>();
        
        // D'abord ajouter les matières de school_level_subjects (avec leur niveau)
        linked.forEach(s => {
          if (s && s.id) {
            byId.set(s.id, s);
          }
        });
        
        // Ensuite ajouter les matières des teacher_assignments (avec leur niveau)
        teacherSubjects.forEach(s => {
          if (s && s.id) {
            // Si la matière existe déjà, garder le niveau le plus spécifique (non null)
            const existing = byId.get(s.id);
            if (!existing || !existing.school_level) {
              byId.set(s.id, s);
            } else if (s.school_level) {
              // Si les deux ont un niveau, garder celui qui existe déjà (priorité aux school_level_subjects)
              byId.set(s.id, existing);
            }
          }
        });
        
        // Enfin ajouter les matières extra/optionnelles (sans niveau)
        extra.forEach(e => {
          if (e && e.id && !byId.has(e.id)) {
            byId.set(e.id, { ...e, school_level: null });
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

  searchSubjects(query: string, schoolId?: string | null): Observable<{ subjects: (Subject & { school_level?: string | null })[]; error: PostgrestError | null }> {
    const q = (query || '').trim();
    if (!q || q.length < 2) return from(Promise.resolve({ subjects: [], error: null }));
    
    if (!schoolId) {
      // Si pas d'école, recherche simple sans niveau
      return from(
        this.supabase.client
          .from('subjects')
          .select('*')
          .ilike('name', `%${q}%`)
          .order('name', { ascending: true })
          .limit(20)
      ).pipe(map(({ data, error }) => ({ 
        subjects: ((data as Subject[] | null) || []).map(s => ({ ...s, school_level: null })), 
        error: error || null 
      })));
    }
    
    // Recherche dans toutes les matières de l'école avec leur niveau
    return from(
      Promise.all([
        // Recherche dans school_level_subjects
        this.supabase.client
          .from('school_level_subjects')
          .select('subject:subjects(*), school_level')
          .eq('school_id', schoolId),
        // Recherche dans teacher_assignments (récupérer d'abord les IDs, puis filtrer)
        this.supabase.client
          .from('teacher_assignments')
          .select('subject_id, school_level')
          .eq('school_id', schoolId)
          .is('deleted_at', null),
        // Recherche dans toutes les matières (pour les extra/optionnelles)
        this.supabase.client
          .from('subjects')
          .select('*')
          .in('type', ['extra', 'optionnelle'] as unknown as string[])
      ])
    ).pipe(
      switchMap(async ([linksRes, assignmentsRes, extrasRes]) => {
        const linkRows = (linksRes.data as { subject: Subject; school_level: string }[] | null) || [];
        // Filtrer par nom après récupération
        const linked = linkRows
          .filter(r => r.subject && r.subject.name.toLowerCase().includes(q.toLowerCase()))
          .map(r => ({ ...r.subject, school_level: r.school_level }));
        
        const assignmentRows = (assignmentsRes.data as { subject_id: string; school_level: string }[] | null) || [];
        const assignmentLevels = new Map<string, string>();
        assignmentRows.forEach(r => {
          assignmentLevels.set(r.subject_id, r.school_level);
        });
        
        // Récupérer les subjects correspondants et filtrer par nom
        let assignments: (Subject & { school_level?: string | null })[] = [];
        if (assignmentRows.length > 0) {
          const subjectIds = [...new Set(assignmentRows.map(r => r.subject_id))];
          const { data: subjectsData, error: subjectsError } = await this.supabase.client
            .from('subjects')
            .select('*')
            .in('id', subjectIds);
          
          assignments = ((subjectsData as Subject[] | null) || [])
            .filter(s => s.name.toLowerCase().includes(q.toLowerCase()))
            .map(s => ({
              ...s,
              school_level: assignmentLevels.get(s.id) || null
            }));
          
          if (subjectsError) {
            console.error('Error loading teacher assignment subjects:', subjectsError);
          }
        }
        
        const extras = ((extrasRes.data as Subject[] | null) || [])
          .filter(s => s.name.toLowerCase().includes(q.toLowerCase()));
        
        // Combiner toutes les matières avec leur niveau
        const byId = new Map<string, Subject & { school_level?: string | null }>();
        
        // Ajouter les matières de school_level_subjects
        linked.forEach(s => {
          if (s && s.id) {
            byId.set(s.id, s);
          }
        });
        
        // Ajouter les matières des teacher_assignments (priorité si déjà existante)
        assignments.forEach(s => {
          if (s && s.id) {
            const existing = byId.get(s.id);
            if (!existing || !existing.school_level) {
              byId.set(s.id, s);
            }
          }
        });
        
        // Ajouter les matières extra/optionnelles (sans niveau)
        extras.forEach(e => {
          if (e && e.id && !byId.has(e.id)) {
            byId.set(e.id, { ...e, school_level: null });
          }
        });
        
        const subjects = Array.from(byId.values())
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 20);
        
        const error = (linksRes.error as PostgrestError | null) || 
                     (assignmentsRes.error as PostgrestError | null) || 
                     (extrasRes.error as PostgrestError | null) || 
                     null;
        
        return { subjects, error };
      })
    );
  }

  getSubjectsByIds(subjectIds: string[], schoolId?: string | null): Observable<{ subjects: (Subject & { school_level?: string | null })[]; error: PostgrestError | null }> {
    if (!subjectIds || subjectIds.length === 0) {
      return from(Promise.resolve({ subjects: [], error: null }));
    }
    
    if (!schoolId) {
      // Si pas d'école, charger simplement les matières sans niveau
      return from(
        this.supabase.client
          .from('subjects')
          .select('*')
          .in('id', subjectIds)
      ).pipe(
        map(({ data, error }) => ({
          subjects: ((data as Subject[] | null) || []).map(s => ({ ...s, school_level: null })),
          error: error || null
        }))
      );
    }
    
    // Si on a une école, récupérer aussi le niveau depuis school_level_subjects et teacher_assignments
    return from(
      Promise.all([
        this.supabase.client
          .from('subjects')
          .select('*')
          .in('id', subjectIds),
        this.supabase.client
          .from('school_level_subjects')
          .select('subject_id, school_level')
          .eq('school_id', schoolId)
          .in('subject_id', subjectIds),
        this.supabase.client
          .from('teacher_assignments')
          .select('subject_id, school_level')
          .eq('school_id', schoolId)
          .in('subject_id', subjectIds)
          .is('deleted_at', null)
      ])
    ).pipe(
      map(([subjectsRes, linksRes, assignmentsRes]) => {
        const subjects = (subjectsRes.data as Subject[] | null) || [];
        const links = (linksRes.data as { subject_id: string; school_level: string }[] | null) || [];
        const assignments = (assignmentsRes.data as { subject_id: string; school_level: string }[] | null) || [];
        
        // Créer une map des niveaux (priorité aux school_level_subjects)
        const levelMap = new Map<string, string>();
        links.forEach(l => levelMap.set(l.subject_id, l.school_level));
        assignments.forEach(a => {
          if (!levelMap.has(a.subject_id)) {
            levelMap.set(a.subject_id, a.school_level);
          }
        });
        
        const enrichedSubjects = subjects.map(s => ({
          ...s,
          school_level: levelMap.get(s.id) || null
        }));
        
        const error = (subjectsRes.error as PostgrestError | null) || 
                     (linksRes.error as PostgrestError | null) || 
                     (assignmentsRes.error as PostgrestError | null) || 
                     null;
        
        return { subjects: enrichedSubjects, error };
      })
    );
  }
}


