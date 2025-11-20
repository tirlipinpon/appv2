import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../services/supabase/supabase.service';
import { AuthCoreService } from '../core/auth-core.service';
import { ProfileService } from '../profile/profile.service';

/**
 * Service responsable de la gestion des mots de passe
 * Principe SRP : Gère uniquement les opérations liées aux mots de passe
 */
@Injectable({
  providedIn: 'root',
})
export class PasswordService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authCoreService = inject(AuthCoreService);
  private readonly profileService = inject(ProfileService);

  async requestPasswordReset(email: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const redirectUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/reset` 
        : undefined;
      
      const { error } = await this.supabaseService.client.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, error: null };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Erreur lors de la demande de réinitialisation')
      };
    }
  }

  async updatePassword(newPassword: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await this.supabaseService.client.auth.updateUser({ 
        password: newPassword 
      });

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      const { data } = await this.supabaseService.client.auth.getSession();
      if (data.session) {
        await this.profileService.getProfile();
      }

      return { success: true, error: null };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Erreur lors de la mise à jour du mot de passe')
      };
    }
  }
}
