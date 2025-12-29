import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { CustomAuthService } from '../services/auth/custom-auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Vérifier si l'authentification personnalisée est activée
  if (!environment.customAuthEnabled) {
    return next(req);
  }

  // Injecter CustomAuthService
  const authService = inject(CustomAuthService);

  // Récupérer le token
  const token = authService.getToken();

  // Si on a un token et que la requête est vers Supabase (pas les Edge Functions auth)
  // Les Edge Functions auth n'ont pas besoin du token dans Authorization car elles utilisent apikey
  if (token && req.url.includes(environment.supabaseUrl) && !req.url.includes('/functions/v1/')) {
    const user = authService.getCurrentUser();
    
    // Préparer les headers
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    
    // Cloner la requête avec les headers
    const clonedReq = req.clone({
      setHeaders: headers,
    });

    // Si on a un utilisateur, appeler set_current_user_id() AVANT la requête principale
    // Cela garantit que la variable de session est définie pour la requête suivante
    if (user) {
      // Appeler set_current_user_id() de manière synchrone avant la requête principale
      // Utiliser from() pour convertir la Promise en Observable et switchMap pour attendre
      const setUserSessionCall = fetch(`${environment.supabaseUrl}/rest/v1/rpc/set_current_user_id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': environment.supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id_param: user.id }),
      });

      // Attendre que set_current_user_id() soit terminé avant d'envoyer la requête principale
      return from(setUserSessionCall).pipe(
        switchMap(() => next(clonedReq))
      );
    }

    return next(clonedReq);
  }

  return next(req);
};

