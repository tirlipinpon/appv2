import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Infrastructure } from '../../../features/teacher/components/infrastructure/infrastructure';
import type { SubjectCategory } from '../../../features/teacher/types/subject';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class CategoriesCacheService {
  private readonly infrastructure = inject(Infrastructure);
  
  // Cache global des catégories par subject_id
  private readonly categoriesCache = signal<Record<string, SubjectCategory[]>>({});
  
  // Cache pour indiquer qu'une matière n'a pas de catégories (pour éviter de recharger)
  private readonly noCategoriesCache = signal<Set<string>>(new Set());

  /**
   * Charge les catégories pour plusieurs matières en parallèle
   */
  loadCategoriesForSubjects(subjectIds: string[]): void {
    if (subjectIds.length === 0) {
      return;
    }

    // Filtrer les IDs qui ne sont pas déjà en cache
    const cachedIds = new Set(Object.keys(this.categoriesCache()));
    const noCategoriesIds = this.noCategoriesCache();
    const idsToLoad = subjectIds.filter(id => 
      !cachedIds.has(id) && !noCategoriesIds.has(id)
    );

    if (idsToLoad.length === 0) {
      // Toutes les catégories sont déjà en cache
      return;
    }

    // Créer un tableau d'observables pour charger les catégories
    const categoryObservables = idsToLoad.map(subjectId =>
      this.infrastructure.getCategoriesBySubject(subjectId)
    );

    // Charger toutes les catégories en parallèle
    forkJoin(categoryObservables).subscribe({
      next: (results) => {
        const currentCache = this.categoriesCache();
        const newCache: Record<string, SubjectCategory[]> = { ...currentCache };
        const newNoCategories = new Set(this.noCategoriesCache());
        
        idsToLoad.forEach((subjectId, index) => {
          const result = results[index];
          if (!result.error && result.categories && result.categories.length > 0) {
            newCache[subjectId] = result.categories;
          } else if (!result.error) {
            // Mettre en cache qu'il n'y a pas de catégories pour éviter de recharger
            newNoCategories.add(subjectId);
          }
        });

        this.categoriesCache.set(newCache);
        this.noCategoriesCache.set(newNoCategories);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des catégories:', error);
      }
    });
  }

  /**
   * Récupère les catégories pour une matière depuis le cache
   */
  getCategories(subjectId: string): SubjectCategory[] | null {
    return this.categoriesCache()[subjectId] || null;
  }

  /**
   * Vérifie si une matière a des catégories (utilise le cache)
   */
  hasCategories(subjectId: string): boolean {
    // Si dans le cache des catégories, vérifier s'il y en a
    const cached = this.categoriesCache()[subjectId];
    if (cached !== undefined) {
      return cached.length > 0;
    }
    
    // Si dans le cache "pas de catégories", retourner false
    if (this.noCategoriesCache().has(subjectId)) {
      return false;
    }
    
    // Non déterminé (pas encore chargé)
    return false;
  }

  /**
   * Charge une seule catégorie et la met en cache
   */
  loadCategory(subjectId: string): Observable<{ categories: SubjectCategory[]; error: PostgrestError | null }> {
    // Si déjà en cache, retourner depuis le cache
    const cached = this.categoriesCache()[subjectId];
    if (cached !== undefined) {
      return new Observable(observer => {
        observer.next({ categories: cached, error: null });
        observer.complete();
      });
    }

    // Si on sait qu'il n'y a pas de catégories, retourner vide
    if (this.noCategoriesCache().has(subjectId)) {
      return new Observable(observer => {
        observer.next({ categories: [], error: null });
        observer.complete();
      });
    }

    // Charger et mettre en cache
    return this.infrastructure.getCategoriesBySubject(subjectId).pipe(
      map((result) => {
        if (!result.error && result.categories) {
          const currentCache = this.categoriesCache();
          const newCache = { ...currentCache };
          
          if (result.categories.length > 0) {
            newCache[subjectId] = result.categories;
            this.categoriesCache.set(newCache);
          } else {
            // Aucune catégorie, ajouter au cache "pas de catégories"
            const newNoCategories = new Set(this.noCategoriesCache());
            newNoCategories.add(subjectId);
            this.noCategoriesCache.set(newNoCategories);
          }
        }
        return result;
      })
    );
  }

  /**
   * Efface le cache des catégories
   */
  clearCache(): void {
    this.categoriesCache.set({});
    this.noCategoriesCache.set(new Set());
  }

  /**
   * Met à jour le cache manuellement (utile après création/suppression)
   */
  updateCache(subjectId: string, categories: SubjectCategory[]): void {
    const currentCache = this.categoriesCache();
    const newCache = { ...currentCache };
    const newNoCategories = new Set(this.noCategoriesCache());
    
    if (categories.length > 0) {
      newCache[subjectId] = categories;
      newNoCategories.delete(subjectId);
    } else {
      delete newCache[subjectId];
      newNoCategories.add(subjectId);
    }
    
    this.categoriesCache.set(newCache);
    this.noCategoriesCache.set(newNoCategories);
  }
}

