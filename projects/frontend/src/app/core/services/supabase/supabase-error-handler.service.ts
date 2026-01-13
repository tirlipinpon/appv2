import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ChildAuthService } from '../../auth/child-auth.service';

/**
 * Service pour gérer les erreurs Supabase de manière centralisée
 * 
 * Rôle : Détecte les erreurs d'authentification (401, 403) et déconnecte automatiquement l'enfant.
 * Utilisé par SupabaseService pour intercepter les erreurs après chaque requête Supabase.
 * 
 * Flux : Erreur 401/403 → Détection → Déconnexion → Redirection vers /login
 */
@Injectable({
  providedIn: 'root',
})
export class SupabaseErrorHandlerService {
  private readonly authService = inject(ChildAuthService);
  private readonly router = inject(Router);
  private isHandlingError = false; // Éviter les boucles infinies lors de la gestion d'erreurs

  /**
   * Vérifie si une erreur est une erreur d'authentification (401 ou 403)
   * 
   * Vérifie :
   * - Le status HTTP (401, 403)
   * - Le code PostgrestError (PGRST301, PGRST302)
   * - Le message d'erreur (contient "unauthorized", "forbidden", "jwt", "token")
   * 
   * @param error - Erreur à vérifier
   * @returns true si c'est une erreur d'authentification, false sinon
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
   * 
   * IMPORTANT: On déconnecte toujours sur 401/403 car ces erreurs indiquent que le serveur
   * rejette le token. Même si le token n'a pas expiré localement, il peut avoir été révoqué
   * côté serveur (suspension de compte, changement de politique de sécurité, etc.).
   * Si c'était une erreur temporaire (réseau), l'utilisateur pourra simplement se reconnecter.
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
      console.error('Erreur d\'authentification détectée (401/403). Déconnexion automatique:', {
        status: error?.status,
        code: error?.code,
        message: error?.message,
        error,
      });

      // Toujours déconnecter sur 401/403 car ces erreurs indiquent que le serveur rejette le token
      // Même si le token n'a pas expiré localement, il peut avoir été révoqué côté serveur
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
    } catch (handlerError) {
      console.error('Erreur lors de la gestion de l\'erreur d\'authentification:', handlerError);
      // Même en cas d'erreur lors de la déconnexion, essayer de rediriger vers login
      try {
        const currentUrl = this.router.url;
        if (!currentUrl.includes('/login')) {
          this.router.navigate(['/login'], {
            queryParams: {
              reason: 'session_expired',
            },
          });
        }
      } catch (navError) {
        console.error('Impossible de rediriger vers /login:', navError);
      }
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
