import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from '../../../shared/services/supabase/supabase.service';
import { getAuthService } from '../../../shared/services/auth/auth-service.factory';
import { environment } from '../../../../environments/environment';
import type { User, Session } from '@supabase/supabase-js';
import type { CustomUser } from '../../../shared/services/auth/custom-auth.service';

export interface SignInResult {
  session: Session | null;
  error: Error | null;
}

/**
 * Service responsable de la gestion de l'authentification de base
 * Principe SRP : Gère uniquement la session et l'état d'authentification
 */
@Injectable({
  providedIn: 'root',
})
export class AuthCoreService {
  private readonly supabaseService = inject(SupabaseService);
  private currentUserSubject = new BehaviorSubject<User | null>(null);

  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    if (!environment.customAuthEnabled) {
      this.initializeAuth();
    } else {
      this.initializeCustomAuth();
    }
  }

  private async initializeAuth(): Promise<void> {
    const { data: { session } } = await this.supabaseService.client.auth.getSession();
    if (session) {
      this.currentUserSubject.next(session.user);
    }

    this.supabaseService.client.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && session) {
        this.currentUserSubject.next(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.currentUserSubject.next(null);
      }
    });
  }

  private initializeCustomAuth(): void {
    // Pour l'authentification personnalisée, écouter les changements via getAuthService
    try {
      const authService = getAuthService();
      authService.currentUser$.subscribe((user: CustomUser | null) => {
        // Convertir CustomUser en User de Supabase pour compatibilité
        if (user) {
          const supabaseUser = {
            id: user.id,
            email: user.email || '',
            email_confirmed_at: user.email_verified ? new Date().toISOString() : null,
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          } as User;
          this.currentUserSubject.next(supabaseUser);
        } else {
          this.currentUserSubject.next(null);
        }
      });
    } catch (error) {
      console.warn('[AuthCoreService] Impossible d\'initialiser l\'authentification personnalisée:', error);
    }
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    try {
      const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { session: null, error: new Error(error.message) };
      }

      if (data.session) {
        this.currentUserSubject.next(data.session.user);
      }

      return { session: data.session, error: null };
    } catch (error) {
      return { 
        session: null, 
        error: error instanceof Error ? error : new Error('Erreur lors de la connexion')
      };
    }
  }

  async signOut(): Promise<void> {
    await this.supabaseService.client.auth.signOut();
    this.currentUserSubject.next(null);
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.supabaseService.client.auth.getSession();
    if (error) {
      return null;
    }
    return data.session;
  }

  getCurrentUser(): User | null {
    // Si l'authentification personnalisée est activée, utiliser getAuthService
    if (environment.customAuthEnabled) {
      try {
        const authService = getAuthService();
        const user = authService.getCurrentUser();
        if (user) {
          // Convertir CustomUser en User de Supabase pour compatibilité
          return {
            id: user.id,
            email: user.email || '',
            email_confirmed_at: user.email_verified ? new Date().toISOString() : null,
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          } as User;
        }
      } catch (error) {
        console.warn('[AuthCoreService] Erreur lors de la récupération de l\'utilisateur:', error);
      }
    }
    return this.currentUserSubject.value;
  }

  async setSession(accessToken: string, refreshToken: string): Promise<{ user: User | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabaseService.client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (error) {
        return { user: null, error: new Error(error.message) };
      }

      if (data.user) {
        this.currentUserSubject.next(data.user);
      }

      return { user: data.user, error: null };
    } catch (error) {
      return { 
        user: null, 
        error: error instanceof Error ? error : new Error('Erreur lors de la définition de la session')
      };
    }
  }
}
