import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { TeacherRepository } from '../../repositories/teacher.repository';
import { SupabaseService } from '../../../../shared';
import type { Teacher, TeacherUpdate } from '../../types/teacher';
import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Service de gestion des enseignants (refactorisé)
 * Principe SRP : Gère uniquement la logique métier des enseignants
 * Utilise le repository pour l'accès aux données
 */
@Injectable({
  providedIn: 'root',
})
export class TeacherService {
  private readonly repository = inject(TeacherRepository);
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Récupère le profil enseignant de l'utilisateur connecté avec cache
   */
  getTeacherProfile(): Observable<Teacher | null> {
    return this.repository.getByProfileId();
  }

  /**
   * Met à jour le profil enseignant de l'utilisateur connecté
   */
  updateTeacherProfile(updates: TeacherUpdate): Observable<{ teacher: Teacher | null; error: PostgrestError | null }> {
    return this.repository.update(updates).pipe(
      map(result => ({
        teacher: result.data,
        error: result.error
      }))
    );
  }

  /**
   * Crée un profil enseignant pour l'utilisateur connecté
   */
  createTeacherProfile(profileData: Omit<Teacher, 'id' | 'profile_id' | 'created_at' | 'updated_at'>): Observable<{ teacher: Teacher | null; error: PostgrestError | null }> {
    return this.repository.create(profileData).pipe(
      map(result => ({
        teacher: result.data,
        error: result.error
      }))
    );
  }

  /**
   * Vide le cache de l'enseignant
   */
  clearTeacherCache(): void {
    this.repository.clearCache();
  }

  /**
   * Récupère la liste de tous les professeurs
   * @param excludeTeacherId ID du professeur à exclure de la liste (optionnel)
   */
  getAllTeachers(excludeTeacherId?: string): Observable<{ teachers: Teacher[]; error: PostgrestError | null }> {
    let query = this.supabaseService.client
      .from('teachers')
      .select('id, fullname, profile_id')
      .order('fullname', { ascending: true, nullsFirst: false });

    // Exclure seulement si l'ID est fourni et non vide
    if (excludeTeacherId && excludeTeacherId.trim() !== '') {
      query = query.neq('id', excludeTeacherId.trim());
    }

    return from(query).pipe(
      map(({ data, error }) => ({
        teachers: (data || []) as Teacher[],
        error: error || null,
      }))
    );
  }
}
