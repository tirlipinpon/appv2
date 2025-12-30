import { Injectable, inject, Injector } from '@angular/core';
import { TeacherStore } from '../../../features/teacher/store/index';
import { ParentStore } from '../../../features/parent/store/index';
import { TeacherUpdate } from '../../../features/teacher/types/teacher';
import { ParentUpdate } from '../../../features/parent/types/parent';
import { AuthService } from '../auth/auth.service';

/**
 * Interface pour les champs communs entre Teacher et Parent
 */
export interface CommonProfileFields {
  fullname?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileSyncService {
  private readonly injector = inject(Injector);
  
  /**
   * Obtient AuthService de manière lazy pour éviter les dépendances circulaires
   */
  private getAuthService(): AuthService | null {
    try {
      return this.injector.get(AuthService, null);
    } catch {
      return null;
    }
  }

  /**
   * Obtient TeacherStore de manière lazy pour éviter les dépendances circulaires
   */
  private getTeacherStore() {
    try {
      return this.injector.get(TeacherStore, null);
    } catch {
      return null;
    }
  }

  /**
   * Obtient ParentStore de manière lazy pour éviter les dépendances circulaires
   */
  private getParentStore() {
    try {
      return this.injector.get(ParentStore, null);
    } catch {
      return null;
    }
  }

  /**
   * Extrait les champs communs d'une mise à jour Teacher ou Parent
   */
  getCommonFields(data: TeacherUpdate | ParentUpdate): CommonProfileFields | null {
    const commonFields: CommonProfileFields = {};
    let hasCommonFields = false;

    if ('fullname' in data && data.fullname !== undefined) {
      commonFields.fullname = data.fullname;
      hasCommonFields = true;
    }

    if ('phone' in data && data.phone !== undefined) {
      commonFields.phone = data.phone;
      hasCommonFields = true;
    }

    if ('avatar_url' in data && data.avatar_url !== undefined) {
      commonFields.avatar_url = data.avatar_url;
      hasCommonFields = true;
    }

    return hasCommonFields ? commonFields : null;
  }

  /**
   * Synchronise les champs communs de Teacher vers Parent
   * Met à jour le ParentStore directement (sans appel backend)
   */
  syncTeacherToParent(commonFields: CommonProfileFields): void {
    const parentStore = this.getParentStore();
    if (!parentStore) {
      return;
    }

    const currentParent = parentStore.parent();
    if (!currentParent) {
      // Si le parent n'est pas encore chargé, on ne peut pas synchroniser
      // La synchronisation se fera lors du prochain chargement
      return;
    }

    // Mettre à jour le store parent avec les champs communs
    // On utilise setParent pour mettre à jour directement sans appel backend
    const updatedParent: typeof currentParent = {
      ...currentParent,
      ...commonFields,
    };

    parentStore.setParent(updatedParent);
  }

  /**
   * Synchronise les champs communs de Parent vers Teacher
   * Met à jour le TeacherStore directement (sans appel backend)
   */
  syncParentToTeacher(commonFields: CommonProfileFields): void {
    const teacherStore = this.getTeacherStore();
    if (!teacherStore) {
      return;
    }

    const currentTeacher = teacherStore.teacher();
    if (!currentTeacher) {
      // Si le teacher n'est pas encore chargé, on ne peut pas synchroniser
      // La synchronisation se fera lors du prochain chargement
      return;
    }

    // Mettre à jour le store teacher avec les champs communs
    // On utilise setTeacher pour mettre à jour directement sans appel backend
    const updatedTeacher: typeof currentTeacher = {
      ...currentTeacher,
      ...commonFields,
    };

    teacherStore.setTeacher(updatedTeacher);
  }

  /**
   * Synchronise automatiquement selon le rôle actif
   * Utilisé après une mise à jour réussie
   * @param role Le rôle qui a effectué la mise à jour
   * @param updates Les mises à jour effectuées
   */
  syncAfterUpdate(role: 'prof' | 'parent', updates: TeacherUpdate | ParentUpdate): void {
    // Obtenir AuthService de manière lazy pour éviter les dépendances circulaires
    const authService = this.getAuthService();
    if (!authService) {
      return;
    }

    // Vérifier si l'utilisateur a les deux rôles
    const profile = authService.getCurrentProfile();
    if (!profile) {
      return;
    }

    const hasBothRoles = profile.roles.includes('prof') && profile.roles.includes('parent');
    if (!hasBothRoles) {
      return;
    }

    const commonFields = this.getCommonFields(updates);
    if (!commonFields) {
      return;
    }

    if (role === 'prof') {
      this.syncTeacherToParent(commonFields);
    } else if (role === 'parent') {
      this.syncParentToTeacher(commonFields);
    }
  }
}

