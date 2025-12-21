import { patchState } from '@ngrx/signals';
import { ErrorSnackbarService } from '../services/snackbar/error-snackbar.service';

/**
 * Helper function pour définir une erreur dans un store et l'afficher via snackbar
 * @param store - L'instance du store NgRx Signals (typé automatiquement par TypeScript à l'appel)
 * @param errorSnackbar - Le service de snackbar d'erreur
 * @param errorMessage - Le message d'erreur à afficher
 * @param isLoading - État de chargement (optionnel, par défaut false)
 */
export function setStoreError(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: any,
  errorSnackbar: ErrorSnackbarService,
  errorMessage: string,
  isLoading = false
): void {
  patchState(store, { error: [errorMessage], isLoading });
  errorSnackbar.showError(errorMessage);
}

