import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from '../../../../shared/services/supabase/supabase.service';
import { AuthService } from '../../../../shared/services/auth/auth.service';
import type { TeacherAssignment, TeacherAssignmentCreate, TeacherAssignmentUpdate } from '../../types/teacher-assignment';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class TeacherAssignmentService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  /**
   * Récupère les affectations du professeur connecté
   */
  getTeacherAssignments(teacherId: string): Observable<{ assignments: TeacherAssignment[]; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .select(`
          *,
          school:schools(*),
          subject:subjects(*)
        `)
        .is('deleted_at', null)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => ({
        assignments: data || [],
        error: error || null,
      }))
    );
  }

  /**
   * Crée une nouvelle affectation
   */
  createAssignment(assignmentData: TeacherAssignmentCreate): Observable<{ assignment: TeacherAssignment | null; error: PostgrestError | null }> {
    // Normaliser school_level pour respecter la contrainte UNIQUE (pas de NULL)
    const normalized = {
      ...assignmentData,
      school_level: (assignmentData.school_level ?? '') as string,
      roles: assignmentData.roles || ['titulaire'],
      deleted_at: null, // réactiver en cas d'upsert sur une ligne soft-supprimée
    };
    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .upsert(normalized, { onConflict: 'teacher_id,school_id,school_level,subject_id' })
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        assignment: data,
        error: error || null,
      }))
    );
  }

  /**
   * Met à jour une affectation
   */
  updateAssignment(id: string, updates: TeacherAssignmentUpdate): Observable<{ assignment: TeacherAssignment | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        assignment: data,
        error: error || null,
      }))
    );
  }

  /**
   * Supprime une affectation
   */
  deleteAssignment(id: string): Observable<{ error: PostgrestError | null }> {
    // Soft delete: marquer deleted_at, plus robuste face aux réinsertions externes
    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
        .limit(1)
    ).pipe(
      map(({ data, error }) => {
        const rows = (data as { id: string }[] | null) || [];
        const logicalError = (rows.length === 0 && !error)
          ? ({ message: 'Aucune ligne mise à jour' } as PostgrestError)
          : null;
        return { error: (error || logicalError) as PostgrestError | null };
      })
    );
  }

  /**
   * Transfère une affectation à un autre professeur (déplace)
   * Change le teacher_id de l'affectation existante
   */
  transferAssignment(assignmentId: string, newTeacherId: string): Observable<{ assignment: TeacherAssignment | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .update({ teacher_id: newTeacherId })
        .eq('id', assignmentId)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        assignment: data as TeacherAssignment | null,
        error: error || null,
      }))
    );
  }

  /**
   * Partage une affectation avec un autre professeur (crée une nouvelle affectation)
   * Crée une nouvelle affectation avec les mêmes paramètres sauf teacher_id
   */
  shareAssignment(assignmentId: string, newTeacherId: string): Observable<{ assignment: TeacherAssignment | null; error: PostgrestError | null }> {
    // D'abord récupérer l'affectation existante
    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single()
    ).pipe(
      switchMap(({ data: existingAssignment, error: fetchError }) => {
        if (fetchError || !existingAssignment) {
          return from(Promise.resolve({ assignment: null, error: fetchError || null }));
        }

        // Créer une nouvelle affectation avec les mêmes paramètres mais nouveau teacher_id
        const newAssignment = {
          teacher_id: newTeacherId,
          school_id: existingAssignment.school_id,
          school_year_id: existingAssignment.school_year_id,
          school_level: existingAssignment.school_level || '',
          class_id: existingAssignment.class_id,
          subject_id: existingAssignment.subject_id,
          roles: existingAssignment.roles || ['titulaire'],
          start_date: existingAssignment.start_date,
          end_date: existingAssignment.end_date,
          deleted_at: null,
        };

        return from(
          this.supabaseService.client
            .from('teacher_assignments')
            .upsert(newAssignment, { onConflict: 'teacher_id,school_id,school_level,subject_id' })
            .select()
            .single()
        ).pipe(
          map(({ data, error }) => ({
            assignment: data as TeacherAssignment | null,
            error: error || null,
          }))
        );
      })
    );
  }
}

