import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TeacherRepository } from '../../repositories/teacher.repository';
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
}
