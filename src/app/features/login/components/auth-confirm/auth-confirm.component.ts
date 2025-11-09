import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../services/auth/auth.service';
import { SupabaseService } from '../../../../services/supabase/supabase.service';
import type { User } from '@supabase/supabase-js';

@Component({
  selector: 'app-auth-confirm',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-confirm.component.html',
  styleUrl: './auth-confirm.component.scss'
})
export class AuthConfirmComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  isLoading = true;
  isSuccess = false;
  errorMessage: string | null = null;

  async ngOnInit() {
    // Supabase peut rediriger avec des fragments (#) ou des query params (?)
    // Gérer les deux cas
    
    // Récupérer les fragments de l'URL (access_token, refresh_token, etc.)
    const hash = window.location.hash.substring(1); // Enlever le #
    const hashParams = new URLSearchParams(hash);
    
    // Récupérer aussi les query params au cas où
    const queryParams = this.route.snapshot.queryParams;
    
    // Vérifier si on a un access_token dans les fragments (méthode Supabase standard)
    const accessToken = hashParams.get('access_token') || queryParams['access_token'];
    const refreshToken = hashParams.get('refresh_token') || queryParams['refresh_token'];
    const type = hashParams.get('type') || queryParams['type'] || 'signup';
    
    // Si on a un access_token, c'est une redirection Supabase standard
    if (accessToken) {
      try {
        // Utiliser setSession pour établir la session avec les tokens
        const { data, error } = await this.supabaseService.client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });

        if (error) {
          this.errorMessage = error.message || 'Erreur lors de la confirmation de l\'email';
          this.isLoading = false;
          return;
        }

        if (data.user) {
          // Email confirmé avec succès
          await this.handleUserConfirmed(data.user);
        }
      } catch (error: unknown) {
        this.handleUnexpectedError(error, 'Une erreur est survenue lors de la confirmation');
      }
      return;
    }

    // Sinon, essayer avec token_hash (ancienne méthode)
    const tokenHash = queryParams['token_hash'] || hashParams.get('token_hash');
    
    if (!tokenHash) {
      this.errorMessage = 'Token de confirmation manquant';
      this.isLoading = false;
      return;
    }

    try {
      // Confirmer l'email avec le token_hash
      const { data, error } = await this.supabaseService.client.auth.verifyOtp({
        token_hash: tokenHash,
        type: type || 'email'
      });

      if (error) {
        this.errorMessage = error.message || 'Erreur lors de la confirmation de l\'email';
        this.isLoading = false;
        return;
      }

      if (data.user) {
        // Email confirmé avec succès
        await this.handleUserConfirmed(data.user);
      }
    } catch (error: unknown) {
      this.handleUnexpectedError(error, 'Une erreur est survenue lors de la confirmation');
    }
  }

  private async handleUserConfirmed(user: User) {
    console.group('🟣 [AUTH-CONFIRM] handleUserConfirmed() - START');
    console.log('📥 User object:', {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata
    });
    
    // Maintenant que l'utilisateur est confirmé, créer le profil avec les rôles
    // Les rôles sont stockés dans user.user_metadata.roles
    const roles = (user.user_metadata?.['roles'] as string[] | undefined) || [];
    
    console.log('🔍 [AUTH-CONFIRM] Extracted roles:', {
      roles: user.user_metadata?.['roles'],
      rolesType: typeof roles,
      rolesIsArray: Array.isArray(roles),
      rolesLength: roles.length,
      userMetadataRoles: user.user_metadata?.['roles'],
      fullUserMetadata: user.user_metadata
    });
    
    if (roles.length > 0) {
      try {
        // Attendre un peu pour s'assurer que le trigger a créé le profil
        console.log('⏳ [AUTH-CONFIRM] Waiting 500ms for trigger...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('🚀 [AUTH-CONFIRM] Calling createProfileWithRoles...');
        const { profile, error: profileError } = await this.authService.createProfileWithRoles(
          user.id,
          roles
        );

        console.log('📥 [AUTH-CONFIRM] createProfileWithRoles result:', { profile, profileError });

        if (profileError) {
          console.error('❌ [AUTH-CONFIRM] Error creating profile with roles:', profileError);
          // Le profil existe peut-être déjà (créé par le trigger), on continue quand même
        } else {
          console.log('✅ [AUTH-CONFIRM] Profile created/updated successfully:', profile);
        }
      } catch (error) {
        console.error('💥 [AUTH-CONFIRM] Exception in handleUserConfirmed:', error);
        // Continuer même en cas d'erreur
      }
    } else {
      console.warn('⚠️ [AUTH-CONFIRM] No roles found in user_metadata!');
    }

    this.isSuccess = true;
    this.isLoading = false;

    // Recharger le profil pour avoir les rôles à jour
    console.log('🔄 [AUTH-CONFIRM] Reloading profile...');
    const finalProfile = await this.authService.getProfile();
    console.log('📥 [AUTH-CONFIRM] Final profile after reload:', finalProfile);
    console.groupEnd();

    // Nettoyer l'URL en enlevant les fragments
    window.history.replaceState(null, '', window.location.pathname);

    // Rediriger vers la page de connexion après 2 secondes
    setTimeout(() => {
      this.router.navigate(['/login'], {
        queryParams: {
          message: 'Votre email a été confirmé avec succès ! Vous pouvez maintenant vous connecter.'
        }
      });
    }, 2000);
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  private handleUnexpectedError(error: unknown, fallbackMessage: string) {
    const derivedMessage =
      error instanceof Error ? error.message : fallbackMessage;
    this.errorMessage = derivedMessage || fallbackMessage;
    this.isLoading = false;
  }
}
