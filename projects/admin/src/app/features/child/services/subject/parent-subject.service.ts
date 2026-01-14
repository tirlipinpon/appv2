import { Injectable, inject } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseService } from '../../../../shared';
import type { Subject, SubjectCategory } from '../../../teacher/types/subject';
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

export interface CategoryEnrollment {
  id: string;
  child_id: string;
  subject_category_id: string;
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
          .select('subject:subjects(*), school_level, created_at')
          .eq('school_id', schoolId)
          .eq('school_level', schoolLevel)
      : client.from('school_level_subjects')
          .select('subject:subjects(*), school_level, created_at')
          .eq('school_id', schoolId);

    // Récupérer les matières assignées par les profs pour cette école et ce niveau (FILTRER par niveau)
    const teacherAssignmentsQuery = client
      .from('teacher_assignments')
      .select('subject_id, school_level, updated_at, teacher_id, id')
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
        const linkRows = (links.data as { subject: Subject; school_level: string; created_at?: string }[] | null) || [];
        const linked = linkRows.map(r => ({ 
          ...r.subject, 
          school_level: r.school_level,
          _link_created_at: r.created_at || new Date(0).toISOString()
        }));
        const extra = (extras.data as Subject[] | null) || [];
        
        // Extraire les subject_id et school_level des affectations (TOUS les niveaux)
        const assignmentRows = (teacherAssignments.data as { subject_id: string; school_level: string; updated_at?: string; teacher_id: string; id: string }[] | null) || [];
        const teacherSubjectIds = [...new Set(assignmentRows.map(r => r.subject_id))];
        const assignmentLevels = new Map<string, { level: string; updated_at: string }>();
        assignmentRows.forEach(r => {
          const existing = assignmentLevels.get(r.subject_id);
          const updatedAt = r.updated_at || new Date().toISOString();
          // Garder la dernière affectation mise à jour (par updated_at)
          if (!existing || (existing.updated_at < updatedAt)) {
            assignmentLevels.set(r.subject_id, { 
              level: r.school_level, 
              updated_at: updatedAt 
            });
          }
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
            school_level: assignmentLevels.get(s.id)?.level || null
          }));
          if (subjectsError) {
            console.error('Error loading teacher assignment subjects:', subjectsError);
          }
        }
        
        // Combiner toutes les matières avec leur niveau
        const byId = new Map<string, Subject & { school_level?: string | null; _source_updated_at?: string }>();
        
        // D'abord ajouter les matières de school_level_subjects (avec leur niveau et created_at)
        linked.forEach(s => {
          if (s && s.id) {
            byId.set(s.id, {
              ...s,
              _source_updated_at: (s as any)._link_created_at
            });
          }
        });
        
        // Ensuite ajouter les matières des teacher_assignments (avec leur niveau)
        teacherSubjects.forEach(s => {
          if (s && s.id) {
            const existing = byId.get(s.id);
            const assignmentUpdatedAt = assignmentLevels.get(s.id)?.updated_at || new Date(0).toISOString();
            const existingUpdatedAt = existing?._source_updated_at || new Date(0).toISOString();
            
            // Si pas de matière existante, ou si l'affectation est plus récente, utiliser l'affectation
            if (!existing || assignmentUpdatedAt > existingUpdatedAt) {
              byId.set(s.id, {
                ...s,
                _source_updated_at: assignmentUpdatedAt
              });
            } else if (!existing.school_level && s.school_level) {
              // Si la matière existante n'a pas de niveau mais l'affectation en a un, utiliser l'affectation
              byId.set(s.id, {
                ...s,
                _source_updated_at: assignmentUpdatedAt
              });
            }
          }
        });
        
        // Enfin ajouter les matières extra/optionnelles (sans niveau)
        extra.forEach(e => {
          if (e && e.id && !byId.has(e.id)) {
            byId.set(e.id, { ...e, school_level: null });
          }
        });
        
        // Nettoyer les propriétés temporaires avant de retourner
        const cleanedSubjects = Array.from(byId.values())
          .map((subject: any) => {
            const { _source_updated_at, _link_created_at, ...rest } = subject;
            return rest;
        });
        
        return {
          subjects: cleanedSubjects.sort((a, b) => a.name.localeCompare(b.name)),
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
        return { enrollments: (data as Enrollment[] | null) || [], error: error || null };
      })
    );
  }

  upsertEnrollment(enr: { child_id: string; school_id: string; school_year_id?: string | null; subject_id: string; selected: boolean }): Observable<{ enrollment: Enrollment | null; error: PostgrestError | null }> {
    // Approche UPDATE puis INSERT si nécessaire pour éviter les problèmes de contrainte ON CONFLICT
    return from(
      (async () => {
        // D'abord, récupérer tous les enrollments existants (gérer les doublons)
        const { data: existingList, error: selectError } = await this.supabase.client
          .from('child_subject_enrollments')
          .select('*')
          .eq('child_id', enr.child_id)
          .eq('subject_id', enr.subject_id);

        if (selectError) {
          console.error('❌ [ParentSubjectService] Error checking existing enrollment:', selectError);
          return { data: null, error: selectError };
        }

        const existing = existingList && existingList.length > 0 ? existingList[0] : null;
        const hasDuplicates = existingList && existingList.length > 1;

        if (hasDuplicates) {
          console.warn(`⚠️ [ParentSubjectService] Found ${existingList.length} duplicate enrollments for child ${enr.child_id} and subject ${enr.subject_id}. Cleaning up duplicates...`);
          
          // Supprimer tous les doublons sauf le premier
          const duplicateIds = existingList.slice(1).map(e => e.id);
          if (duplicateIds.length > 0) {
            const { error: deleteError } = await this.supabase.client
              .from('child_subject_enrollments')
              .delete()
              .in('id', duplicateIds);
            
            if (deleteError) {
              console.error('❌ [ParentSubjectService] Error deleting duplicates:', deleteError);
            }
          }
        }

        if (existing) {
          // Mise à jour de l'enrollment existant
          const { data: updated, error: updateError } = await this.supabase.client
            .from('child_subject_enrollments')
            .update({
              school_id: enr.school_id,
              school_year_id: enr.school_year_id ?? null,
              selected: enr.selected,
            })
            .eq('id', existing.id)
            .select('*')
            .single();

          if (updateError) {
            console.error('❌ [ParentSubjectService] Error updating enrollment:', updateError);
          }
          return { data: updated as Enrollment | null, error: updateError };
        } else {
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
          }
          return { data: inserted as Enrollment | null, error: insertError };
        }
      })()
    ).pipe(
      map(({ data, error }) => {
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
          .select('subject:subjects(*), school_level, created_at')
          .eq('school_id', schoolId),
        // Recherche dans teacher_assignments (récupérer d'abord les IDs, puis filtrer)
        this.supabase.client
          .from('teacher_assignments')
          .select('subject_id, school_level, updated_at')
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
        const linkRows = (linksRes.data as { subject: Subject; school_level: string; created_at?: string }[] | null) || [];
        // Filtrer par nom après récupération et stocker created_at pour comparaison
        const linked = linkRows
          .filter(r => r.subject && r.subject.name.toLowerCase().includes(q.toLowerCase()))
          .map(r => ({ 
            ...r.subject, 
            school_level: r.school_level,
            _link_created_at: r.created_at || new Date(0).toISOString() // Pour comparaison avec updated_at
          }));
        
        const assignmentRows = (assignmentsRes.data as { subject_id: string; school_level: string; updated_at?: string }[] | null) || [];
        const assignmentLevels = new Map<string, { level: string; updated_at: string }>();
        assignmentRows.forEach(r => {
          const existing = assignmentLevels.get(r.subject_id);
          const updatedAt = r.updated_at || new Date().toISOString();
          // Garder la dernière affectation mise à jour (par updated_at)
          if (!existing || (existing.updated_at < updatedAt)) {
            assignmentLevels.set(r.subject_id, { 
              level: r.school_level, 
              updated_at: updatedAt 
            });
          }
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
              school_level: assignmentLevels.get(s.id)?.level || null
            }));
          
          if (subjectsError) {
            console.error('Error loading teacher assignment subjects:', subjectsError);
          }
        }
        
        const extras = ((extrasRes.data as Subject[] | null) || [])
          .filter(s => s.name.toLowerCase().includes(q.toLowerCase()));
        
        // Combiner toutes les matières avec leur niveau
        const byId = new Map<string, Subject & { school_level?: string | null; _source_updated_at?: string }>();
        
        // Ajouter les matières de school_level_subjects avec leur created_at
        linked.forEach(s => {
          if (s && s.id) {
            byId.set(s.id, {
              ...s,
              _source_updated_at: (s as any)._link_created_at
            });
          }
        });
        
        // Ajouter les matières des teacher_assignments (priorité si plus récente)
        assignments.forEach(s => {
          if (s && s.id) {
            const existing = byId.get(s.id);
            const assignmentUpdatedAt = assignmentLevels.get(s.id)?.updated_at || new Date(0).toISOString();
            const existingUpdatedAt = existing?._source_updated_at || new Date(0).toISOString();
            
            // Si pas de matière existante, ou si l'affectation est plus récente, utiliser l'affectation
            if (!existing || assignmentUpdatedAt > existingUpdatedAt) {
              byId.set(s.id, {
                ...s,
                _source_updated_at: assignmentUpdatedAt
              });
            }
          }
        });
        
        // Ajouter les matières extra/optionnelles (sans niveau)
        extras.forEach(e => {
          if (e && e.id && !byId.has(e.id)) {
            byId.set(e.id, { ...e, school_level: null });
          }
        });
        
        // Nettoyer les propriétés temporaires avant de retourner
        const subjects = Array.from(byId.values())
          .map(({ _source_updated_at, ...rest }) => rest)
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
          .select('subject_id, school_level, updated_at')
          .eq('school_id', schoolId)
          .in('subject_id', subjectIds)
          .is('deleted_at', null)
      ])
    ).pipe(
      map(([subjectsRes, linksRes, assignmentsRes]) => {
        const subjects = (subjectsRes.data as Subject[] | null) || [];
        const links = (linksRes.data as { subject_id: string; school_level: string; created_at?: string }[] | null) || [];
        const assignments = (assignmentsRes.data as { subject_id: string; school_level: string; updated_at?: string }[] | null) || [];
        
        // Créer une map des niveaux (priorité à la source la plus récente)
        const levelMap = new Map<string, { level: string; updated_at: string; source: 'link' | 'assignment' }>();
        links.forEach(l => {
          const linkCreatedAt = l.created_at || new Date(0).toISOString();
          levelMap.set(l.subject_id, { level: l.school_level, updated_at: linkCreatedAt, source: 'link' });
        });
        assignments.forEach(a => {
          const existing = levelMap.get(a.subject_id);
          const updatedAt = a.updated_at || new Date(0).toISOString();
          // Si pas de niveau depuis school_level_subjects, ou si l'affectation est plus récente, utiliser l'affectation
          if (!existing || updatedAt > existing.updated_at) {
            levelMap.set(a.subject_id, { level: a.school_level, updated_at: updatedAt, source: 'assignment' });
          }
        });
        
        const enrichedSubjects = subjects.map(s => ({
          ...s,
          school_level: levelMap.get(s.id)?.level || null
        }));
        
        const error = (subjectsRes.error as PostgrestError | null) || 
                     (linksRes.error as PostgrestError | null) || 
                     (assignmentsRes.error as PostgrestError | null) || 
                     null;
        
        return { subjects: enrichedSubjects, error };
      })
    );
  }

  // ===== Gestion des sous-catégories =====
  getSubjectCategories(subjectId: string): Observable<{ categories: SubjectCategory[]; error: PostgrestError | null }> {
    return from(
      this.supabase.client
        .from('subject_categories')
        .select('*')
        .eq('subject_id', subjectId)
        .order('name', { ascending: true })
    ).pipe(
      map(({ data, error }) => ({
        categories: (data as SubjectCategory[] | null) || [],
        error: error || null,
      }))
    );
  }

  /**
   * Charge les catégories de plusieurs matières en une seule requête (optimisation batch)
   */
  getSubjectCategoriesBatch(subjectIds: string[]): Observable<{ categoriesBySubject: Map<string, SubjectCategory[]>; error: PostgrestError | null }> {
    if (subjectIds.length === 0) {
      return from(Promise.resolve({ categoriesBySubject: new Map(), error: null }));
    }

    return from(
      this.supabase.client
        .from('subject_categories')
        .select('*')
        .in('subject_id', subjectIds)
        .order('name', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        const categoriesBySubject = new Map<string, SubjectCategory[]>();
        
        if (data) {
          const categories = data as SubjectCategory[];
          categories.forEach(category => {
            const existing = categoriesBySubject.get(category.subject_id) || [];
            existing.push(category);
            categoriesBySubject.set(category.subject_id, existing);
          });
          
          // S'assurer que toutes les matières ont au moins un tableau vide
          subjectIds.forEach(subjectId => {
            if (!categoriesBySubject.has(subjectId)) {
              categoriesBySubject.set(subjectId, []);
            }
          });
        }
        
        return {
          categoriesBySubject,
          error: error || null,
        };
      })
    );
  }

  getCategoryEnrollments(childId: string): Observable<{ enrollments: CategoryEnrollment[]; error: PostgrestError | null }> {
    return from(
      this.supabase.client
        .from('child_subject_category_enrollments')
        .select('*')
        .eq('child_id', childId)
    ).pipe(
      map(({ data, error }) => ({
        enrollments: (data as CategoryEnrollment[] | null) || [],
        error: error || null,
      }))
    );
  }

  upsertCategoryEnrollment(enr: { child_id: string; subject_category_id: string; selected: boolean }): Observable<{ enrollment: CategoryEnrollment | null; error: PostgrestError | null }> {
    return from(
      (async () => {
        // Vérifier si l'enrollment existe déjà
        const { data: existing, error: selectError } = await this.supabase.client
          .from('child_subject_category_enrollments')
          .select('*')
          .eq('child_id', enr.child_id)
          .eq('subject_category_id', enr.subject_category_id)
          .maybeSingle();

        if (selectError) {
          return { data: null, error: selectError };
        }

        if (existing) {
          // Mise à jour de l'enrollment existant
          const { data: updated, error: updateError } = await this.supabase.client
            .from('child_subject_category_enrollments')
            .update({ selected: enr.selected })
            .eq('child_id', enr.child_id)
            .eq('subject_category_id', enr.subject_category_id)
            .select('*')
            .single();

          return { data: updated as CategoryEnrollment | null, error: updateError };
        } else {
          // Insertion d'un nouvel enrollment
          const { data: inserted, error: insertError } = await this.supabase.client
            .from('child_subject_category_enrollments')
            .insert({
              child_id: enr.child_id,
              subject_category_id: enr.subject_category_id,
              selected: enr.selected,
            })
            .select('*')
            .single();

          return { data: inserted as CategoryEnrollment | null, error: insertError };
        }
      })()
    ).pipe(
      map(({ data, error }) => ({
        enrollment: data as CategoryEnrollment | null,
        error: error || null,
      }))
    );
  }

  /**
   * Crée ou met à jour plusieurs enrollments de catégories en batch (optimisation)
   */
  upsertCategoryEnrollmentsBatch(
    enrollments: { child_id: string; subject_category_id: string; selected: boolean }[]
  ): Observable<{ enrollments: CategoryEnrollment[]; error: PostgrestError | null }> {
    if (enrollments.length === 0) {
      return from(Promise.resolve({ enrollments: [], error: null }));
    }

    return from(
      (async () => {
        const childId = enrollments[0].child_id;
        const categoryIds = enrollments.map(e => e.subject_category_id);

        // Récupérer tous les enrollments existants en une seule requête
        const { data: existing, error: selectError } = await this.supabase.client
          .from('child_subject_category_enrollments')
          .select('*')
          .eq('child_id', childId)
          .in('subject_category_id', categoryIds);

        if (selectError) {
          return { data: null, error: selectError };
        }

        const existingMap = new Map<string, CategoryEnrollment>();
        (existing || []).forEach((e: CategoryEnrollment) => {
          existingMap.set(e.subject_category_id, e);
        });

        // Séparer les enrollments à créer et à mettre à jour
        const toInsert: typeof enrollments = [];
        const toUpdate: { id: string; selected: boolean; subject_category_id: string }[] = [];

        enrollments.forEach(enr => {
          const existingEnr = existingMap.get(enr.subject_category_id);
          if (existingEnr) {
            if (existingEnr.selected !== enr.selected) {
              toUpdate.push({ id: existingEnr.id, selected: enr.selected, subject_category_id: enr.subject_category_id });
            }
          } else {
            toInsert.push(enr);
          }
        });

        const results: CategoryEnrollment[] = [];

        // Mettre à jour les enrollments existants
        if (toUpdate.length > 0) {
          // Pour les mises à jour, on doit les faire une par une (Supabase ne supporte pas bien le batch update avec conditions différentes)
          // Mais on peut au moins les faire en parallèle avec Promise.all
          const updatePromises = toUpdate.map(update => 
            this.supabase.client
              .from('child_subject_category_enrollments')
              .update({ selected: update.selected })
              .eq('id', update.id)
              .select('*')
              .single()
          );

          const updateResults = await Promise.all(updatePromises);
          updateResults.forEach(({ data, error }) => {
            if (!error && data) {
              results.push(data as CategoryEnrollment);
            }
          });
        }

        // Insérer les nouveaux enrollments en batch
        if (toInsert.length > 0) {
          const { data: inserted, error: insertError } = await this.supabase.client
            .from('child_subject_category_enrollments')
            .insert(toInsert)
            .select('*');

          if (insertError) {
            return { data: null, error: insertError };
          }

          if (inserted) {
            results.push(...(inserted as CategoryEnrollment[]));
          }
        }

        // Ajouter les enrollments existants qui n'ont pas été modifiés
        enrollments.forEach(enr => {
          const existingEnr = existingMap.get(enr.subject_category_id);
          if (existingEnr && existingEnr.selected === enr.selected) {
            if (!results.find(r => r.id === existingEnr.id)) {
              results.push(existingEnr);
            }
          }
        });

        return { data: results, error: null };
      })()
    ).pipe(
      map(({ data, error }) => ({
        enrollments: (data as CategoryEnrollment[] | null) || [],
        error: error || null,
      }))
    );
  }

  /**
   * Récupère les professeurs assignés à une matière pour une école et un niveau donnés
   */
  getTeachersForSubject(
    subjectId: string,
    schoolId?: string | null,
    schoolLevel?: string | null
  ): Observable<{ teachers: { id: string; fullname: string | null }[]; error: PostgrestError | null }> {
    let query = this.supabase.client
      .from('teacher_assignments')
      .select('teacher_id')
      .eq('subject_id', subjectId)
      .is('deleted_at', null);

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }
    if (schoolLevel) {
      query = query.eq('school_level', schoolLevel);
    }

    return from(query).pipe(
      switchMap(({ data: assignments, error: assignmentsError }) => {
        if (assignmentsError) {
          return of({ teachers: [], error: assignmentsError as PostgrestError });
        }

        const assignmentRows = (assignments as Array<{ teacher_id: string }> | null) || [];
        const teacherIds = [...new Set(assignmentRows.map(a => a.teacher_id).filter(Boolean))];

        if (teacherIds.length === 0) {
          return of({ teachers: [], error: null });
        }

        // Récupérer les informations des professeurs
        return from(
          this.supabase.client
            .from('teachers')
            .select('id, fullname')
            .in('id', teacherIds)
        ).pipe(
          map(({ data: teachers, error: teachersError }) => {
            if (teachersError) {
              console.warn('[getTeachersForSubject] Erreur lors de la récupération des professeurs:', teachersError);
              return { teachers: [], error: teachersError as PostgrestError };
            }

            const teachersList = ((teachers || []) as Array<{ id: string; fullname: string | null }>).map(t => ({
              id: t.id,
              fullname: t.fullname || null
            }));

            return {
              teachers: teachersList,
              error: null
            };
          })
        );
      })
    );
  }

  /**
   * Récupère les professeurs pour plusieurs matières en batch (optimisation)
   */
  getTeachersForSubjectsBatch(
    subjectIds: string[],
    schoolId?: string | null,
    schoolLevel?: string | null
  ): Observable<{ teachersBySubject: Map<string, { id: string; fullname: string | null }[]>; error: PostgrestError | null }> {
    if (subjectIds.length === 0) {
      return of({ teachersBySubject: new Map(), error: null });
    }

    let query = this.supabase.client
      .from('teacher_assignments')
      .select('subject_id, teacher_id, school_level')
      .in('subject_id', subjectIds)
      .is('deleted_at', null);

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }
    // Ne pas filtrer par school_level pour récupérer tous les professeurs qui enseignent cette matière à cette école
    // Les matières disponibles sont déjà filtrées par niveau dans getAvailableSubjectsForChild

    return from(query).pipe(
      switchMap(({ data: assignments, error: assignmentsError }) => {
        if (assignmentsError) {
          return of({ teachersBySubject: new Map(), error: assignmentsError as PostgrestError });
        }

        const assignmentRows = (assignments as Array<{ subject_id: string; teacher_id: string }> | null) || [];
        
        // Récupérer tous les teacher_ids uniques
        const teacherIds = [...new Set(assignmentRows.map(a => a.teacher_id).filter(Boolean))];

        if (teacherIds.length === 0) {
          const result = new Map<string, { id: string; fullname: string | null }[]>();
          subjectIds.forEach(subjectId => {
            result.set(subjectId, []);
          });
          return of({ teachersBySubject: result, error: null });
        }

        // Récupérer les informations des professeurs
        return from(
          this.supabase.client
            .from('teachers')
            .select('id, fullname')
            .in('id', teacherIds)
        ).pipe(
          map(({ data: teachers, error: teachersError }) => {
            if (teachersError) {
              console.warn('[getTeachersForSubjectsBatch] Erreur lors de la récupération des professeurs:', teachersError);
              const result = new Map<string, { id: string; fullname: string | null }[]>();
              subjectIds.forEach(subjectId => {
                result.set(subjectId, []);
              });
              return { teachersBySubject: result, error: teachersError as PostgrestError };
            }

            // Créer une map des professeurs par ID
            const teachersMap = new Map<string, { id: string; fullname: string | null }>();
            ((teachers || []) as Array<{ id: string; fullname: string | null }>).forEach(t => {
              teachersMap.set(t.id, {
                id: t.id,
                fullname: t.fullname || null
              });
            });

            // Créer une map des professeurs par matière
            const teachersBySubject = new Map<string, Map<string, { id: string; fullname: string | null }>>();
            assignmentRows.forEach((assignment) => {
              const subjectId = assignment.subject_id;
              const teacherId = assignment.teacher_id;
              const teacher = teachersMap.get(teacherId);
              
              if (teacher) {
                if (!teachersBySubject.has(subjectId)) {
                  teachersBySubject.set(subjectId, new Map());
                }
                const subjectTeachers = teachersBySubject.get(subjectId)!;
                if (!subjectTeachers.has(teacherId)) {
                  subjectTeachers.set(teacherId, teacher);
                }
              } else {
                console.warn('[getTeachersForSubjectsBatch] Teacher non trouvé pour ID:', teacherId);
              }
            });

            // Convertir en Map<string, Array>
            const result = new Map<string, { id: string; fullname: string | null }[]>();
            teachersBySubject.forEach((teachersMap, subjectId) => {
              const teachersArray = Array.from(teachersMap.values());
              result.set(subjectId, teachersArray);
            });

            // S'assurer que toutes les matières ont au moins un tableau vide
            subjectIds.forEach(subjectId => {
              if (!result.has(subjectId)) {
                result.set(subjectId, []);
              }
            });

            return {
              teachersBySubject: result,
              error: null
            };
          })
        );
      })
    );
  }
}


