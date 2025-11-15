import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ChildService } from '../../services/child/child.service';
import type { Child, ChildUpdate } from '../../types/child';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class Infrastructure {
  private readonly childService = inject(ChildService);

  /**
   * Récupère tous les enfants
   */
  getChildren(): Observable<Child[]> {
    return this.childService.getChildren().pipe(
      catchError(() => {
        // L'erreur est gérée par le store
        return of([]);
      })
    );
  }

  /**
   * Récupère un enfant par son ID
   */
  getChildById(childId: string): Observable<Child | null> {
    return this.childService.getChildById(childId).pipe(
      catchError(() => {
        // L'erreur est gérée par le store
        return of(null);
      })
    );
  }

  /**
   * Met à jour le profil enfant
   */
  updateChildProfile(childId: string, updates: ChildUpdate): Observable<{ child: Child | null; error: PostgrestError | null }> {
    return this.childService.updateChildProfile(childId, updates).pipe(
      catchError((error: PostgrestError) => {
        // L'erreur est gérée par le store
        return of({ child: null, error });
      })
    );
  }

  /**
   * Crée un profil enfant
   */
  createChildProfile(profileData: Omit<Child, 'id' | 'parent_id' | 'created_at' | 'updated_at'>): Observable<{ child: Child | null; error: PostgrestError | null }> {
    return this.childService.createChildProfile(profileData).pipe(
      catchError((error: PostgrestError) => {
        // L'erreur est gérée par le store
        return of({ child: null, error });
      })
    );
  }
}

