import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
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
  if (token && req.url.includes(environment.supabaseUrl)) {
    // Cloner la requête et ajouter le header Authorization
    const clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    return next(clonedReq);
  }

  return next(req);
};

