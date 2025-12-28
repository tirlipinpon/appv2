import { Injectable, inject } from '@angular/core';
import { Observable, from, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { SupabaseService } from '../../../../shared/services/supabase/supabase.service';
import type { TeacherAssignment, TeacherAssignmentCreate, TeacherAssignmentUpdate } from '../../types/teacher-assignment';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class TeacherAssignmentService {
  private readonly supabaseService = inject(SupabaseService);

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
      map(({ data, error }) => {
        return {
          assignments: data || [],
          error: error || null,
        };
      })
    );
  }

  /**
   * Crée une nouvelle affectation
   * Vérifie s'il existe une affectation supprimée pour la même matière et la réactive si nécessaire
   * Retourne une confirmation si une affectation active avec un niveau différent existe
   */
  createAssignment(assignmentData: TeacherAssignmentCreate): Observable<{ 
    assignment: TeacherAssignment | null; 
    error: PostgrestError | null;
    requiresConfirmation?: {
      conflictingAssignments: Array<{ id: string; school_level: string }>;
      message: string;
      assignmentData: TeacherAssignmentCreate;
    };
  }> {
    // Normaliser school_level pour respecter la contrainte UNIQUE (pas de NULL)
    const normalized = {
      ...assignmentData,
      school_level: (assignmentData.school_level ?? '') as string,
      roles: assignmentData.roles || ['titulaire'],
      deleted_at: null, // réactiver en cas d'upsert sur une ligne soft-supprimée
    };

    // Vérifier s'il existe une affectation supprimée pour la même matière (même teacher_id, school_id, subject_id)
    // mais avec un school_level différent - cela peut indiquer une erreur de niveau
    let checkQuery = this.supabaseService.client
      .from('teacher_assignments')
      .select('id, school_level, deleted_at')
      .eq('teacher_id', normalized.teacher_id)
      .eq('subject_id', normalized.subject_id)
      .not('deleted_at', 'is', null); // Chercher les affectations supprimées

    // Gérer school_id (peut être null)
    if (normalized.school_id) {
      checkQuery = checkQuery.eq('school_id', normalized.school_id);
    } else {
      checkQuery = checkQuery.is('school_id', null);
    }

    return from(checkQuery).pipe(
      switchMap(({ data: deletedAssignments, error: checkError }) => {
        // Si erreur lors de la vérification, continuer avec la création normale
        if (checkError) {
          console.warn('[createAssignment] Erreur lors de la vérification des affectations supprimées:', checkError);
        }

        // Vérifier s'il existe une affectation active avec un niveau différent
        // Si oui, la supprimer pour éviter les doublons
        let activeCheckQuery = this.supabaseService.client
          .from('teacher_assignments')
          .select('id, school_level')
          .eq('teacher_id', normalized.teacher_id)
          .eq('subject_id', normalized.subject_id)
          .is('deleted_at', null)
          .neq('school_level', normalized.school_level);

        if (normalized.school_id) {
          activeCheckQuery = activeCheckQuery.eq('school_id', normalized.school_id);
        } else {
          activeCheckQuery = activeCheckQuery.is('school_id', null);
        }

        return from(activeCheckQuery).pipe(
          switchMap(({ data: activeAssignments, error: activeCheckError }) => {
            // Si une affectation active existe avec un niveau différent, demander confirmation
            if (activeAssignments && activeAssignments.length > 0) {
              console.log('[createAssignment] Affectation active trouvée avec un niveau différent, demande de confirmation:', activeAssignments);
              
              // Construire le message de confirmation
              const levels = activeAssignments.map((a: { school_level: string }) => a.school_level).join(', ');
              const message = `Une affectation active existe déjà pour cette matière avec le${activeAssignments.length > 1 ? 's niveau' : ' niveau'} "${levels}". Voulez-vous la remplacer par le niveau "${normalized.school_level}" ?`;
              
              // Retourner une demande de confirmation au lieu de supprimer automatiquement
              return of({
                assignment: null,
                error: null,
                requiresConfirmation: {
                  conflictingAssignments: activeAssignments.map((a: { id: string; school_level: string }) => ({
                    id: a.id,
                    school_level: a.school_level
                  })),
                  message,
                  assignmentData: normalized
                }
              });
            }

            // Pas d'affectation active avec niveau différent, vérifier s'il existe une affectation supprimée avec le bon niveau
            const deletedWithCorrectLevel = (deletedAssignments || []).find(
              (a: { school_level: string }) => a.school_level === normalized.school_level
            );

            if (deletedWithCorrectLevel) {
              // Réactiver l'affectation supprimée avec le bon niveau
              console.log('[createAssignment] Réactivation de l\'affectation supprimée avec le bon niveau:', deletedWithCorrectLevel.id);
              return from(
                this.supabaseService.client
                  .from('teacher_assignments')
                  .update({
                    ...normalized,
                    deleted_at: null
                  })
                  .eq('id', deletedWithCorrectLevel.id)
                  .select(`
                    *,
                    school:schools(*),
                    subject:subjects(*)
                  `)
                  .single()
              ).pipe(
                map(({ data, error }) => ({
                  assignment: data as TeacherAssignment | null,
                  error: error || null,
                }))
              );
            }

            // Créer une nouvelle affectation normalement
            return from(
              this.supabaseService.client
                .from('teacher_assignments')
                .upsert(normalized, { onConflict: 'teacher_id,school_id,school_level,subject_id' })
                .select(`
                  *,
                  school:schools(*),
                  subject:subjects(*)
                `)
                .single()
            ).pipe(
              map(({ data, error }) => ({
                assignment: data as TeacherAssignment | null,
                error: error || null,
              }))
            );
          })
        );
      })
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
   * Crée une affectation après confirmation (supprime les affectations conflictuelles)
   */
  createAssignmentWithConfirmation(
    assignmentData: TeacherAssignmentCreate,
    conflictingAssignmentIds: string[]
  ): Observable<{ assignment: TeacherAssignment | null; error: PostgrestError | null }> {
    // Normaliser school_level pour respecter la contrainte UNIQUE (pas de NULL)
    const normalized = {
      ...assignmentData,
      school_level: (assignmentData.school_level ?? '') as string,
      roles: assignmentData.roles || ['titulaire'],
      deleted_at: null,
    };

    // Supprimer les affectations conflictuelles
    const deleteObservables = conflictingAssignmentIds.map(id => this.deleteAssignment(id));
    
    return forkJoin(deleteObservables).pipe(
      switchMap(() => {
        // Vérifier s'il existe une affectation supprimée avec le bon niveau à réactiver
        let checkQuery = this.supabaseService.client
          .from('teacher_assignments')
          .select('id, school_level, deleted_at')
          .eq('teacher_id', normalized.teacher_id)
          .eq('subject_id', normalized.subject_id)
          .not('deleted_at', 'is', null);

        if (normalized.school_id) {
          checkQuery = checkQuery.eq('school_id', normalized.school_id);
        } else {
          checkQuery = checkQuery.is('school_id', null);
        }

        return from(checkQuery).pipe(
          switchMap(({ data: deletedAssignments, error: checkError }) => {
            if (checkError) {
              console.warn('[createAssignmentWithConfirmation] Erreur lors de la vérification:', checkError);
            }

            const deletedWithCorrectLevel = (deletedAssignments || []).find(
              (a: { school_level: string }) => a.school_level === normalized.school_level
            );

            if (deletedWithCorrectLevel) {
              // Réactiver l'affectation supprimée avec le bon niveau
              console.log('[createAssignmentWithConfirmation] Réactivation de l\'affectation supprimée:', deletedWithCorrectLevel.id);
              return from(
                this.supabaseService.client
                  .from('teacher_assignments')
                  .update({
                    ...normalized,
                    deleted_at: null
                  })
                  .eq('id', deletedWithCorrectLevel.id)
                  .select(`
                    *,
                    school:schools(*),
                    subject:subjects(*)
                  `)
                  .single()
              ).pipe(
                map(({ data, error }) => ({
                  assignment: data as TeacherAssignment | null,
                  error: error || null,
                }))
              );
            }

            // Créer une nouvelle affectation
            return from(
              this.supabaseService.client
                .from('teacher_assignments')
                .upsert(normalized, { onConflict: 'teacher_id,school_id,school_level,subject_id' })
                .select(`
                  *,
                  school:schools(*),
                  subject:subjects(*)
                `)
                .single()
            ).pipe(
              map(({ data, error }) => ({
                assignment: data as TeacherAssignment | null,
                error: error || null,
              }))
            );
          })
        );
      })
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

        // Vérifier si le professeur cible a déjà une affectation (active ou supprimée) pour cette matière/école/niveau
        // Construire la requête en gérant correctement les valeurs null
        const schoolLevel = assignmentToTransfer.school_level || '';
        let checkQuery = this.supabaseService.client
          .from('teacher_assignments')
          .select('id, deleted_at')
          .eq('teacher_id', newTeacherId)
          .eq('subject_id', assignmentToTransfer.subject_id)
          .eq('school_level', schoolLevel);

        // Gérer school_id (peut être null)
        if (assignmentToTransfer.school_id) {
          checkQuery = checkQuery.eq('school_id', assignmentToTransfer.school_id);
        } else {
          checkQuery = checkQuery.is('school_id', null);
        }

        return from(checkQuery.maybeSingle()).pipe(
          switchMap(({ data: existingAssignment, error: checkError }) => {
            // En cas d'erreur de vérification, on essaie quand même le transfert
            // (l'erreur de contrainte unique sera gérée par Supabase)
            if (checkError) {
              console.warn('[TransferAssignment] Erreur lors de la vérification, tentative de transfert:', checkError);
            }

            // Si le professeur cible a déjà une affectation active, supprimer celle qu'on transfère
            if (existingAssignment && existingAssignment.id && !existingAssignment.deleted_at) {
              console.log('[TransferAssignment] Le professeur cible a déjà cette affectation active, suppression de l\'affectation source');
              return this.deleteAssignment(assignmentId).pipe(
                map(({ error }) => {
                  return {
                    assignment: null, // Pas de nouvelle affectation créée, juste suppression
                    error: error || null,
                  };
                })
              );
            }

            // Si le professeur cible a une affectation supprimée, la réactiver et supprimer celle du source
            if (existingAssignment && existingAssignment.id && existingAssignment.deleted_at) {
              console.log('[TransferAssignment] Le professeur cible a une affectation supprimée, réactivation et suppression de l\'affectation source');
              return from(
                this.supabaseService.client
                  .from('teacher_assignments')
                  .update({ deleted_at: null })
                  .eq('id', existingAssignment.id)
                  .select()
                  .single()
              ).pipe(
                switchMap(({ data: reactivatedAssignment, error: reactivateError }) => {
                  if (reactivateError) {
                    console.error('[TransferAssignment] Erreur lors de la réactivation:', reactivateError);
                    // En cas d'erreur, essayer le transfert normal
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
                  // Réactivation réussie, supprimer l'affectation source
                  return this.deleteAssignment(assignmentId).pipe(
                    map(({ error }) => ({
                      assignment: reactivatedAssignment as TeacherAssignment | null,
                      error: error || null,
                    }))
                  );
                })
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

        // Si une affectation supprimée existe, essayer de la réactiver
        if (validation.existingAssignment && validation.existingAssignment.deleted_at) {
          console.log('[ShareAssignment] Réactivation d\'une affectation supprimée');
          // Vérifier si l'affectation supprimée appartient au même professeur
          // Si oui, on peut la réactiver avec upsert
          // Si non, RLS empêchera la mise à jour, donc on créera une nouvelle affectation
          const existingTeacherId = validation.existingAssignment.teacher_id;
          
          if (existingTeacherId === newTeacherId) {
            // Même professeur : essayer de réactiver avec update direct
            // Si RLS bloque (ligne créée par un autre prof), créer une nouvelle affectation
            return from(
              this.supabaseService.client
                .from('teacher_assignments')
                .update({ deleted_at: null })
                .eq('id', validation.existingAssignment.id)
                .eq('teacher_id', newTeacherId) // S'assurer que RLS permet la mise à jour
                .select(`
                  *,
                  school:schools(*),
                  subject:subjects(*)
                `)
                .maybeSingle()
            ).pipe(
              switchMap(({ data }) => {
                // Si update réussit, retourner le résultat
                if (data) {
                  return of({
                    assignment: data as TeacherAssignment | null,
                    error: null,
                  });
                }
                // Si update échoue (RLS bloque ou ligne n'existe plus), créer une nouvelle affectation
                console.log('[ShareAssignment] Update échoué (RLS bloque probablement), création d\'une nouvelle affectation');
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
                    .select(`
                      *,
                      school:schools(*),
                      subject:subjects(*)
                    `)
                    .single()
                ).pipe(
                  switchMap(({ data: insertData, error: insertError }) => {
                    // Si insert échoue à cause de contrainte unique, essayer upsert
                    if (insertError && insertError.code === '23505') {
                      // Si upsert échoue aussi, utiliser la fonction RPC qui contourne RLS
                      return from(
                        this.supabaseService.client
                          .from('teacher_assignments')
                          .upsert(newAssignment, { onConflict: 'teacher_id,school_id,school_level,subject_id' })
                          .select(`
                            *,
                            school:schools(*),
                            subject:subjects(*)
                          `)
                          .single()
                      ).pipe(
                        switchMap(({ data: upsertData, error: upsertError }) => {
                          // Si upsert échoue à cause de RLS, utiliser la fonction RPC
                          if (upsertError && upsertError.code === '42501') {
                            return from(
                              this.supabaseService.client
                                .rpc('share_teacher_assignment', {
                                  p_source_assignment_id: assignmentId,
                                  p_new_teacher_id: newTeacherId,
                                })
                            ).pipe(
                              map(({ data: rpcData, error: rpcError }) => {
                                if (rpcError) {
                                  return {
                                    assignment: null,
                                    error: {
                                      code: rpcError.code || '500',
                                      message: rpcError.message || 'Erreur lors du partage via fonction RPC',
                                      details: rpcError.details || '',
                                      hint: rpcError.hint || '',
                                      name: 'PostgrestError',
                                    } as PostgrestError,
                                  };
                                }
                                // La fonction RPC retourne un JSONB avec soit l'affectation soit une erreur
                                const result = rpcData as TeacherAssignment | { error: string } | null;
                                if (result && 'error' in result && result.error) {
                                  return {
                                    assignment: null,
                                    error: {
                                      code: '500',
                                      message: result.error,
                                      details: '',
                                      hint: '',
                                      name: 'PostgrestError',
                                    } as PostgrestError,
                                  };
                                }
                                // Le résultat est l'affectation directement
                                return {
                                  assignment: result as TeacherAssignment | null,
                                  error: null,
                                };
                              })
                            );
                          }
                          return of({
                            assignment: upsertData as TeacherAssignment | null,
                            error: upsertError || null,
                          });
                        })
                      );
                    }
                    return of({
                      assignment: insertData as TeacherAssignment | null,
                      error: insertError || null,
                    });
                  })
                );
              })
            );
          } else {
            // Affectation supprimée appartient à un autre professeur
            // RLS empêchera la mise à jour, donc on va créer une nouvelle affectation
            // L'upsert avec onConflict va échouer à cause de RLS, donc on utilise insert
            // et on gère l'erreur de contrainte unique en supprimant définitivement l'ancienne
            console.log('[ShareAssignment] Affectation supprimée appartient à un autre professeur, création d\'une nouvelle');
            // Continuer avec la création d'une nouvelle affectation (voir code ci-dessous)
          }
        }

        // Créer une nouvelle affectation
        // Si une affectation supprimée existe mais appartient à un autre professeur,
        // on utilise insert et on gère l'erreur de contrainte unique
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
            .select(`
              *,
              school:schools(*),
              subject:subjects(*)
            `)
            .single()
        ).pipe(
          switchMap(({ data, error }) => {
            // Si erreur de contrainte unique, cela signifie qu'une affectation supprimée existe
            // On essaie alors avec upsert qui devrait fonctionner si l'affectation appartient au même professeur
            if (error && error.code === '23505') {
              console.log('[ShareAssignment] Contrainte unique détectée, tentative avec upsert');
              return from(
                this.supabaseService.client
                  .from('teacher_assignments')
                  .upsert(newAssignment, { onConflict: 'teacher_id,school_id,school_level,subject_id' })
                  .select(`
                    *,
                    school:schools(*),
                    subject:subjects(*)
                  `)
                  .single()
              ).pipe(
                map(({ data: upsertData, error: upsertError }) => {
                  return {
                    assignment: upsertData as TeacherAssignment | null,
                    error: upsertError || null,
                  };
                })
              );
            }
            return of({
              assignment: data as TeacherAssignment | null,
              error: error || null,
            });
          })
        );
      })
    );
  }

  /**
   * Récupère les autres affectations partagées pour une affectation donnée
   * (même matière/école/niveau mais avec d'autres professeurs)
   */
  getSharedAssignments(assignmentId: string): Observable<{ 
    sharedAssignments: { 
      assignment: TeacherAssignment; 
      teacher: { id: string; fullname: string | null } 
    }[]; 
    error: PostgrestError | null 
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
          return of({ sharedAssignments: [], error: fetchError || null });
        }

        // Construire la requête pour trouver les autres affectations
        // On cherche les affectations avec le même subject_id et school_id
        // (même si le school_level est différent, pour être cohérent avec l'affichage "Autre prof")
        let query = this.supabaseService.client
          .from('teacher_assignments')
          .select('*')
          .eq('subject_id', sourceAssignment.subject_id)
          .is('deleted_at', null)
          .neq('id', assignmentId); // Exclure l'affectation actuelle

        // Exclure les affectations du même professeur (pour ne compter que les autres professeurs)
        if (sourceAssignment.teacher_id) {
          query = query.neq('teacher_id', sourceAssignment.teacher_id);
        }

        // Gérer school_id (peut être null)
        // On filtre par school_id pour trouver les affectations dans la même école
        if (sourceAssignment.school_id) {
          query = query.eq('school_id', sourceAssignment.school_id);
        } else {
          query = query.is('school_id', null);
        }
        
        // Note: On ne filtre plus par school_level pour être cohérent avec l'affichage "Autre prof"
        // qui montre tous les professeurs qui enseignent la même matière dans la même école

        return from(query).pipe(
          switchMap(({ data: assignments, error }) => {
            if (error) {
              return of({ sharedAssignments: [], error });
            }

            if (!assignments || assignments.length === 0) {
              return of({ sharedAssignments: [], error: null });
            }

            // Récupérer les IDs des professeurs uniques
            const teacherIds = [...new Set(assignments.map((a: TeacherAssignment) => a.teacher_id).filter(Boolean))];

            if (teacherIds.length === 0) {
              // Si pas de teacher_id, retourner les affectations sans noms
              const shared = assignments.map((item: TeacherAssignment) => ({
                assignment: item,
                teacher: {
                  id: item.teacher_id || '',
                  fullname: null
                }
              }));
              return of({ sharedAssignments: shared, error: null });
            }

            // Récupérer les informations des professeurs
            return from(
              this.supabaseService.client
                .from('teachers')
                .select('id, fullname')
                .in('id', teacherIds)
            ).pipe(
              map(({ data: teachers, error: teachersError }) => {
                if (teachersError) {
                  console.warn('[getSharedAssignments] Erreur lors de la récupération des professeurs:', teachersError);
                }

                // Créer une map pour accéder rapidement aux informations des professeurs
                const teachersMap = new Map<string, { id: string; fullname: string | null }>();
                (teachers || []).forEach((t: { id: string; fullname: string | null }) => {
                  teachersMap.set(t.id, { id: t.id, fullname: t.fullname || null });
                });

                // Combiner les affectations avec les informations des professeurs
                const shared = assignments.map((item: TeacherAssignment) => {
                  const teacherId = item.teacher_id || '';
                  const teacherInfo = teachersMap.get(teacherId) || { id: teacherId, fullname: null };
                  
                  return {
                    assignment: item,
                    teacher: teacherInfo
                  };
                });

                return { sharedAssignments: shared, error: null };
              })
            );
          })
        );
      })
    );
  }
}

