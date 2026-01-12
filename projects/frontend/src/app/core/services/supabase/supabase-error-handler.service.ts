import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ChildAuthService } from '../../auth/child-auth.service';

/**
 * Service pour gérer les erreurs Supabase de manière centralisée
 * Détecte les erreurs d'authentification (401, 403) et déconnecte automatiquement
 */
@Injectable({
  providedIn: 'root',
})
export class SupabaseErrorHandlerService {
  private readonly authService = inject(ChildAuthService);
  private readonly router = inject(Router);
  private isHandlingError = false; // Éviter les boucles infinies

  /**
   * Vérifie si une erreur est une erreur d'authentification (401 ou 403)
   */
  isAuthError(error: { status?: number; code?: string; message?: string } | null | undefined): boolean {
    // Vérifier le status HTTP
    if (error?.status === 401 || error?.status === 403) {
      return true;
    }

    // Vérifier le code PostgrestError
    if (error?.code) {
      // PGRST301 = 401 Unauthorized
      // PGRST301 peut aussi être 403 selon le contexte
      const authErrorCodes = ['PGRST301', 'PGRST302'];
      if (authErrorCodes.includes(error.code)) {
        return true;
      }
    }

    // Vérifier le message d'erreur
    if (error?.message) {
      const message = error.message.toLowerCase();
      if (
        message.includes('unauthorized') ||
        message.includes('forbidden') ||
        message.includes('jwt') ||
        message.includes('token')
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gère une erreur Supabase
   * Déconnecte automatiquement et redirige vers login si c'est une erreur d'authentification
   * Vérifie d'abord si la session est vraiment expirée avant de déconnecter
   */
  async handleError(error: { status?: number; code?: string; message?: string } | null | undefined): Promise<void> {
    // Éviter les boucles infinies
    if (this.isHandlingError) {
      return;
    }

    // Vérifier si c'est une erreur d'authentification
    if (!this.isAuthError(error)) {
      // Ce n'est pas une erreur d'authentification, ne rien faire
      return;
    }

    this.isHandlingError = true;

    try {
      // Logger l'erreur pour debugging
      console.error('Erreur d\'authentification détectée:', {
        status: error?.status,
        code: error?.code,
        message: error?.message,
        error,
      });

      // Vérifier si la session est vraiment expirée avant de déconnecter
      // Cela évite de déconnecter sur des erreurs temporaires ou des problèmes réseau
      const isSessionValid = await this.authService.isSessionValid();
      
      if (!isSessionValid) {
        // La session est vraiment expirée, déconnecter proprement
        await this.authService.logout();

        // Rediriger vers login (seulement si pas déjà sur /login)
        const currentUrl = this.router.url;
        if (!currentUrl.includes('/login')) {
          this.router.navigate(['/login'], {
            queryParams: {
              reason: 'session_expired',
            },
          });
        }
      } else {
        // La session est encore valide, c'est probablement une erreur temporaire
        // Ne pas déconnecter, juste logger l'erreur
        console.warn('Erreur 401/403 détectée mais la session est encore valide. Erreur probablement temporaire.');
      }
    } catch (handlerError) {
      console.error('Erreur lors de la gestion de l\'erreur d\'authentification:', handlerError);
    } finally {
      // Réinitialiser le flag après un court délai pour éviter les boucles
      setTimeout(() => {
        this.isHandlingError = false;
      }, 1000);
    }
  }

  /**
   * Gère une erreur PostgrestError spécifique
   */
  async handlePostgrestError(error: { status?: number; code?: string; message?: string } | null | undefined): Promise<void> {
    // PostgrestError peut avoir un code ou un status
    const normalizedError = {
      status: error?.status || (error?.code?.startsWith('PGRST') ? 401 : undefined),
      code: error?.code,
      message: error?.message,
    };

    await this.handleError(normalizedError);
  }
}
