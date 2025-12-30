import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService, SupabaseService } from '../../../shared';
import { map, take, switchMap } from 'rxjs/operators';
import { from } from 'rxjs';

/**
 * Guard qui vérifie que l'utilisateur connecté est bien le parent de l'enfant
 * avant d'autoriser l'accès à la route
 */
export const childParentGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  const childId = route.paramMap.get('childId');

  if (!childId) {
    router.navigate(['/dashboard']);
    return false;
  }

  return authService.currentUser$.pipe(
    take(1),
    switchMap(user => {
      if (!user) {
        router.navigate(['/login']);
        return [false];
      }

      // Vérifier si l'utilisateur est le parent de l'enfant
      return from(
        supabaseService.client
          .from('children')
          .select('id, parent_id')
          .eq('id', childId)
          .maybeSingle()
      ).pipe(
        map(({ data: child, error }) => {
          if (error || !child) {
            console.error('Erreur lors de la vérification de l\'enfant:', error);
            router.navigate(['/dashboard']);
            return false;
          }

          if (child.parent_id !== user.id) {
            console.warn(`L'utilisateur ${user.id} n'est pas le parent de l'enfant ${childId}`);
            router.navigate(['/dashboard']);
            return false;
          }

          return true;
        })
      );
    })
  );
};

