import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from '../supabase/supabase.service';
import { AppInitializationService } from '../initialization/app-initialization.service';
import { environment } from '../../../../environments/environment';
import type { Profile, ServiceError, SignupResult, ProfileMutationResult, SignInResult } from './auth.service';

// Interface pour l'utilisateur personnalisé (similaire à User de Supabase)
export interface CustomUser {
  id: string;
  email: string;
  email_verified?: boolean;
}

// Interface pour la session personnalisée (similaire à Session de Supabase)
export interface CustomSession {
  user: CustomUser;
  token: string;
  expires_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CustomAuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly appInitializationService = inject(AppInitializationService);
  private currentUserSubject = new BehaviorSubject<CustomUser | null>(null);
  private currentProfileSubject = new BehaviorSubject<Profile | null>(null);
  private activeRoleSignal = signal<string | null>(null);
  private currentToken: string | null = null;

  public currentUser$ = this.currentUserSubject.asObservable();
  public currentProfile$ = this.currentProfileSubject.asObservable();
  public activeRole$ = computed(() => this.activeRoleSignal());

  private get authApiUrl(): string {
    return `${environment.supabaseUrl}/functions/v1`;
  }

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    // Vérifier le token stocké
    const storedToken = this.getStoredToken();
    if (storedToken) {
      // Valider le token
      const validation = await this.validateToken(storedToken);
      if (validation.valid && validation.user) {
        this.currentToken = storedToken;
        this.currentUserSubject.next(validation.user);
        await this.loadProfile();
      } else {
        // Token invalide, le supprimer
        this.clearStoredToken();
      }
    }
  }

  private getStoredToken(): string | null {
    try {
      return localStorage.getItem('custom_auth_token');
    } catch {
      return null;
    }
  }

  private setStoredToken(token: string): void {
    try {
      localStorage.setItem('custom_auth_token', token);
    } catch (error) {
      console.warn('[CustomAuthService] Impossible de sauvegarder le token:', error);
    }
  }

  private clearStoredToken(): void {
    try {
      localStorage.removeItem('custom_auth_token');
    } catch (error) {
      console.warn('[CustomAuthService] Impossible de supprimer le token:', error);
    }
  }

  async signUp(email: string, password: string, roles: string[]): Promise<SignupResult> {
    try {
      const response = await fetch(`${this.authApiUrl}/auth-signup`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'apikey': environment.supabaseAnonKey,
          'Authorization': `Bearer ${environment.supabaseAnonKey}`,
        },
        body: JSON.stringify({ email, password, roles }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          user: null,
          error: {
            message: data.error || 'Erreur lors de l\'inscription',
            code: data.code,
            status: response.status,
          },
          existingUser: data.code === 'EMAIL_EXISTS',
        };
      }

      // Créer un objet User-like pour compatibilité avec le type User de Supabase
      const user = {
        id: data.userId,
        email: data.email,
        email_verified: false,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as any; // Type assertion pour compatibilité avec User de Supabase

      return { user, error: null };
    } catch (error) {
      return {
        user: null,
        error: this.normalizeError(error, 'Erreur lors de l\'inscription'),
      };
    }
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    try {
      const response = await fetch(`${this.authApiUrl}/auth-login`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'apikey': environment.supabaseAnonKey,
          'Authorization': `Bearer ${environment.supabaseAnonKey}`,
        },
        body: JSON.stringify({ email, password }),
      });

      // Vérifier si la réponse est valide avant de parser JSON
      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('[CustomAuthService] Error parsing response:', parseError);
        return {
          session: null,
          error: {
            message: 'Erreur lors de la connexion : réponse invalide du serveur',
            code: 'PARSE_ERROR',
            status: response.status,
          },
        };
      }

      if (!response.ok) {
        return {
          session: null,
          error: {
            message: data.error || 'Erreur lors de la connexion',
            code: data.code,
            status: response.status,
          },
        };
      }

      // Stocker le token
      this.currentToken = data.token;
      this.setStoredToken(data.token);

      // Créer la session
      const user: CustomUser = {
        id: data.user.id,
        email: data.user.email,
        email_verified: true,
      };

      console.log('[CustomAuthService] User signed in:', { id: user.id, email: user.email });

      const session: CustomSession = {
        user,
        token: data.token,
      };

      this.currentUserSubject.next(user);
      await this.loadProfile();

      // Initialiser les données pour le rôle actif si disponible
      const activeRole = this.getActiveRole();
      if (activeRole) {
        this.appInitializationService.initializeForRole(activeRole);
      }

      return { session: session as any, error: null };
    } catch (error) {
      // Gérer spécifiquement les erreurs CORS
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        return {
          session: null,
          error: {
            message: 'Erreur de connexion au serveur. Vérifiez votre connexion internet et que l\'Edge Function est déployée.',
            code: 'NETWORK_ERROR',
            status: 0,
          },
        };
      }
      return {
        session: null,
        error: this.normalizeError(error, 'Erreur lors de la connexion'),
      };
    }
  }

  async signOut(): Promise<void> {
    const user = this.getCurrentUser();
    this.currentToken = null;
    this.clearStoredToken();
    this.currentUserSubject.next(null);
    this.currentProfileSubject.next(null);
    this.activeRoleSignal.set(null);

    // Nettoyer le rôle sauvegardé dans localStorage
    if (user) {
      try {
        localStorage.removeItem(`activeRole_${user.id}`);
      } catch (error) {
        console.warn('[CustomAuthService] Impossible de supprimer le rôle sauvegardé:', error);
      }
    }

    this.router.navigate(['/login']);
  }

  async requestPasswordReset(email: string): Promise<{ error: ServiceError | null }> {
    try {
      const response = await fetch(`${this.authApiUrl}/auth-reset-request`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'apikey': environment.supabaseAnonKey,
          'Authorization': `Bearer ${environment.supabaseAnonKey}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: {
            message: data.error || 'Erreur lors de la demande de réinitialisation',
            code: data.code,
            status: response.status,
          },
        };
      }

      return { error: null };
    } catch (error) {
      return {
        error: this.normalizeError(error, 'Erreur lors de la demande de réinitialisation de mot de passe'),
      };
    }
  }

  async updatePassword(newPassword: string, resetToken?: string): Promise<{ error: ServiceError | null }> {
    try {
      // Si resetToken est fourni, c'est une réinitialisation
      if (resetToken) {
        const response = await fetch(`${this.authApiUrl}/auth-reset-confirm`, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
            'apikey': environment.supabaseAnonKey,
            'Authorization': `Bearer ${environment.supabaseAnonKey}`,
          },
          body: JSON.stringify({ token: resetToken, newPassword }),
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            error: {
              message: data.error || 'Erreur lors de la réinitialisation',
              code: data.code,
              status: response.status,
            },
          };
        }

        return { error: null };
      }

      // Sinon, c'est une mise à jour de mot de passe (nécessite d'être connecté)
      // Pour l'instant, on retourne une erreur car cette fonctionnalité n'est pas implémentée
      return {
        error: {
          message: 'Mise à jour de mot de passe non implémentée. Utilisez la réinitialisation.',
          code: 'NOT_IMPLEMENTED',
        },
      };
    } catch (error) {
      return {
        error: this.normalizeError(error, 'Erreur lors de la mise à jour du mot de passe'),
      };
    }
  }

  getCurrentUser(): CustomUser | null {
    return this.currentUserSubject.value;
  }

  async getSession(): Promise<CustomSession | null> {
    const token = this.getStoredToken();
    if (!token) {
      return null;
    }

    const validation = await this.validateToken(token);
    if (validation.valid && validation.user) {
      return {
        user: validation.user,
        token,
      };
    }

    return null;
  }

  private async validateToken(token: string): Promise<{ valid: boolean; user?: CustomUser }> {
    try {
      const response = await fetch(`${this.authApiUrl}/auth-validate`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'apikey': environment.supabaseAnonKey,
          'Authorization': `Bearer ${environment.supabaseAnonKey}`,
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.valid && data.user) {
        return {
          valid: true,
          user: {
            id: data.user.id,
            email: data.user.email,
            email_verified: data.user.email_verified,
          },
        };
      }

      return { valid: false };
    } catch (error) {
      console.error('Error validating token:', error);
      return { valid: false };
    }
  }

  getCurrentProfile(): Profile | null {
    return this.currentProfileSubject.value;
  }

  private profileLoadingPromise: Promise<Profile | null> | null = null;

  async getProfile(): Promise<Profile | null> {
    // Si un chargement est déjà en cours, retourner la même promesse
    if (this.profileLoadingPromise) {
      return this.profileLoadingPromise;
    }

    // Si le profil est déjà chargé, le retourner immédiatement
    const currentProfile = this.currentProfileSubject.value;
    if (currentProfile) {
      return currentProfile;
    }

    const user = this.getCurrentUser();
    if (!user) {
      return null;
    }

    // Créer une promesse de chargement
    this.profileLoadingPromise = (async () => {
      try {
        console.log('[CustomAuthService] Loading profile for user:', { id: user.id, email: user.email });
        
        // Utiliser l'Edge Function pour récupérer le profil (contourne RLS)
        if (!this.currentToken) {
          console.error('[CustomAuthService] No token available for profile fetch');
          return null;
        }

        const response = await fetch(`${this.authApiUrl}/auth-get-profile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': environment.supabaseAnonKey,
            'Authorization': `Bearer ${this.currentToken}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[CustomAuthService] Error fetching profile from Edge Function:', errorData);
          return null;
        }

        const { profile: profileData } = await response.json();

        if (!profileData) {
          console.warn('[CustomAuthService] Profile data is null or undefined');
          return null;
        }
        
        if (!profileData) {
          console.warn('[CustomAuthService] Profile data is null or undefined');
          return null;
        }

        // S'assurer que roles est un tableau
        if (!Array.isArray(profileData.roles)) {
          console.warn('[CustomAuthService] Roles is not an array, converting:', profileData.roles);
          profileData.roles = profileData.roles ? [profileData.roles] : [];
        }

        console.log('[CustomAuthService] Profile loaded:', { 
          id: profileData.id,
          roles: profileData.roles,
          rolesLength: profileData.roles?.length
        });

        this.currentProfileSubject.next(profileData);

        // Restaurer le rôle sauvegardé après avoir chargé le profil
        if (profileData.roles && profileData.roles.length > 0) {
          if (profileData.roles.length === 1) {
            // Un seul rôle, le définir automatiquement
            console.log('[CustomAuthService] Setting single role:', profileData.roles[0]);
            this.activeRoleSignal.set(profileData.roles[0]);
            this.saveActiveRole(profileData.roles[0]);
          } else {
            // Plusieurs rôles, restaurer le rôle sauvegardé
            console.log('[CustomAuthService] Multiple roles found, restoring saved role');
            this.restoreActiveRole();
          }
        } else {
          console.warn('[CustomAuthService] No roles found for user:', user.id, 'Profile:', profileData);
        }

        return profileData;
      } finally {
        // Réinitialiser la promesse après le chargement
        this.profileLoadingPromise = null;
      }
    })();

    return this.profileLoadingPromise;
  }

  private async loadProfile() {
    const profile = await this.getProfile();
    if (profile && profile.roles && profile.roles.length > 0) {
      // Si un seul rôle, le définir automatiquement
      if (profile.roles.length === 1) {
        this.activeRoleSignal.set(profile.roles[0]);
        this.saveActiveRole(profile.roles[0]);
      } else {
        // Pour plusieurs rôles, restaurer automatiquement le rôle sauvegardé lors du rechargement
        this.restoreActiveRole();
      }
    } else if (!profile) {
      // Le profil n'existe pas - c'est un problème qu'on doit logger
      // Cela peut arriver si le profil n'a pas été créé lors du signup
      const user = this.getCurrentUser();
      if (user) {
        console.warn('[CustomAuthService] Profile missing for user:', user.id, user.email);
        // Ne pas créer automatiquement le profil ici car on ne connaît pas les rôles
        // Le profil devrait être créé lors du signup
      }
    }
  }

  async addRoleToProfile(newRole: string): Promise<ProfileMutationResult> {
    const user = this.getCurrentUser();
    if (!user) {
      return { profile: null, error: { message: 'User not authenticated', code: 'user_not_authenticated' } };
    }

    try {
      const { data, error } = await this.supabaseService.client
        .rpc('add_role_to_profile', {
          user_id: user.id,
          new_role: newRole,
        });

      if (error) {
        return { profile: null, error };
      }

      // Recharger le profil
      const updatedProfile = await this.getProfile();
      return { profile: updatedProfile, error: null };
    } catch (error) {
      return { profile: null, error: this.normalizeError(error, 'Erreur lors de l\'ajout du rôle') };
    }
  }

  setActiveRole(role: string) {
    const profile = this.currentProfileSubject.value;
    if (profile && profile.roles.includes(role)) {
      this.activeRoleSignal.set(role);
      this.saveActiveRole(role);
      // Initialiser les données pour le nouveau rôle
      this.appInitializationService.initializeForRole(role);
    }
  }

  private saveActiveRole(role: string): void {
    const user = this.getCurrentUser();
    if (user) {
      try {
        localStorage.setItem(`activeRole_${user.id}`, role);
      } catch (error) {
        console.warn('[CustomAuthService] Impossible de sauvegarder le rôle actif:', error);
      }
    }
  }

  private restoreActiveRole(): void {
    const user = this.getCurrentUser();
    const profile = this.currentProfileSubject.value;

    if (!user || !profile || profile.roles.length === 0) {
      return;
    }

    try {
      const savedRole = localStorage.getItem(`activeRole_${user.id}`);
      if (savedRole && profile.roles.includes(savedRole)) {
        console.log('[CustomAuthService] Restauration du rôle actif:', savedRole);
        this.activeRoleSignal.set(savedRole);
      } else if (profile.roles.length === 1) {
        // Si un seul rôle, le définir automatiquement
        this.activeRoleSignal.set(profile.roles[0]);
        this.saveActiveRole(profile.roles[0]);
      }
    } catch (error) {
      console.warn('[CustomAuthService] Impossible de restaurer le rôle actif:', error);
      // En cas d'erreur, utiliser le premier rôle si un seul rôle disponible
      if (profile.roles.length === 1) {
        this.activeRoleSignal.set(profile.roles[0]);
      }
    }
  }

  getActiveRole(): string | null {
    return this.activeRoleSignal();
  }

  hasRole(role: string): boolean {
    const profile = this.currentProfileSubject.value;
    return profile ? profile.roles.includes(role) : false;
  }

  hasMultipleRoles(): boolean {
    const profile = this.currentProfileSubject.value;
    return profile ? profile.roles.length > 1 : false;
  }

  getToken(): string | null {
    return this.currentToken || this.getStoredToken();
  }

  async createProfileWithRoles(userId: string, roles: string[]): Promise<ProfileMutationResult> {
    try {
      // Vérifier d'abord si le profil existe déjà
      const { data: existingProfile, error: checkError } = await this.supabaseService.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // Si le profil existe déjà, utiliser add_role_to_profile pour chaque rôle
      if (existingProfile && !checkError) {
        for (const role of roles) {
          // Vérifier si le rôle existe déjà
          const roleExists = existingProfile.roles.includes(role);

          if (!roleExists) {
            const { error: addError } = await this.supabaseService.client
              .rpc('add_role_to_profile', {
                user_id: userId,
                new_role: role,
              });

            if (addError) {
              console.error(`Error adding role ${role}:`, addError);
            }
          }
        }
        // Recharger le profil
        const profile = await this.getProfile();
        return { profile, error: null };
      }

      // Si le profil n'existe pas, utiliser create_profile_after_signup
      const { data, error } = await this.supabaseService.client
        .rpc('create_profile_after_signup', {
          user_id: userId,
          roles_array: roles,
          metadata_json: null,
        });

      if (error) {
        return { profile: null, error };
      }

      // Recharger le profil
      const profile = await this.getProfile();
      return { profile, error: null };
    } catch (error) {
      return { profile: null, error: this.normalizeError(error, 'Erreur lors de la création du profil') };
    }
  }

  private normalizeError(error: unknown, fallbackMessage: string): ServiceError {
    if (error && typeof error === 'object') {
      const candidate = error as { message?: unknown; code?: unknown; status?: unknown; name?: unknown };
      const message = typeof candidate.message === 'string' ? candidate.message : fallbackMessage;
      const code = typeof candidate.code === 'string' ? candidate.code : undefined;
      const status = typeof candidate.status === 'number' ? candidate.status : undefined;
      const name = typeof candidate.name === 'string' ? candidate.name : undefined;

      return { message, code, status, name };
    }

    return { message: fallbackMessage };
  }
}

