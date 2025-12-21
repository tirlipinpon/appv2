import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
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
   * Valide si un transfert ou partage peut être effectué
   * Retourne l'état de validation avec les informations nécessaires
   */
  validateShareOrTransfer(
    assignmentId: string,
    newTeacherId: string,
    mode: 'transfer' | 'share'
  ): Observable<{
    canProceed: boolean;
    reason?: string;
    existingAssignment?: TeacherAssignment;
    sourceAssignment?: TeacherAssignment;
  }> {
    // Récupérer l'affectation source
    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single()
    ).pipe(
      switchMap(({ data: sourceAssignment, error: fetchError }) => {
        if (fetchError || !sourceAssignment) {
          return of({
            canProceed: false,
            reason: 'L\'affectation n\'existe plus ou a été supprimée.',
          });
        }

        // Vérifier que l'affectation source est active
        if (sourceAssignment.deleted_at) {
          return of({
            canProceed: false,
            reason: 'L\'affectation a été supprimée. Vous ne pouvez pas la transférer ou la partager.',
            sourceAssignment: sourceAssignment as TeacherAssignment,
          });
        }

        // Vérifier l'état du professeur cible
        const schoolLevel = sourceAssignment.school_level || '';
        let checkQuery = this.supabaseService.client
          .from('teacher_assignments')
          .select('*')
          .eq('teacher_id', newTeacherId)
          .eq('subject_id', sourceAssignment.subject_id)
          .eq('school_level', schoolLevel);

        // Gérer school_id (peut être null)
        if (sourceAssignment.school_id) {
          checkQuery = checkQuery.eq('school_id', sourceAssignment.school_id);
        } else {
          checkQuery = checkQuery.is('school_id', null);
        }

        return from(checkQuery.maybeSingle()).pipe(
          map(({ data: existingAssignment, error: checkError }) => {
            if (checkError) {
              // Erreur de vérification, on considère qu'on peut procéder
              return {
                canProceed: true,
                sourceAssignment: sourceAssignment as TeacherAssignment,
              };
            }

            const existing = existingAssignment as TeacherAssignment | null;

            if (mode === 'share') {
              // Pour le partage : bloquer si le professeur cible a déjà une affectation active
              if (existing && !existing.deleted_at) {
                return {
                  canProceed: false,
                  reason: 'Le professeur cible a déjà une affectation active pour cette matière/école/niveau. Vous ne pouvez pas partager.',
                  existingAssignment: existing,
                  sourceAssignment: sourceAssignment as TeacherAssignment,
                };
              }
              // Si supprimée, on peut réactiver
              return {
                canProceed: true,
                existingAssignment: existing || undefined,
                sourceAssignment: sourceAssignment as TeacherAssignment,
              };
            } else {
              // Pour le transfert : on peut toujours procéder
              // Si le professeur cible a déjà une affectation active, on supprimera celle du source
              return {
                canProceed: true,
                existingAssignment: existing || undefined,
                sourceAssignment: sourceAssignment as TeacherAssignment,
              };
            }
          })
        );
      })
    );
  }

  /**
   * Transfère une affectation à un autre professeur (déplace)
   * Change le teacher_id de l'affectation existante
   * Si le professeur cible a déjà une affectation pour cette matière/école/niveau,
   * supprime l'affectation source au lieu de la transférer
   */
  transferAssignment(assignmentId: string, newTeacherId: string): Observable<{ assignment: TeacherAssignment | null; error: PostgrestError | null }> {
    // D'abord récupérer l'affectation à transférer
    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single()
    ).pipe(
      switchMap(({ data: assignmentToTransfer, error: fetchError }) => {
        if (fetchError || !assignmentToTransfer) {
          return of({ assignment: null, error: fetchError || null });
        }

        // Vérifier si le professeur cible a déjà une affectation pour cette matière/école/niveau
        // Construire la requête en gérant correctement les valeurs null
        let checkQuery = this.supabaseService.client
          .from('teacher_assignments')
          .select('id')
          .eq('teacher_id', newTeacherId)
          .eq('subject_id', assignmentToTransfer.subject_id)
          .is('deleted_at', null);

        // Gérer school_id (peut être null)
        if (assignmentToTransfer.school_id) {
          checkQuery = checkQuery.eq('school_id', assignmentToTransfer.school_id);
        } else {
          checkQuery = checkQuery.is('school_id', null);
        }

        // Gérer school_level (normalisé en chaîne vide dans la DB si null)
        const schoolLevel = assignmentToTransfer.school_level || '';
        checkQuery = checkQuery.eq('school_level', schoolLevel);

        return from(checkQuery.maybeSingle()).pipe(
          switchMap(({ data: existingAssignment, error: checkError }) => {
            // En cas d'erreur de vérification, on essaie quand même le transfert
            // (l'erreur de contrainte unique sera gérée par Supabase)
            if (checkError) {
              console.warn('[TransferAssignment] Erreur lors de la vérification, tentative de transfert:', checkError);
            }

            // Si le professeur cible a déjà une affectation, supprimer celle qu'on transfère
            if (existingAssignment && existingAssignment.id) {
              console.log('[TransferAssignment] Le professeur cible a déjà cette affectation, suppression de l\'affectation source');
              return this.deleteAssignment(assignmentId).pipe(
                map(({ error }) => ({
                  assignment: null, // Pas de nouvelle affectation créée, juste suppression
                  error: error || null,
                }))
              );
            }

            // Sinon, transférer normalement
            // Si une erreur de contrainte unique se produit, on la gère
            return from(
              this.supabaseService.client
                .from('teacher_assignments')
                .update({ teacher_id: newTeacherId })
                .eq('id', assignmentId)
                .select()
                .single()
            ).pipe(
              switchMap(({ data, error }) => {
                // Si erreur de contrainte unique, supprimer l'affectation source
                if (error && error.code === '23505') {
                  console.log('[TransferAssignment] Impossible de transférer : le professeur cible a déjà cette affectation. Suppression de l\'affectation source.');
                  // Supprimer l'affectation source et retourner un succès
                  return this.deleteAssignment(assignmentId).pipe(
                    map(({ error: deleteError }) => ({
                      assignment: null,
                      error: deleteError || null, // Retourner l'erreur de suppression si elle existe
                    }))
                  );
                }
                // Si autre erreur, la retourner sans supprimer
                if (error) {
                  return of({
                    assignment: null,
                    error: {
                      ...error,
                      message: error.message || 'Erreur lors du transfert de l\'affectation.',
                    },
                  });
                }
                // Succès du transfert
                return of({
                  assignment: data as TeacherAssignment | null,
                  error: null,
                });
              })
            );
          })
        );
      })
    );
  }

  /**
   * Partage une affectation avec un autre professeur (crée une nouvelle affectation)
   * Utilise la validation préalable pour simplifier la logique
   * Si l'affectation existe déjà et est active, retourne une erreur claire
   * Si l'affectation existe mais est supprimée, la réactive
   */
  shareAssignment(assignmentId: string, newTeacherId: string): Observable<{ assignment: TeacherAssignment | null; error: PostgrestError | null }> {
    // Valider avant de procéder
    return this.validateShareOrTransfer(assignmentId, newTeacherId, 'share').pipe(
      switchMap((validation) => {
        // Si la validation échoue, retourner l'erreur immédiatement
        if (!validation.canProceed) {
          return of({
            assignment: null,
            error: {
              code: '400',
              message: validation.reason || 'Impossible de partager cette affectation.',
              details: '',
              hint: '',
              name: 'PostgrestError',
            } as PostgrestError,
          });
        }

        const sourceAssignment = validation.sourceAssignment!;
        const schoolLevel = sourceAssignment.school_level || '';

        // Si une affectation supprimée existe, la réactiver
        if (validation.existingAssignment && validation.existingAssignment.deleted_at) {
          console.log('[ShareAssignment] Réactivation d\'une affectation supprimée');
          return from(
            this.supabaseService.client
              .from('teacher_assignments')
              .update({ deleted_at: null })
              .eq('id', validation.existingAssignment!.id)
              .select()
              .single()
          ).pipe(
            map(({ data, error }) => ({
              assignment: data as TeacherAssignment | null,
              error: error || null,
            }))
          );
        }

        // Sinon, créer une nouvelle affectation
        const newAssignment = {
          teacher_id: newTeacherId,
          school_id: sourceAssignment.school_id,
          school_year_id: sourceAssignment.school_year_id,
          school_level: schoolLevel,
          class_id: sourceAssignment.class_id,
          subject_id: sourceAssignment.subject_id,
          roles: sourceAssignment.roles || ['titulaire'],
          start_date: sourceAssignment.start_date,
          end_date: sourceAssignment.end_date,
          deleted_at: null,
        };

        return from(
          this.supabaseService.client
            .from('teacher_assignments')
            .insert(newAssignment)
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

