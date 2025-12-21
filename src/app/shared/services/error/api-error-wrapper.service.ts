import { Injectable, inject } from '@angular/core';
import { ErrorHandlerService } from './error-handler.service';
import { ErrorSnackbarService } from '../snackbar/error-snackbar.service';

/**
 * Service wrapper pour les appels API/fetch avec gestion d'erreur automatique
 * Utile pour les appels qui ne passent pas par HttpClient (fetch direct, Supabase, etc.)
 */
@Injectable({
  providedIn: 'root'
})
export class ApiErrorWrapperService {
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly errorSnackbar = inject(ErrorSnackbarService);

  /**
   * Wrapper pour les appels fetch avec gestion d'erreur automatique
   * @param url URL à appeler
   * @param options Options de fetch
   * @returns Promise avec les données JSON
   */
  async fetchWithErrorHandling<T>(
    url: string,
    options?: RequestInit
  ): Promise<T> {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Erreur inconnue');
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      
      // Essayer de parser en JSON, sinon retourner le texte
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text() as unknown as T;
      }
    } catch (error) {
      const normalized = this.errorHandler.normalize(
        error,
        'Erreur lors de l\'appel API'
      );
      
      // Logger l'erreur
      console.error('Erreur fetch interceptée:', {
        url,
        method: options?.method || 'GET',
        error: normalized
      });
      
      this.errorSnackbar.showError(normalized.message);
      throw normalized;
    }
  }

  /**
   * Wrapper pour les promesses avec gestion d'erreur automatique
   * @param promise La promesse à wrapper
   * @param errorMessage Message d'erreur personnalisé
   * @returns Promise avec gestion d'erreur
   */
  async wrapPromise<T>(
    promise: Promise<T>,
    errorMessage = 'Une erreur est survenue'
  ): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      const normalized = this.errorHandler.normalize(error, errorMessage);
      
      // Logger l'erreur
      console.error('Erreur dans promesse wrappée:', {
        error: normalized,
        originalError: error
      });
      
      this.errorSnackbar.showError(normalized.message);
      throw normalized;
    }
  }

  /**
   * Wrapper pour les opérations asynchrones avec gestion d'erreur
   * @param operation Fonction asynchrone à exécuter
   * @param errorMessage Message d'erreur personnalisé
   * @returns Résultat de l'opération
   */
  async wrapAsync<T>(
    operation: () => Promise<T>,
    errorMessage = 'Une erreur est survenue lors de l\'opération'
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const normalized = this.errorHandler.normalize(error, errorMessage);
      
      console.error('Erreur dans opération asynchrone wrappée:', {
        error: normalized,
        originalError: error
      });
      
      this.errorSnackbar.showError(normalized.message);
      throw normalized;
    }
  }
}

