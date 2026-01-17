import { inject, Injectable } from '@angular/core';
import { SubjectsStore } from '../../store/index';
import { ChildAuthService } from '../../../../core/auth/child-auth.service';
import { SubjectsInfrastructure } from '../infrastructure/infrastructure';

@Injectable({
  providedIn: 'root',
})
export class SubjectsApplication {
  private readonly store = inject(SubjectsStore);
  private readonly authService = inject(ChildAuthService);
  private readonly infrastructure = inject(SubjectsInfrastructure);

  async initialize(): Promise<void> {
    const child = this.authService.getCurrentChild();
    if (child) {
      this.store.setChildId(child.child_id);
    }
    await this.store.loadSubjects();
  }

  async selectSubject(subjectId: string): Promise<void> {
    await this.store.selectSubject(subjectId);
    
    // Charger la progression pour les catégories et la matière
    const child = await this.authService.getCurrentChild();
    if (child) {
      const categories = this.store.categories();
      const categoryIds = categories.map((c: { id: string }) => c.id);
      if (categoryIds.length > 0) {
        await this.store.loadProgress({ childId: child.child_id, categoryIds });
      }
      
      // Charger la progression de la matière principale
      await this.store.loadSubjectProgress(subjectId);
    }
  }

  getSubjects() {
    return this.store.subjects;
  }

  getSelectedSubject() {
    return this.store.selectedSubject;
  }

  getCategories() {
    return this.store.categories;
  }

  isLoading() {
    return this.store.loading;
  }

  getError() {
    return this.store.error;
  }

  resetSelection(): void {
    this.store.resetSelection();
  }

  /**
   * Calcule le total d'étoiles pour une matière (matière + sous-matières)
   */
  calculateSubjectTotalStars(subjectId: string): number {
    const subjectProgress = this.store.getSubjectProgress(subjectId);
    const categories = this.store.categories();
    
    // Étoiles de la matière principale
    let totalStars = subjectProgress?.stars_count ?? 0;
    
    // Ajouter les étoiles des sous-matières
    categories.forEach(category => {
      if (category.progress) {
        totalStars += category.progress.stars_count ?? 0;
      }
    });
    
    return totalStars;
  }

  /**
   * Retourne la progression d'une matière
   */
  getSubjectProgress(subjectId: string) {
    return this.store.getSubjectProgress(subjectId);
  }

  /**
   * Charge les progressions de toutes les matières
   */
  async loadAllSubjectsProgress(): Promise<void> {
    const child = this.authService.getCurrentChild();
    if (!child) return;

    const subjects = this.store.subjects();
    const subjectIds = subjects.map(s => s.id);
    
    if (subjectIds.length > 0) {
      await this.store.loadSubjectsProgress(subjectIds);
    }
  }

  /**
   * Charge les progressions de toutes les catégories de toutes les matières
   */
  async loadAllCategoriesProgress(): Promise<void> {
    const child = this.authService.getCurrentChild();
    if (!child) return;

    const subjects = this.store.subjects();
    
    // Charger toutes les catégories et leurs progressions
    const allCategoryIds: string[] = [];
    
    for (const subject of subjects) {
      try {
        const categories = await this.infrastructure.loadSubjectCategories(subject.id, child.child_id);
        const categoryIds = categories.map((c: { id: string }) => c.id);
        allCategoryIds.push(...categoryIds);
      } catch (error) {
        console.error(`Erreur lors du chargement des catégories pour la matière ${subject.id}:`, error);
      }
    }
    
    // Charger toutes les progressions en une seule fois
    if (allCategoryIds.length > 0) {
      await this.store.loadProgress({ childId: child.child_id, categoryIds: allCategoryIds });
    }
  }
}

