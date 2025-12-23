import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from '../../../../shared/services/supabase/supabase.service';
import type { SubjectCategory, SubjectCategoryCreate, SubjectCategoryUpdate } from '../../types/subject';
import type { PostgrestError } from '@supabase/supabase-js';

// Note: Pour compter les enfants par sous-catégorie avec filtres école/niveau,
// on utilise une approche différente car on doit joindre avec child_subject_enrollments

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
   * Compte le nombre d'enfants inscrits à une sous-catégorie
   */
  countChildrenByCategory(
    categoryId: string,
    schoolId: string | null = null,
    schoolLevel: string | null = null
  ): Observable<{ count: number; error: PostgrestError | null }> {
    // D'abord, récupérer les enfants inscrits à la sous-catégorie
    return from(
      this.supabaseService.client
        .from('child_subject_category_enrollments')
        .select('child_id')
        .eq('subject_category_id', categoryId)
        .eq('selected', true)
    ).pipe(
      switchMap(({ data: enrollments, error: enrollmentsError }) => {
        if (enrollmentsError || !enrollments || enrollments.length === 0) {
          return from(Promise.resolve({ count: 0, error: enrollmentsError || null }));
        }

        const childIds = enrollments.map(e => e.child_id);

        // Pour les sous-catégories, on compte tous les enfants inscrits (actifs)
        // sans filtrer par école/niveau car une catégorie peut être partagée
        // entre plusieurs écoles/niveaux
        return from(
          this.supabaseService.client
            .from('children')
            .select('id, is_active')
            .in('id', childIds)
        ).pipe(
          map(({ data: children, error: childrenError }) => {
            if (childrenError || !children) {
              return { count: 0, error: childrenError || null };
            }

            // Filtrer uniquement par is_active (pas par école/niveau)
            const activeChildren = children.filter(child => child.is_active);

            return {
              count: activeChildren.length,
              error: null,
            };
          })
        );
      })
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

