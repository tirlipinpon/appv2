import { Injectable, inject, Injector } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';
import { CustomAuthService } from '../auth/custom-auth.service';
import { AuthService } from '../auth/auth.service';
import type { IAuthService } from '../auth/auth-service.factory';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private readonly injector = inject(Injector);
  private authService: IAuthService | null = null;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
    
    // Initialiser la session de manière asynchrone après l'injection
    // Utiliser queueMicrotask pour permettre à tous les services d'être initialisés
    queueMicrotask(() => {
      this.initializeUserSession();
    });
  }

  private getAuthService(): IAuthService | null {
    // Obtenir le service d'authentification via l'injector de manière paresseuse
    if (!this.authService) {
      try {
        if (environment.customAuthEnabled) {
          this.authService = this.injector.get(CustomAuthService, null);
        } else {
          this.authService = this.injector.get(AuthService, null);
        }
      } catch (error) {
        // Ignorer les erreurs silencieusement - le service pourrait ne pas être disponible
        return null;
      }
    }
    return this.authService;
  }

  private async initializeUserSession(): Promise<void> {
    const authService = this.getAuthService();
    if (!authService) return;
    
    try {
      const user = authService.getCurrentUser();
      if (user) {
        // Appeler la fonction RPC pour définir l'user_id dans la session PostgreSQL
        const { error } = await this.supabase.rpc('set_current_user_id', { user_id_param: user.id });
        if (error) {
          console.warn('[SupabaseService] Erreur lors de l\'initialisation de la session:', error);
        }
      }
    } catch (error) {
      console.warn('[SupabaseService] Impossible d\'initialiser la session utilisateur:', error);
    }
  }

  get client(): SupabaseClient {
    // S'assurer que la variable de session est définie avant chaque utilisation
    if (environment.customAuthEnabled) {
      const authService = this.getAuthService();
      if (authService) {
        const user = authService.getCurrentUser();
        if (user) {
          // Appeler de manière asynchrone (ne pas bloquer)
          this.supabase.rpc('set_current_user_id', { user_id_param: user.id }).then(({ error }) => {
            if (error) {
              // Ignorer les erreurs silencieusement
            }
          });
        }
      }
    }
    return this.supabase;
  }
}
