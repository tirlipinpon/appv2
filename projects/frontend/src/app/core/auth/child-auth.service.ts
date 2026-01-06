import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../services/supabase/supabase.service';
import { ChildSession } from '../types/child-session';
import { ENVIRONMENT } from '../tokens/environment.token';

const CHILD_SESSION_KEY = 'child_session';
const CHILD_AUTH_TOKEN_KEY = 'child_auth_token';
const CHILD_AUTH_EXPIRES_AT_KEY = 'child_auth_expires_at';

@Injectable({
  providedIn: 'root',
})
export class ChildAuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly environment = inject(ENVIRONMENT, { optional: true });
  private currentSession: ChildSession | null = null;

  constructor() {
    // Restaurer la session depuis sessionStorage au démarrage
    this.restoreSession();
  }

  /**
   * Authentifie un enfant via prénom + code PIN via Edge Function sécurisée
   * Le PIN n'est jamais exposé en frontend, validation 100% backend
   */
  async login(firstname: string, pin: string): Promise<ChildSession> {
    try {
      if (!this.environment) {
        throw new Error('Configuration manquante');
      }

      // 1. Appeler Edge Function (PIN jamais exposé en frontend)
      const edgeFunctionUrl = `${this.environment.supabaseUrl}/functions/v1/auth-login-child`;
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.environment.supabaseAnonKey}`
        },
        body: JSON.stringify({ firstname, pin })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Identifiants incorrects';
        throw new Error(errorMessage);
      }

      const { access_token, expires_in, user } = await response.json();

      // 2. Stocker le JWT manuellement (pas de setSession car JWT généré manuellement)
      this.saveToken(access_token, expires_in);

      // 3. Créer session enfant depuis les données de l'Edge Function
      const session: ChildSession = {
        child_id: user.id,
        firstname: user.firstname,
        school_level: user.school_level,
        parent_id: user.parent_id,
        school_id: user.school_id,
        avatar_url: user.avatar_url,
        avatar_seed: user.avatar_seed,
        avatar_style: user.avatar_style,
      };

      this.currentSession = session;
      this.saveSession(session);

      return session;
    } catch (error: unknown) {
      console.error('Erreur lors de la connexion:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erreur lors de la connexion. Réessaye plus tard.');
    }
  }

  /**
   * Déconnecte l'enfant
   */
  async logout(): Promise<void> {
    // Supprimer le JWT et la session
    this.currentSession = null;
    sessionStorage.removeItem(CHILD_SESSION_KEY);
    sessionStorage.removeItem(CHILD_AUTH_TOKEN_KEY);
    sessionStorage.removeItem(CHILD_AUTH_EXPIRES_AT_KEY);
  }

  /**
   * Retourne la session actuelle de l'enfant
   */
  getCurrentChild(): ChildSession | null {
    return this.currentSession;
  }

  /**
   * Vérifie si un enfant est authentifié
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    return token !== null && this.currentSession !== null;
  }

  /**
   * Retourne le token JWT actuel pour les requêtes Supabase
   */
  getAccessToken(): string | null {
    return this.getToken();
  }

  /**
   * Sauvegarde la session dans sessionStorage
   */
  private saveSession(session: ChildSession): void {
    try {
      sessionStorage.setItem(CHILD_SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la session:', error);
    }
  }

  /**
   * Restaure la session depuis sessionStorage
   */
  private restoreSession(): void {
    try {
      const sessionData = sessionStorage.getItem(CHILD_SESSION_KEY);
      if (sessionData) {
        // Vérifier que le token n'est pas expiré
        const token = this.getToken();
        if (token) {
          this.currentSession = JSON.parse(sessionData) as ChildSession;
        } else {
          // Token expiré, nettoyer
          sessionStorage.removeItem(CHILD_SESSION_KEY);
          this.currentSession = null;
        }
      }
    } catch (error) {
      console.error('Erreur lors de la restauration de la session:', error);
      sessionStorage.removeItem(CHILD_SESSION_KEY);
      this.currentSession = null;
    }
  }

  /**
   * Sauvegarde le token JWT dans sessionStorage
   */
  private saveToken(token: string, expiresIn: number): void {
    try {
      const expiresAt = Date.now() + (expiresIn * 1000);
      sessionStorage.setItem(CHILD_AUTH_TOKEN_KEY, token);
      sessionStorage.setItem(CHILD_AUTH_EXPIRES_AT_KEY, expiresAt.toString());
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du token:', error);
    }
  }

  /**
   * Récupère le token JWT depuis sessionStorage et vérifie l'expiration
   */
  private getToken(): string | null {
    try {
      const token = sessionStorage.getItem(CHILD_AUTH_TOKEN_KEY);
      const expiresAtStr = sessionStorage.getItem(CHILD_AUTH_EXPIRES_AT_KEY);

      if (!token || !expiresAtStr) {
        return null;
      }

      const expiresAt = parseInt(expiresAtStr, 10);
      if (Date.now() > expiresAt) {
        // Token expiré, nettoyer
        this.logout();
        return null;
      }

      return token;
    } catch (error) {
      console.error('Erreur lors de la récupération du token:', error);
      return null;
    }
  }
}

