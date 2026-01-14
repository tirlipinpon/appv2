import { Injectable, inject, Injector } from '@angular/core';
import { ChildSession } from '../types/child-session';
import { ENVIRONMENT } from '../tokens/environment.token';
import { SupabaseService } from '../services/supabase/supabase.service';

const CHILD_SESSION_KEY = 'child_session';
const CHILD_AUTH_TOKEN_KEY = 'child_auth_token';
const CHILD_AUTH_EXPIRES_AT_KEY = 'child_auth_expires_at';
const VALIDATION_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes en millisecondes

@Injectable({
  providedIn: 'root',
})
export class ChildAuthService {
  private readonly environment = inject(ENVIRONMENT, { optional: true });
  private readonly injector = inject(Injector);
  private currentSession: ChildSession | null = null;
  private validationInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Restaurer la session depuis sessionStorage au démarrage
    this.restoreSession();
    
    // Démarrer la validation périodique si une session existe
    if (this.currentSession) {
      this.startPeriodicValidation();
    }
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
      const now = Date.now();
      const session: ChildSession = {
        child_id: user.id,
        firstname: user.firstname,
        school_level: user.school_level,
        parent_id: user.parent_id,
        school_id: user.school_id,
        avatar_url: user.avatar_url,
        avatar_seed: user.avatar_seed,
        avatar_style: user.avatar_style,
        createdAt: now, // Timestamp de création
        lastActivity: now, // Timestamp de dernière activité (initialisé à la création)
      };

      // 4. Sauvegarder la session (si échec, nettoyer le token pour cohérence)
      const sessionSaved = this.saveSession(session);
      if (!sessionSaved) {
        // Si on ne peut pas sauvegarder la session, nettoyer le token pour éviter un état incohérent
        this.clearSession();
        throw new Error('Impossible de sauvegarder la session. Vérifie que la navigation privée n\'est pas activée.');
      }

      this.currentSession = session;
      
      // Démarrer la validation périodique après connexion réussie
      this.startPeriodicValidation();
      
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
   * Déconnecte l'enfant complètement
   * Nettoie toutes les données de session, arrête les intervalles et réinitialise l'état
   */
  async logout(): Promise<void> {
    // 1. Arrêter la validation périodique (si active)
    this.stopPeriodicValidation();
    
    // 2. Nettoyer toutes les données de session (JWT, session, timestamps)
    this.clearSession();
    
    // 3. Réinitialiser complètement l'état
    this.currentSession = null;
    
    // Note : Pas besoin d'appeler supabase.auth.signOut() car on utilise un JWT manuel
    // Le JWT est stocké dans sessionStorage et sera supprimé par clearSession()
  }

