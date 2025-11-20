import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ParentRepository } from '../../repositories/parent.repository';
import { ParentProfileValidator } from '../../validators/parent-profile.validator';
import type { Parent, ParentUpdate } from '../../types/parent';
import type { ParentStatus } from '../../store/index';
import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Service de gestion des parents (refactorisé)
 * Principe SRP : Gère uniquement la logique métier des parents
 * Utilise le repository pour l'accès aux données
 */
@Injectable({
  providedIn: 'root',
})
export class ParentService {
  private readonly repository = inject(ParentRepository);

  /**
   * Retourne le parent actuel depuis le cache sans faire d'appel API
   */
  getCurrentParent(): Parent | null | undefined {
    return this.repository.getCachedValue();
  }

  /**
   * Récupère le profil parent de l'utilisateur connecté avec cache
   */
  getParentProfile(): Observable<Parent | null> {
    return this.repository.getByProfileId();
  }

  /**
   * Vide le cache du parent
   */
  clearParentCache(): void {
    this.repository.clearCache();
  }

  /**
   * Met à jour le profil parent de l'utilisateur connecté
   */
  updateParentProfile(updates: ParentUpdate): Observable<{ parent: Parent | null; error: PostgrestError | null }> {
    return this.repository.update(updates).pipe(
      map(result => ({
        parent: result.data,
        error: result.error
      }))
    );
  }

  /**
   * Crée un profil parent pour l'utilisateur connecté
   */
  createParentProfile(profileData: Omit<Parent, 'id' | 'profile_id' | 'created_at' | 'updated_at'>): Observable<{ parent: Parent | null; error: PostgrestError | null }> {
    return this.repository.create(profileData).pipe(
      map(result => ({
        parent: result.data,
        error: result.error
      }))
    );
  }

  /**
   * Vérifie si des enfants sont inscrits pour un parent donné
   */
  checkChildrenEnrolled(parentId: string): Observable<boolean> {
    return this.repository.checkChildrenEnrolled(parentId);
  }

  /**
   * Vérifie le statut du profil parent (profil complété et enfants inscrits)
   */
  checkParentStatus(): Observable<ParentStatus> {
    return this.getParentProfile().pipe(
      switchMap((parent: Parent | null) => {
        if (!parent) {
          return new Observable<ParentStatus>(observer => {
            observer.next({ isProfileComplete: false, hasChildrenEnrolled: false });
            observer.complete();
          });
        }

        const isProfileComplete = ParentProfileValidator.isProfileComplete(parent);
        
        return this.checkChildrenEnrolled(parent.id).pipe(
          map((hasChildren) => ({
            isProfileComplete,
            hasChildrenEnrolled: hasChildren,
          }))
        );
      })
    );
  }
}
