import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-auth-confirm',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-confirm.html',
  styleUrl: './auth-confirm.scss'
})
export class AuthConfirmComponent implements OnInit {
  isLoading = true;
  isSuccess = false;
  errorMessage: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    // Récupérer les paramètres de l'URL (token_hash, type et roles)
    const tokenHash = this.route.snapshot.queryParams['token_hash'];
    const type = this.route.snapshot.queryParams['type'];
    const rolesParam = this.route.snapshot.queryParams['roles'];

    if (!tokenHash) {
      this.errorMessage = 'Token de confirmation manquant';
      this.isLoading = false;
      return;
    }

    try {
      // Confirmer l'email avec le token
      // Supabase utilise verifyOtp pour les confirmations d'email
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
        // Maintenant que l'utilisateur est confirmé, créer le profil avec les rôles
        // Les rôles sont stockés dans user.user_metadata.roles
        const roles = data.user.user_metadata?.roles || [];
        
        if (roles.length > 0) {
          try {
            // Attendre un peu pour s'assurer que le trigger a créé le profil
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const { profile, error: profileError } = await this.authService.createProfileWithRoles(
              data.user.id,
              roles
            );

            if (profileError) {
              console.error('Error creating profile with roles:', profileError);
              // Le profil existe peut-être déjà (créé par le trigger), on continue quand même
            }
          } catch (error) {
            console.error('Error setting up profile:', error);
            // Continuer même en cas d'erreur
          }
        }

        this.isSuccess = true;
        this.isLoading = false;

        // Recharger le profil pour avoir les rôles à jour
        await this.authService.getProfile();

        // Rediriger vers la page de connexion après 2 secondes
        setTimeout(() => {
          this.router.navigate(['/login'], {
            queryParams: {
              message: 'Votre email a été confirmé avec succès ! Vous pouvez maintenant vous connecter.'
            }
          });
        }, 2000);
      }
    } catch (error: any) {
      this.errorMessage = error.message || 'Une erreur est survenue lors de la confirmation';
      this.isLoading = false;
    }
  }
}