  /**
   * Nettoie la session de manière synchrone (utilisé par getToken et logout)
   * Supprime toutes les données de session du sessionStorage
   * Note: currentSession est géré séparément dans logout() pour éviter les doubles assignations
   * Cette méthode nettoie uniquement le sessionStorage, pas currentSession
   */
  private clearSession(): void {
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
   * Version "safe" sans effets de bord - utilise getTokenSafe() pour éviter de nettoyer
   * la session de manière inattendue. Pour une validation complète avec nettoyage,
   * utiliser isSessionValid() à la place.
   */
  isAuthenticated(): boolean {
    const token = this.getTokenSafe();
    return token !== null && this.currentSession !== null;
  }

  /**
   * Valide la session de manière complète (présence, expiration, validité JWT, activité)
   * Utilisé par le guard pour une validation robuste
   * Double expiration : absolue (8h depuis création) et relative (1h d'inactivité)
   * @returns true si la session est valide, false sinon
   */
  async isSessionValid(): Promise<boolean> {
    // 1. Vérifier la présence du token et de la session
    const token = this.getToken();
    if (!token || !this.currentSession) {
      return false;
    }

    // 2. Vérifier l'expiration absolue du JWT (déjà fait dans getToken(), mais on double-vérifie)
    const expiresAtStr = sessionStorage.getItem(CHILD_AUTH_EXPIRES_AT_KEY);
    if (!expiresAtStr) {
      return false;
    }

    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      // Token expiré (expiration absolue), nettoyer
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

    // 5. Vérifier l'expiration relative (1h d'inactivité)
    const now = Date.now();
    const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 heure en millisecondes
    const lastActivity = this.currentSession.lastActivity || this.currentSession.createdAt;
    
    if (now - lastActivity > INACTIVITY_TIMEOUT) {
      // Session expirée par inactivité (1h sans activité), nettoyer
      this.clearSession();
      return false;
    }

    // 6. Vérifier l'expiration absolue depuis création (8h maximum)
    const ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000; // 8 heures en millisecondes
    const createdAt = this.currentSession.createdAt;
    
    if (now - createdAt > ABSOLUTE_TIMEOUT) {
      // Session expirée par durée absolue (8h depuis création), nettoyer
      this.clearSession();
      return false;
    }

    // 7. Toutes les validations passées
    return true;
  }

  /**
   * Retourne le token JWT actuel pour les requêtes Supabase
   * Version "safe" sans effets de bord - ne nettoie pas la session si le token est invalide
   * Le nettoyage sera géré par l'intercepteur d'erreurs Supabase (401/403)
   */
  getAccessToken(): string | null {
    // Mettre à jour l'activité lors de l'accès au token (activité = requête Supabase)
    this.updateActivity();
    return this.getTokenSafe();
  }

  /**
   * Met à jour le timestamp de dernière activité
   * Appelé automatiquement lors des interactions (requêtes Supabase, navigation, etc.)
   * @returns true si la mise à jour a réussi, false sinon
   */
  updateActivity(): boolean {
    if (!this.currentSession) {
      return false;
    }

    try {
      const now = Date.now();
      this.currentSession.lastActivity = now;
      
      // Sauvegarder la session mise à jour
      return this.saveSession(this.currentSession);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'activité:', error);
      return false;
    }
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
   * Restaure les timestamps (createdAt, lastActivity) si présents, sinon les initialise
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
            const restoredSession = JSON.parse(sessionData) as ChildSession;
            
            // S'assurer que les timestamps existent (compatibilité avec anciennes sessions)
            const now = Date.now();
            if (!restoredSession.createdAt) {
              restoredSession.createdAt = now;
            }
            if (!restoredSession.lastActivity) {
              restoredSession.lastActivity = restoredSession.createdAt || now;
            }
            
            this.currentSession = restoredSession;
            
            // Sauvegarder la session avec les timestamps mis à jour si nécessaire
            if (!restoredSession.createdAt || !restoredSession.lastActivity) {
              this.saveSession(this.currentSession);
            }
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
   * Version avec effets de bord (nettoie la session si invalide)
   * Utilisée par isSessionValid() et restoreSession() pour maintenir la cohérence
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

  /**
   * Récupère le token JWT depuis sessionStorage sans effets de bord
   * Version "safe" utilisée par getAccessToken() pour éviter de nettoyer la session
   * pendant une requête Supabase en cours
   * Le nettoyage sera géré par l'intercepteur d'erreurs (401/403)
   */
  private getTokenSafe(): string | null {
    try {
      const token = sessionStorage.getItem(CHILD_AUTH_TOKEN_KEY);
      const expiresAtStr = sessionStorage.getItem(CHILD_AUTH_EXPIRES_AT_KEY);

      // Si l'un des deux est manquant, retourner null sans nettoyer
      if (!token || !expiresAtStr) {
        return null;
      }

      const expiresAt = parseInt(expiresAtStr, 10);
      if (isNaN(expiresAt)) {
        // expiresAt invalide, retourner null sans nettoyer
        return null;
      }

      if (Date.now() > expiresAt) {
        // Token expiré, retourner null sans nettoyer
        // Le nettoyage sera fait par l'intercepteur d'erreurs Supabase (401/403)
        return null;
      }

      return token;
    } catch (error) {
      console.error('Erreur lors de la récupération du token:', error);
      // En cas d'erreur, retourner null sans nettoyer
      return null;
    }
  }

  /**
   * Valide la session avec le backend
   * Vérifie que l'enfant existe toujours et est actif dans la base de données
   * @returns true si l'enfant est valide et actif, false sinon
   */
  async validateSessionWithBackend(): Promise<boolean> {
    // Si pas de session, pas besoin de valider
    if (!this.currentSession) {
      return false;
    }

    const childId = this.currentSession.child_id;

    try {
      // Injection lazy pour éviter la dépendance circulaire
      const supabaseService = this.injector.get(SupabaseService);
      
      // Faire une requête Supabase pour vérifier que l'enfant existe et est actif
      // Le JWT dans le header permettra à RLS de vérifier l'authentification
      const { data, error } = await supabaseService.client
        .from('children')
        .select('id, is_active')
        .eq('id', childId)
        .maybeSingle();

      // Gérer les erreurs réseau ou de connexion (ne pas déconnecter si erreur temporaire)
      if (error) {
        // Erreur réseau ou temporaire - ne pas déconnecter
        // Seules les erreurs 401/403 (gérées par l'intercepteur) doivent déconnecter
        console.warn('Erreur lors de la validation backend (non critique):', error);
        return true; // Considérer comme valide pour éviter les déconnexions intempestives
      }

      // Si l'enfant n'existe pas ou n'est pas actif, déconnecter
      if (!data || !data.is_active) {
        await this.logout();
        return false;
      }

      // L'enfant existe et est actif
      return true;
    } catch (error) {
      // Erreur inattendue (exception non gérée par Supabase)
      // Ne pas déconnecter en cas d'erreur réseau temporaire
      console.error('Erreur lors de la validation backend:', error);
      return true; // Considérer comme valide pour éviter les déconnexions intempestives
    }
  }

  /**
   * Démarre la validation périodique avec le backend
   * Valide toutes les 10 minutes que l'enfant est toujours actif
   */
  private startPeriodicValidation(): void {
    // Arrêter l'interval existant s'il y en a un
    this.stopPeriodicValidation();

    // Démarrer un nouvel interval de validation toutes les 10 minutes
    this.validationInterval = setInterval(async () => {
      // Valider la session avec le backend
      await this.validateSessionWithBackend();
    }, VALIDATION_INTERVAL_MS);
  }

  /**
   * Arrête la validation périodique
   */
  private stopPeriodicValidation(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
  }
}

