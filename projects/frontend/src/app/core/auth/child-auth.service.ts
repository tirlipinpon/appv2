import { Injectable, inject } from '@angular/core';
import { ChildSession } from '../types/child-session';
import { ENVIRONMENT } from '../tokens/environment.token';

const CHILD_SESSION_KEY = 'child_session';
const CHILD_AUTH_TOKEN_KEY = 'child_auth_token';
const CHILD_AUTH_EXPIRES_AT_KEY = 'child_auth_expires_at';

@Injectable({
  providedIn: 'root',
})
export class ChildAuthService {
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
      // Si la sauvegarde échoue, on ne peut pas continuer (token requis pour les requêtes Supabase)
      const tokenSaved = this.saveToken(access_token, expires_in);
      if (!tokenSaved) {
        throw new Error('Impossible de sauvegarder la session. Vérifie que la navigation privée n\'est pas activée.');
      }

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

      // 4. Sauvegarder la session (si échec, nettoyer le token pour cohérence)
      const sessionSaved = this.saveSession(session);
      if (!sessionSaved) {
        // Si on ne peut pas sauvegarder la session, nettoyer le token pour éviter un état incohérent
        this.clearSession();
        throw new Error('Impossible de sauvegarder la session. Vérifie que la navigation privée n\'est pas activée.');
      }

