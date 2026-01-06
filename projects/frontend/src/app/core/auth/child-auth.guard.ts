import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ChildAuthService } from './child-auth.service';

/**
 * Guard qui protège les routes nécessitant une authentification enfant
 * Valide la session de manière complète (présence, expiration, validité JWT)
 */
export const childAuthGuard: CanActivateFn = async () => {
  const authService = inject(ChildAuthService);
  const router = inject(Router);

  // Utiliser isSessionValid() pour une validation robuste
  const isValid = await authService.isSessionValid();

  if (isValid) {
    return true;
  }

  // Session invalide ou expirée, nettoyer et rediriger vers la page de connexion
  await authService.logout();
  router.navigate(['/login'], {
    queryParams: {
      reason: 'session_expired',
    },
  });
  return false;
};

