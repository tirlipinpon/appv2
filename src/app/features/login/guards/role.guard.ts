import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';
import { map, take } from 'rxjs/operators';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRole = route.data['role'] as string;

  return authService.currentProfile$.pipe(
    take(1),
    map(profile => {
      if (!profile) {
        router.navigate(['/login']);
        return false;
      }

      // Vérifier que l'utilisateur a le rôle requis
      if (!profile.roles.includes(requiredRole)) {
        router.navigate(['/dashboard']);
        return false;
      }

      // Vérifier que le rôle actif correspond au rôle requis
      const activeRole = authService.getActiveRole();
      if (activeRole !== requiredRole) {
        // Si l'utilisateur a plusieurs rôles mais aucun n'est sélectionné, rediriger vers le sélecteur
        if (authService.hasMultipleRoles() && !activeRole) {
          router.navigate(['/select-role']);
          return false;
        }
        // Si le rôle actif ne correspond pas, rediriger vers le sélecteur
        router.navigate(['/select-role']);
        return false;
      }

      return true;
    })
  );
};