      this.currentSession = session;
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
    this.clearSession();
  }

  /**
   * Nettoie la session de manière synchrone (utilisé par getToken et logout)
   */
  private clearSession(): void {
    this.currentSession = null;
    try {
      sessionStorage.removeItem(CHILD_SESSION_KEY);
    } catch {
      // Ignorer les erreurs de sessionStorage (mode navigation privée, etc.)
    }
    try {
      sessionStorage.removeItem(CHILD_AUTH_TOKEN_KEY);
    } catch {
      // Ignorer les erreurs de sessionStorage (mode navigation privée, etc.)
    }
    try {
      sessionStorage.removeItem(CHILD_AUTH_EXPIRES_AT_KEY);
    } catch {
      // Ignorer les erreurs de sessionStorage (mode navigation privée, etc.)
    }
  }

  /**
   * Retourne la session actuelle de l'enfant
   */
  getCurrentChild(): ChildSession | null {
    return this.currentSession;
  }

  /**
   * Vérifie si un enfant est authentifié (vérification simple)
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    return token !== null && this.currentSession !== null;
  }

  /**
   * Valide la session de manière complète (présence, expiration, validité JWT)
   * Utilisé par le guard pour une validation robuste
   * @returns true si la session est valide, false sinon
   */
  async isSessionValid(): Promise<boolean> {
    // 1. Vérifier la présence du token et de la session
    const token = this.getToken();
    if (!token || !this.currentSession) {
      return false;
    }

    // 2. Vérifier l'expiration (déjà fait dans getToken(), mais on double-vérifie)
    const expiresAtStr = sessionStorage.getItem(CHILD_AUTH_EXPIRES_AT_KEY);
    if (!expiresAtStr) {
      return false;
    }

    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      // Token expiré, nettoyer
      this.clearSession();
      return false;
    }

    // 3. Vérifier la structure basique du JWT (3 parties séparées par des points)
    const jwtParts = token.split('.');
    if (jwtParts.length !== 3) {
      // JWT invalide, nettoyer
      this.clearSession();
      return false;
    }

    // 4. Décoder et vérifier l'expiration dans le payload JWT (double vérification)
    try {
      const payload = JSON.parse(atob(jwtParts[1]));
      const jwtExp = payload.exp;
      
      // Vérifier que l'expiration JWT n'est pas passée
      if (jwtExp && typeof jwtExp === 'number') {
        const jwtExpiresAt = jwtExp * 1000; // Convertir en millisecondes
        if (Date.now() > jwtExpiresAt) {
          // JWT expiré selon son propre payload, nettoyer
          this.clearSession();
          return false;
        }
      }
    } catch (error) {
      // Si on ne peut pas décoder le JWT, considérer comme invalide
      console.error('Erreur lors du décodage du JWT:', error);
      this.clearSession();
      return false;
    }

    // 5. Toutes les validations passées
    return true;
  }

  /**
   * Retourne le token JWT actuel pour les requêtes Supabase
   */
  getAccessToken(): string | null {
    return this.getToken();
  }

  /**
   * Sauvegarde la session dans sessionStorage
   * @returns true si la sauvegarde a réussi, false sinon
   */
  private saveSession(session: ChildSession): boolean {
    try {
      sessionStorage.setItem(CHILD_SESSION_KEY, JSON.stringify(session));
      return true;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la session:', error);
      return false;
    }
  }

  /**
   * Restaure la session depuis sessionStorage
   * Valide l'expiration et la structure du JWT au chargement
   */
  private restoreSession(): void {
    try {
      const sessionData = sessionStorage.getItem(CHILD_SESSION_KEY);
      if (sessionData) {
        // Vérifier que le token n'est pas expiré (getToken() fait déjà cette vérification)
        const token = this.getToken();
        if (token) {
          // Vérifier la structure basique du JWT
          const jwtParts = token.split('.');
          if (jwtParts.length === 3) {
            // JWT valide structurellement, restaurer la session
            this.currentSession = JSON.parse(sessionData) as ChildSession;
          } else {
            // JWT invalide, nettoyer
            this.currentSession = null;
            this.clearSession();
          }
        } else {
          // Token expiré ou manquant, nettoyer
          this.currentSession = null;
          this.clearSession();
        }
      }
    } catch (error) {
      console.error('Erreur lors de la restauration de la session:', error);
      this.currentSession = null;
      // Protéger removeItem dans le catch pour éviter une double exception
      try {
        this.clearSession();
      } catch {
        // Ignorer les erreurs de sessionStorage (mode navigation privée, etc.)
      }
    }
  }

  /**
   * Sauvegarde le token JWT dans sessionStorage de manière atomique
   * Si l'une des deux sauvegardes échoue, nettoie immédiatement pour éviter l'incohérence
   * @returns true si la sauvegarde a réussi, false sinon
   */
  private saveToken(token: string, expiresIn: number): boolean {
    const expiresAt = Date.now() + (expiresIn * 1000);
    let tokenSaved = false;
    let expiresAtSaved = false;

    try {
      // Sauvegarder le token
      sessionStorage.setItem(CHILD_AUTH_TOKEN_KEY, token);
      tokenSaved = true;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du token:', error);
      // Si la première sauvegarde échoue, rien à nettoyer
      return false;
    }

    try {
      // Sauvegarder l'expiration
      sessionStorage.setItem(CHILD_AUTH_EXPIRES_AT_KEY, expiresAt.toString());
      expiresAtSaved = true;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'expiration:', error);
      // Si la deuxième sauvegarde échoue, nettoyer le token déjà sauvegardé pour éviter l'incohérence
      try {
        sessionStorage.removeItem(CHILD_AUTH_TOKEN_KEY);
      } catch {
        // Ignorer les erreurs de nettoyage
      }
      return false;
    }

    // Les deux sauvegardes ont réussi
    return tokenSaved && expiresAtSaved;
  }

  /**
   * Récupère le token JWT depuis sessionStorage et vérifie l'expiration
   */
  private getToken(): string | null {
    try {
      const token = sessionStorage.getItem(CHILD_AUTH_TOKEN_KEY);
      const expiresAtStr = sessionStorage.getItem(CHILD_AUTH_EXPIRES_AT_KEY);

      // Si l'un des deux est manquant, les données sont corrompues - nettoyer tout
      if (!token || !expiresAtStr) {
        // Nettoyer les données incohérentes pour éviter l'accumulation de tokens orphelins
        // et maintenir la cohérence entre currentSession et sessionStorage
        this.clearSession();
        return null;
      }

      const expiresAt = parseInt(expiresAtStr, 10);
      if (isNaN(expiresAt)) {
        // expiresAt n'est pas un nombre valide, données corrompues - nettoyer
        this.clearSession();
        return null;
      }

      if (Date.now() > expiresAt) {
        // Token expiré, nettoyer
        this.clearSession();
        return null;
      }

      return token;
    } catch (error) {
      console.error('Erreur lors de la récupération du token:', error);
      // En cas d'erreur, nettoyer pour éviter les données corrompues
      this.clearSession();
      return null;
    }
  }
}

