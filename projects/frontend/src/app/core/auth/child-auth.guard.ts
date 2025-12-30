import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ChildAuthService } from './child-auth.service';

export const childAuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(ChildAuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Rediriger vers la page de connexion
  router.navigate(['/login']);
  return false;
};

