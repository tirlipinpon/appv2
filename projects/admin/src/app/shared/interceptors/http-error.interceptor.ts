import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ErrorHandlerService } from '../services/error/error-handler.service';
import { ErrorSnackbarService } from '../services/snackbar/error-snackbar.service';

/**
 * Intercepteur HTTP pour capturer toutes les erreurs HTTP
 * 
 * Rôle : Normalise les erreurs HTTP et les affiche via ErrorSnackbarService.
 * S'exécute automatiquement pour toutes les requêtes HTTP de l'application admin.
 * 
 * Flux : Erreur HTTP → Normalisation → Affichage snackbar → Propagation
 * 
 * Codes HTTP gérés :
 * - 0 : Connexion impossible
 * - 400 : Requête invalide
 * - 401 : Non authentifié (redirection vers /login gérée par authGuard)
 * - 403 : Permissions insuffisantes
 * - 404 : Ressource non trouvée
 * - 500 : Erreur serveur
 * - 503 : Service indisponible
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorHandler = inject(ErrorHandlerService);
  const errorSnackbar = inject(ErrorSnackbarService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Construire un message d'erreur convivial selon le status
      let errorMessage = `Erreur HTTP ${error.status}`;
      
      if (error.error) {
        // Si l'erreur contient un message, l'utiliser
        if (typeof error.error === 'string') {
          errorMessage = error.error;
        } else if (error.error.message) {
          errorMessage = error.error.message;
        } else if (error.error.error) {
          errorMessage = error.error.error;
        }
      }

      // Messages spécifiques selon les codes HTTP
      switch (error.status) {
        case 0:
          errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
          break;
        case 400:
          errorMessage = errorMessage || 'Requête invalide';
          break;
        case 401:
          errorMessage = 'Vous n\'êtes pas authentifié. Veuillez vous reconnecter.';
          break;
        case 403:
          errorMessage = 'Vous n\'avez pas les permissions nécessaires pour cette action.';
          break;
        case 404:
          errorMessage = 'Ressource non trouvée';
          break;
        case 500:
          errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
          break;
        case 503:
          errorMessage = 'Service temporairement indisponible. Veuillez réessayer plus tard.';
          break;
      }

      // Normaliser l'erreur
      const normalized = errorHandler.normalize(
        {
          message: errorMessage,
          status: error.status,
          code: error.status?.toString(),
          name: 'HttpErrorResponse'
        },
        'Erreur lors de la communication avec le serveur'
      );

      // Logger l'erreur pour le debugging
      console.error('Erreur HTTP interceptée:', {
        url: req.url,
        method: req.method,
        status: error.status,
        message: normalized.message,
        error: error.error
      });

      // Afficher dans la snackbar
      errorSnackbar.showError(normalized.message);

      // Propager l'erreur normalisée pour que les composants puissent aussi la gérer
      return throwError(() => normalized);
    })
  );
};

