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
          school_year:school_years(*),
          subject:subjects(*)
        `)
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
    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .insert({
          ...assignmentData,
          roles: assignmentData.roles || ['titulaire'],
        })
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
    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => ({
        error: error || null,
      }))
    );
  }
}

