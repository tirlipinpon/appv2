import { Injectable, inject } from '@angular/core';
import { ParentStore } from '../../store/index';
import { Infrastructure } from '../infrastructure/infrastructure';
import type { Parent } from '../../types/parent';

@Injectable({
  providedIn: 'root',
})
export class Application {
  private readonly store = inject(ParentStore);
  private readonly infrastructure = inject(Infrastructure);

  /**
   * Charge le profil parent
   */
  loadParentProfile(): void {
    this.store.loadParentProfile();
  }

  /**
   * Met à jour le profil parent
   */
  updateParentProfile(updates: Partial<{ fullname: string | null; phone: string | null; address: string | null; city: string | null; country: string | null; preferences: Record<string, unknown>; avatar_url: string | null }>): void {
    this.store.updateParentProfile(updates as Partial<Parent>);
  }

  /**
   * Crée un profil parent
   */
  createParentProfile(profileData: Omit<Parent, 'id' | 'profile_id' | 'created_at' | 'updated_at'>): void {
    this.store.createParentProfile(profileData);
  }
}

