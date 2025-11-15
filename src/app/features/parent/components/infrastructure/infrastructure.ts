import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ParentService } from '../../services/parent/parent.service';
import type { Parent, ParentUpdate } from '../../types/parent';
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
      catchError((error: PostgrestError) => {
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
}

