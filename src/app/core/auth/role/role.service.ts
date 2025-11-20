import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../../../services/supabase/supabase.service';
import { ProfileService } from '../profile/profile.service';
import { AuthCoreService } from '../core/auth-core.service';

/**
 * Service responsable de la gestion des rôles utilisateurs
 * Principe SRP : Gère uniquement les rôles
 */
@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly profileService = inject(ProfileService);
  private readonly authCoreService = inject(AuthCoreService);
  
  private activeRoleSignal = signal<string | null>(null);
  public activeRole$ = computed(() => this.activeRoleSignal());

  async addRoleToProfile(newRole: string): Promise<{ success: boolean; error: Error | null }> {
    const user = this.authCoreService.getCurrentUser();
    
    if (!user) {
      return { success: false, error: new Error('User not authenticated') };
    }

    try {
      const { error } = await this.supabaseService.client
        .rpc('add_role_to_profile', {
          user_id: user.id,
          new_role: newRole
        });

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      await this.profileService.getProfile();
      return { success: true, error: null };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Erreur lors de l\'ajout du rôle')
      };
    }
  }

  setActiveRole(role: string): boolean {
    const profile = this.profileService.getCurrentProfile();
    if (profile && profile.roles.includes(role)) {
      this.activeRoleSignal.set(role);
      return true;
    }
    return false;
  }

  getActiveRole(): string | null {
    return this.activeRoleSignal();
  }

  hasRole(role: string): boolean {
    const profile = this.profileService.getCurrentProfile();
    return profile ? profile.roles.includes(role) : false;
  }

  hasMultipleRoles(): boolean {
    const profile = this.profileService.getCurrentProfile();
    return profile ? profile.roles.length > 1 : false;
  }

  clearActiveRole(): void {
    this.activeRoleSignal.set(null);
  }

  autoSelectRole(): void {
    const profile = this.profileService.getCurrentProfile();
    if (profile && profile.roles.length === 1) {
      this.activeRoleSignal.set(profile.roles[0]);
    }
  }
}
