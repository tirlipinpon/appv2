import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from '../../../../shared/services/supabase/supabase.service';
import type { SubjectCategory, SubjectCategoryCreate, SubjectCategoryUpdate } from '../../types/subject';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class SubjectCategoryService {
  private readonly supabaseService = inject(SupabaseService);
  private static readonly DEBUG = true;

  /**
   * Récupère toutes les sous-catégories d'une matière
   */
  getCategoriesBySubject(subjectId: string): Observable<{ categories: SubjectCategory[]; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('subject_categories')
        .select('*')
        .eq('subject_id', subjectId)
        .order('name', { ascending: true })
    ).pipe(
      map(({ data, error }) => ({
        categories: (data as SubjectCategory[] | null) || [],
        error: error || null,
      }))
    );
  }

  /**
   * Crée une nouvelle sous-catégorie
   */
  createCategory(categoryData: SubjectCategoryCreate): Observable<{ category: SubjectCategory | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('subject_categories')
        .insert(categoryData)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => ({
        category: data as SubjectCategory | null,
        error: error || null,
      }))
    );
  }

  /**
   * Met à jour une sous-catégorie existante
   */
  updateCategory(id: string, updates: SubjectCategoryUpdate): Observable<{ category: SubjectCategory | null; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('subject_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .limit(1)
    ).pipe(
      map(({ data, error }) => {
        const rows = (data as SubjectCategory[] | null) || [];
        const logicalError = (rows.length === 0 && !error)
          ? ({ message: 'Aucune ligne mise à jour' } as PostgrestError)
          : null;
        return {
          category: rows[0] || null,
          error: (error || logicalError) as PostgrestError | null,
        };
      })
    );
  }

  /**
   * Supprime une sous-catégorie
   */
  deleteCategory(id: string): Observable<{ error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('subject_categories')
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => ({
        error: error || null,
      }))
    );
  }

  /**
   * Transfère une sous-catégorie vers une autre matière
   * Transfère également tous les jeux liés à cette sous-catégorie
   */
  transferCategory(categoryId: string, newSubjectId: string): Observable<{ category: SubjectCategory | null; error: PostgrestError | null }> {
    if (SubjectCategoryService.DEBUG) {
      console.log('[SubjectCategoryService:transferCategory]', { categoryId, newSubjectId });
    }

    // D'abord récupérer la sous-catégorie à transférer
    return from(
      this.supabaseService.client
        .from('subject_categories')
        .select('*')
        .eq('id', categoryId)
        .single()
    ).pipe(
      switchMap(({ data: categoryToTransfer, error: fetchError }) => {
        if (fetchError || !categoryToTransfer) {
          return from(Promise.resolve({
            category: null,
            error: fetchError || ({ message: 'Sous-catégorie non trouvée' } as PostgrestError),
          }));
        }

        const currentSubjectId = (categoryToTransfer as SubjectCategory).subject_id;

        // Vérifier qu'on ne transfère pas vers la même matière
        if (currentSubjectId === newSubjectId) {
          return from(Promise.resolve({
            category: null,
            error: { message: 'Impossible de transférer vers la même matière' } as PostgrestError,
          }));
        }

        // Mettre à jour la sous-catégorie avec le nouveau subject_id
        // Les jeux liés à cette sous-catégorie restent liés (subject_category_id ne change pas)
        return from(
          this.supabaseService.client
            .from('subject_categories')
            .update({ subject_id: newSubjectId })
            .eq('id', categoryId)
            .select()
            .single()
        ).pipe(
          map(({ data, error }) => {
            if (error) {
              if (SubjectCategoryService.DEBUG) {
                console.error('[SubjectCategoryService:transferCategory] Erreur lors du transfert:', error);
              }
              return {
                category: null,
                error: error || null,
              };
            }

            if (SubjectCategoryService.DEBUG) {
              console.log('[SubjectCategoryService:transferCategory] Transfert réussi');
            }

            return {
              category: data as SubjectCategory | null,
              error: null,
            };
          })
        );
      })
    );
  }
}

