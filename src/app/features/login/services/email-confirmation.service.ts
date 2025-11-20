import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../shared/services/supabase/supabase.service';
import { ProfileService } from '../../../core/auth/profile/profile.service';
import { AuthCoreService } from '../../../core/auth/core/auth-core.service';
import type { User } from '@supabase/supabase-js';

export interface ConfirmationResult {
  success: boolean;
  user: User | null;
  error: Error | null;
}

/**
 * Service responsable de la confirmation des emails
 * Principe SRP : Gère uniquement la confirmation d'email
 */
@Injectable({
  providedIn: 'root',
})
export class EmailConfirmationService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly profileService = inject(ProfileService);
  private readonly authCoreService = inject(AuthCoreService);

  async confirmWithTokens(accessToken: string, refreshToken: string): Promise<ConfirmationResult> {
    try {
      const { user, error } = await this.authCoreService.setSession(accessToken, refreshToken);

      if (error || !user) {
        return { 
          success: false, 
          user: null, 
          error: error || new Error('Erreur lors de la confirmation')
        };
      }

      await this.handleUserConfirmed(user);
      return { success: true, user, error: null };
    } catch (error) {
      return { 
        success: false, 
        user: null, 
        error: error instanceof Error ? error : new Error('Erreur inattendue')
      };
    }
  }

  async confirmWithTokenHash(tokenHash: string): Promise<ConfirmationResult> {
    try {
      // verifyOtp avec token_hash n'accepte que 'email' comme type
      const { data, error } = await this.supabaseService.client.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'email' as const
      });

      if (error || !data.user) {
        return { 
          success: false, 
          user: null, 
          error: error ? new Error(error.message) : new Error('Erreur lors de la confirmation')
        };
      }

      await this.handleUserConfirmed(data.user);
      return { success: true, user: data.user, error: null };
    } catch (error) {
      return { 
        success: false, 
        user: null, 
        error: error instanceof Error ? error : new Error('Erreur inattendue')
      };
    }
  }

  private async handleUserConfirmed(user: User): Promise<void> {
    const roles = (user.user_metadata?.['roles'] as string[] | undefined) || [];
    
    if (roles.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.profileService.createProfileWithRoles(user.id, roles);
    }

    await this.profileService.getProfile();
  }
}
