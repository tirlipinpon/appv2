import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ErrorHandlerService } from './error-handler.service';
import { ErrorSnackbarService } from '../snackbar/error-snackbar.service';

/**
 * Gestionnaire d'erreurs global pour Angular
 * Capture toutes les erreurs non gérées dans l'application :
 * - Erreurs dans les composants
 * - Erreurs dans les services
 * - Erreurs runtime Angular
 * - Erreurs de promesses non catchées
 */
@Injectable({
  providedIn: 'root'
})
export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly errorSnackbar = inject(ErrorSnackbarService);

  handleError(error: unknown): void {
    // Normaliser l'erreur
    const normalized = this.errorHandler.normalize(
      error,
      'Une erreur inattendue est survenue'
    );

    // Logger l'erreur pour le debugging
    console.error('Erreur capturée par GlobalErrorHandler:', {
      message: normalized.message,
      code: normalized.code,
      status: normalized.status,
      name: normalized.name,
      originalError: error,
      stack: error instanceof Error ? error.stack : undefined
    });

    // Afficher dans la snackbar
    this.errorSnackbar.showError(normalized.message);
  }
}

