import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ParentService } from '../../services/parent/parent.service';
import type { Parent, ParentUpdate } from '../../types/parent';
import type { ParentStatus } from '../../store/index';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class Infrastructure {
  private readonly parentService = inject(ParentService);

  /**
   * Récupère le profil parent
   */
  getParentProfile(): Observable<Parent | null> {
    return this.parentService.getParentProfile().pipe(
      catchError(() => {
        // L'erreur est gérée par le store
        return of(null);
      })
    );
  }

  /**
   * Met à jour le profil parent
   */
  updateParentProfile(updates: ParentUpdate): Observable<{ parent: Parent | null; error: PostgrestError | null }> {
    return this.parentService.updateParentProfile(updates).pipe(
      catchError((error: PostgrestError) => {
        // L'erreur est gérée par le store
        return of({ parent: null, error });
      })
    );
  }

  /**
   * Vérifie le statut du profil parent (profil complété et enfants inscrits)
   */
  checkParentStatus(): Observable<ParentStatus> {
    return this.parentService.checkParentStatus().pipe(
      catchError(() => {
        // En cas d'erreur, retourner un statut par défaut
        return of({ isProfileComplete: false, hasChildrenEnrolled: false });
      })
    );
  }

  /**
   * Vérifie si des enfants sont inscrits pour un parent donné
   */
  checkChildrenEnrolled(parentId: string): Observable<boolean> {
    return this.parentService.checkChildrenEnrolled(parentId).pipe(
      catchError(() => {
        // En cas d'erreur, retourner false
        return of(false);
      })
    );
  }

  /**
   * Crée un profil parent
   */
  createParentProfile(profileData: Omit<Parent, 'id' | 'profile_id' | 'created_at' | 'updated_at'>): Observable<{ parent: Parent | null; error: PostgrestError | null }> {
    return this.parentService.createParentProfile(profileData).pipe(
      catchError((error: PostgrestError) => {
        // L'erreur est gérée par le store
        return of({ parent: null, error });
      })
    );
  }
}

