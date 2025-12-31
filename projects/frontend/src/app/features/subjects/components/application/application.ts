import { inject, Injectable } from '@angular/core';
import { SubjectsStore } from '../../store/index';
import { ChildAuthService } from '../../../../core/auth/child-auth.service';

@Injectable({
  providedIn: 'root',
})
export class SubjectsApplication {
  private readonly store = inject(SubjectsStore);
  private readonly authService = inject(ChildAuthService);

  async initialize(): Promise<void> {
    const child = this.authService.getCurrentChild();
    if (child) {
      this.store.setChildId(child.child_id);
    }
    await this.store.loadSubjects();
  }

  async selectSubject(subjectId: string): Promise<void> {
    await this.store.selectSubject(subjectId);
    
    // Charger la progression pour les catégories
    const child = await this.authService.getCurrentChild();
    if (child) {
      const categories = this.store.categories();
      const categoryIds = categories.map((c: { id: string }) => c.id);
      if (categoryIds.length > 0) {
        await this.store.loadProgress({ childId: child.child_id, categoryIds });
      }
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
}

