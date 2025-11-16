import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../../../../services/supabase/supabase.service';
import { AuthService } from '../../../../services/auth/auth.service';
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
}

