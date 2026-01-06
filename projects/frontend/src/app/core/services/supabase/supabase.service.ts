import { Injectable, inject, Injector } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENVIRONMENT } from '../../tokens/environment.token';
import { ChildAuthService } from '../../auth/child-auth.service';
import { SupabaseErrorHandlerService } from './supabase-error-handler.service';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly environment = inject(ENVIRONMENT, { optional: true });
  private readonly injector = inject(Injector);
  private readonly errorHandler = inject(SupabaseErrorHandlerService);
  private supabase: SupabaseClient;

  constructor() {
    if (!this.environment) {
      throw new Error('ENVIRONMENT token must be provided. Please provide it in your app.config.ts');
    }
    this.supabase = createClient(this.environment.supabaseUrl, this.environment.supabaseAnonKey);
    this.setupAuthInterceptor();
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Configure l'intercepteur pour ajouter automatiquement le JWT aux requêtes
   * et intercepter les erreurs d'authentification (401/403)
   */
  private setupAuthInterceptor(): void {
    // Utiliser un cast pour accéder à la propriété rest (protégée mais accessible à l'exécution)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseRest = (this.supabase as any).rest;
    if (!supabaseRest || !supabaseRest.fetch) {
      console.warn('Impossible d\'accéder à rest.fetch, l\'interception des erreurs ne fonctionnera pas');
      return;
    }

    // Sauvegarder la fonction fetch originale
    const originalFetch = supabaseRest.fetch.bind(supabaseRest);
    
    // Intercepter les requêtes pour ajouter le token et gérer les erreurs
    supabaseRest.fetch = async (url: string, options: RequestInit = {}) => {
      // 1. Ajouter le token JWT dans les headers (injection lazy pour éviter dépendance circulaire)
      const authService = this.injector.get(ChildAuthService);
      const token = authService.getAccessToken();
      
      if (token) {
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${token}`);
        options.headers = headers;
      }
      
      // 2. Exécuter la requête
      const response = await originalFetch(url, options);
      
      // 3. Intercepter la réponse pour détecter les erreurs d'authentification
      if (response.status === 401 || response.status === 403) {
        // Essayer de parser le body pour obtenir plus d'infos sur l'erreur
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let errorData: { status: number; code?: string; message?: string; [key: string]: any } = { status: response.status };
        try {
          const clonedResponse = response.clone();
          const text = await clonedResponse.text();
          if (text) {
            errorData = { ...errorData, ...JSON.parse(text) };
          }
        } catch {
          // Si on ne peut pas parser, utiliser juste le status
        }
        
        // Gérer l'erreur d'authentification (déconnexion + redirection)
        this.errorHandler.handleError(errorData).catch((err) => {
          console.error('Erreur lors de la gestion de l\'erreur:', err);
        });
      }
      
      return response;
    };
  }

  /**
   * Wrapper pour les requêtes Supabase qui vérifie automatiquement les erreurs
   * Utiliser cette méthode pour les requêtes qui doivent être interceptées
   */
  async executeWithErrorHandling<T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    operation: () => Promise<{ data: T | null; error: any }>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ data: T | null; error: any }> {
    const result = await operation();
    
    // Vérifier les erreurs dans la réponse Supabase
    if (result.error) {
      // Vérifier si c'est une erreur d'authentification
      if (this.errorHandler.isAuthError(result.error)) {
        await this.errorHandler.handleError(result.error);
      }
    }
    
    return result;
  }
}

