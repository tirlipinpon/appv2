import { Injectable, inject } from '@angular/core';
import { ChildStore } from '../../store/index';
import { Infrastructure } from '../infrastructure/infrastructure';
import type { Child } from '../../types/child';

@Injectable({
  providedIn: 'root',
})
export class Application {
  private readonly store = inject(ChildStore);
  private readonly infrastructure = inject(Infrastructure);

  /**
   * Charge tous les enfants
   */
  loadChildren(): void {
    this.store.loadChildren();
  }

  /**
   * Charge un enfant par son ID
   */
  loadChildById(childId: string): void {
    this.store.loadChildById(childId);
  }

  /**
   * Met à jour le profil enfant
   */
  updateChildProfile(childId: string, updates: Partial<{ firstname: string | null; lastname: string | null; birthdate: string | null; gender: string | null; school_level: string | null; notes: string | null; avatar_url: string | null; avatar_seed: string | null; avatar_style: string | null; login_pin: string | null }>): void {
    this.store.updateChildProfile({ childId, updates: updates as Partial<Child> });
  }

  /**
   * Vérifie l'unicité de la paire (avatar_seed, login_pin)
   * Retourne un Observable pour permettre l'attente du résultat
   */
  checkAvatarPinUniqueness(avatarSeed: string | null, loginPin: string | null, excludeChildId?: string) {
    return this.infrastructure.checkAvatarPinUniqueness(avatarSeed, loginPin, excludeChildId);
  }

  /**
   * Crée un profil enfant
   */
  createChildProfile(profileData: Omit<Child, 'id' | 'parent_id' | 'created_at' | 'updated_at' | 'is_active'>): void {
    this.store.createChildProfile(profileData);
  }

  /**
   * Définit le statut actif d'un enfant (activate/désactivate)
   */
  setChildActiveStatus(childId: string, isActive: boolean): void {
    this.store.setChildActiveStatus({ childId, isActive });
  }
}

