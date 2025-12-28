import { Injectable, inject, signal } from '@angular/core';
import { ParentStore } from '../../../features/parent/store/index';
import { ChildrenStore } from '../../store/children.store';
import { TeacherStore } from '../../../features/teacher/store/index';
import { TeacherAssignmentStore } from '../../../features/teacher/store/assignments.store';
import { SchoolsStore } from '../../store/schools.store';
import { GameTypesStore } from '../../store/game-types.store';

@Injectable({
  providedIn: 'root',
})
export class AppInitializationService {
  private readonly parentStore = inject(ParentStore);
  private readonly childrenStore = inject(ChildrenStore);
  private readonly teacherStore = inject(TeacherStore);
  private readonly teacherAssignmentStore = inject(TeacherAssignmentStore);
  private readonly schoolsStore = inject(SchoolsStore);
  private readonly gameTypesStore = inject(GameTypesStore);

  // Track l'état d'initialisation par rôle
  private readonly initializedRoles = signal<Set<string>>(new Set());

  /**
   * Initialise les données essentielles pour un rôle donné
   */
  initializeForRole(role: string): void {
    // Si déjà initialisé, ne pas recharger
    if (this.isInitialized(role)) {
      return;
    }

    if (role === 'parent') {
      this.initializeForParent();
    } else if (role === 'prof') {
      this.initializeForTeacher();
    }

    // Marquer comme initialisé
    const current = new Set(this.initializedRoles());
    current.add(role);
    this.initializedRoles.set(current);
  }

  /**
   * Initialise les données pour le rôle parent
   */
  private initializeForParent(): void {
    // Charger en parallèle les données essentielles
    this.parentStore.loadParentProfile();
    this.childrenStore.loadChildren();
    // Le statut parent sera vérifié après le chargement du profil
    // via un effect dans le composant ou après le chargement
  }

  /**
   * Initialise les données pour le rôle prof
   */
  private initializeForTeacher(): void {
    // Charger en parallèle les données essentielles
    this.teacherStore.loadTeacherProfile();
    this.schoolsStore.loadSchools();
    this.gameTypesStore.loadGameTypes();
    
    // Les affectations seront chargées après que le teacher soit chargé
    // via un effect dans le composant ou après le chargement
  }

  /**
   * Vérifie si un rôle est déjà initialisé
   */
  isInitialized(role: string): boolean {
    return this.initializedRoles().has(role);
  }

  /**
   * Force la réinitialisation d'un rôle
   */
  reinitialize(role: string): void {
    // Retirer du set d'initialisation
    const current = new Set(this.initializedRoles());
    current.delete(role);
    this.initializedRoles.set(current);

    // Réinitialiser les stores concernés
    if (role === 'parent') {
      // Les stores se réinitialiseront lors du prochain chargement
      // On peut aussi appeler clearCache si les stores ont cette méthode
    } else if (role === 'prof') {
      // Idem
    }

    // Réinitialiser
    this.initializeForRole(role);
  }

  /**
   * Vide le cache pour un rôle
   */
  clearCache(role: string): void {
    // Retirer du set d'initialisation
    const current = new Set(this.initializedRoles());
    current.delete(role);
    this.initializedRoles.set(current);

    // Les stores gardent leurs données en cache
    // mais seront rechargés au prochain initializeForRole()
  }

  /**
   * Vide tous les caches
   */
  clearAllCaches(): void {
    this.initializedRoles.set(new Set());
  }

  /**
   * Initialise pour tous les rôles d'un profil
   * @param roles Liste des rôles à initialiser
   */
  initializeForAllRoles(roles: string[]): void {
    if (!roles || roles.length === 0) {
      return;
    }

    // Initialiser pour chaque rôle
    roles.forEach(role => {
      this.initializeForRole(role);
    });
  }
}

