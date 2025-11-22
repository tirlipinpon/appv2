import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../../../shared/services/auth/auth.service';
import { from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Vérifier d'abord si l'utilisateur est déjà chargé (cas synchrone)
  const currentUser = authService.getCurrentUser();
  if (currentUser) {
    return true;
  }

  // Sinon, vérifier la session de manière asynchrone
  // Cela garantit que la session est vérifiée même lors d'un reload
  return from(authService.getSession()).pipe(
    map(session => {
      if (session?.user) {
        // La session existe, autoriser l'accès
        // Le BehaviorSubject sera mis à jour par initializeAuth() de manière asynchrone
        return true;
      }
      // Pas de session, rediriger vers login
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }),
    catchError(() => {
      // En cas d'erreur, vérifier une dernière fois de manière synchrone
      const user = authService.getCurrentUser();
      if (user) {
        return of(true);
      }
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return of(false);
    })
  );
};
