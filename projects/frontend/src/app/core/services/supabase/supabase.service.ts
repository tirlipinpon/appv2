import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENVIRONMENT } from '../../tokens/environment.token';
import { ChildAuthService } from '../../auth/child-auth.service';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly environment = inject(ENVIRONMENT, { optional: true });
  private readonly authService = inject(ChildAuthService);
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
   */
  private setupAuthInterceptor(): void {
    // Utiliser l'API Supabase pour ajouter le token aux headers
    // Le client Supabase utilise automatiquement auth.getSession() mais on peut override
    // On va utiliser rest.headers pour ajouter le token manuellement
    const originalRest = this.supabase.rest;
    
    // Intercepter les requêtes pour ajouter le token
    const originalFetch = this.supabase.rest.fetch;
    this.supabase.rest.fetch = async (url, options = {}) => {
      const token = this.authService.getAccessToken();
      
      if (token) {
        // Ajouter le token dans les headers
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${token}`);
        options.headers = headers;
      }
      
      return originalFetch.call(this.supabase.rest, url, options);
    };
  }
}

