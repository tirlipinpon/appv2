import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from '../supabase/supabase.service';
import type { User, Session } from '@supabase/supabase-js';
// import { AppInitializationService } from '../initialization/app-initialization.service'; // Service déplacé vers admin
import type { ServiceError } from '../error/error-handler.service';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  roles: string[];
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SignupResult {
  user: User | null;
  error: ServiceError | null;
  existingUser?: boolean;
  hasRole?: boolean;
}

export interface ProfileMutationResult {
  profile: Profile | null;
  error: ServiceError | null;
}

export interface SignInResult {
  session: Session | null;
  error: ServiceError | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  // private readonly appInitializationService = inject(AppInitializationService); // Service déplacé vers admin
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private currentProfileSubject = new BehaviorSubject<Profile | null>(null);
  private activeRoleSignal = signal<string | null>(null);

  public currentUser$ = this.currentUserSubject.asObservable();
  public currentProfile$ = this.currentProfileSubject.asObservable();
  public activeRole$ = computed(() => this.activeRoleSignal());

  /**
   * Retourne le profil actuel sans faire d'appel API
   */
  getCurrentProfile(): Profile | null {
    return this.currentProfileSubject.value;
  }

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    // Vérifier la session existante
    const { data: { session } } = await this.supabaseService.client.auth.getSession();
    if (session) {
      this.currentUserSubject.next(session.user);
      await this.loadProfile();
      // Ne pas restaurer automatiquement le rôle ici
      // La restauration se fera dans les composants qui en ont besoin (login, dashboard)
      // Cela évite de restaurer quand l'utilisateur arrive sur /select-role
    }

    // Écouter les changements d'authentification
    this.supabaseService.client.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && session) {
        this.currentUserSubject.next(session.user);
        await this.loadProfile();
        // Ne pas restaurer automatiquement le rôle ici
        // La restauration se fera dans les composants qui en ont besoin (login)
      } else if (event === 'SIGNED_OUT') {
        const user = this.getCurrentUser();
        this.currentUserSubject.next(null);
        this.currentProfileSubject.next(null);
        this.activeRoleSignal.set(null);
        
        // Nettoyer le rôle sauvegardé dans localStorage
        if (user) {
          try {
            localStorage.removeItem(`activeRole_${user.id}`);
          } catch (error) {
            console.warn('[AuthService] Impossible de supprimer le rôle sauvegardé:', error);
          }
        }
      }
    });
  }

  async checkUserExists(email: string): Promise<{ exists: boolean; hasRole: boolean; isConfirmed: boolean; existingRoles: string[] }> {
    try {
      const normalizedEmail = this.normalizeEmail(email);
      const { data: profile, error } = await this.supabaseService.client
        .from('profiles')
        .select('roles')
        .eq('id', normalizedEmail)
        .maybeSingle();

      // Si erreur ou pas de profil trouvé
      if (error || !profile) {
        return { exists: false, hasRole: false, isConfirmed: false, existingRoles: [] };
      }

      // Profil trouvé, extraire les informations
      const existingRoles = profile.roles || [];
      const hasRole = existingRoles.length > 0;
      
      // Vérifier si l'utilisateur est confirmé en vérifiant dans auth.users
      // Note: On suppose que si le profil existe, l'utilisateur est confirmé
      // Pour une vérification plus précise, on pourrait utiliser une fonction RPC
      const isConfirmed = true; // Le profil existe, donc l'utilisateur est confirmé

      return { 
        exists: true, 
        hasRole, 
        isConfirmed, 
        existingRoles 
      };
    } catch (error) {
      console.error('❌ [AUTH] checkUserExists() - Exception:', error);
      return { exists: false, hasRole: false, isConfirmed: false, existingRoles: [] };
    }
  }

  async signUp(email: string, password: string, roles: string[]): Promise<SignupResult> {
    try {
      const normalizedEmail = this.normalizeEmail(email);
      const signUpOptions = {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: {
          roles: roles // Stocker les rôles dans les metadata de l'utilisateur
        }
      };
      
      const { data, error } = await this.supabaseService.client.auth.signUp({
        email: normalizedEmail,
        password,
        options: signUpOptions
      });

      if (error) {
        // Vérifier si c'est une erreur "already registered"
        const isAlreadyRegistered = error.message?.includes('already registered') || 
                                     error.message?.includes('User already registered') ||
                                     error.message?.includes('already exists');
        
        if (isAlreadyRegistered) {
          // Vérifier si l'utilisateur a déjà ce rôle
          try {
            // Essayer de récupérer le profil via une fonction RPC ou directement
            // Pour l'instant, on retourne l'info que l'utilisateur existe
            return { 
              user: null, 
              error: { ...error, code: 'already_registered' },
              existingUser: true,
              hasRole: false // On ne peut pas vérifier sans être connecté, sera vérifié après login
            };
          } catch {
            return { 
              user: null, 
              error: { ...error, code: 'already_registered' },
              existingUser: true,
              hasRole: false
            };
          }
        }
        
        return { user: null, error };
      }

      // Vérifier si l'utilisateur existe déjà (même si Supabase ne retourne pas d'erreur)
      // PROBLÈME : Supabase peut créer un NOUVEL utilisateur avec le même email au lieu de retourner une erreur
      // SOLUTION : Vérifier si un autre utilisateur avec le même email existe déjà dans auth.users via RPC
      if (data.user && !data.session) {
        // Utiliser la fonction RPC pour vérifier si un AUTRE utilisateur avec le même email existe déjà
        // On exclut l'utilisateur qui vient d'être créé pour éviter les faux positifs
        const { data: emailExists, error: checkError } = await this.supabaseService.client
          .rpc('check_email_exists', { 
            email_to_check: normalizedEmail,
            exclude_user_id: data.user.id // Exclure l'utilisateur qui vient d'être créé
          });

        // Si un AUTRE utilisateur avec le même email existe déjà (et que ce n'est pas une erreur de la fonction RPC)
        if (emailExists === true && !checkError) {
          // Un autre utilisateur avec le même email existe déjà, Supabase a créé un doublon
          // On doit proposer d'ajouter le rôle au compte existant
          return {
            user: null,
            error: {
              message: 'Ce compte existe déjà. Souhaitez-vous ajouter ce rôle à votre compte existant ?',
              code: 'already_registered'
            },
            existingUser: true,
            hasRole: false
          };
        }

        // Vérifier aussi si un profil existe déjà avec cet ID (utilisateur confirmé précédemment)
        const { data: existingProfile, error: profileError } = await this.supabaseService.client
          .from('profiles')
          .select('roles')
          .eq('id', data.user.id)
          .maybeSingle();

        if (existingProfile && !profileError) {
          // Le profil existe déjà, vérifier si le rôle existe
          const requestedRole = roles[0];
          
          if (existingProfile.roles && existingProfile.roles.includes(requestedRole)) {
            return {
              user: null,
              error: {
                message: `Vous avez déjà le rôle '${requestedRole}'. Connectez-vous avec votre compte existant.`,
                code: 'role_already_exists'
              },
              existingUser: true,
              hasRole: true
            };
          }
        }
        // Si le profil n'existe pas, c'est soit une nouvelle inscription, soit un utilisateur non confirmé
        // Dans ce cas, on laisse passer pour permettre la confirmation d'email
      }

      // Si une session est créée automatiquement (en développement), initialiser l'utilisateur
      if (data.session) {
        this.currentUserSubject.next(data.session.user);
        // Ne pas charger le profil immédiatement car il n'est peut-être pas encore créé
        // Il sera chargé lors de la navigation
      }

      // Ne pas créer le profil immédiatement car l'utilisateur n'est pas encore confirmé
      // Le profil sera créé automatiquement par le trigger handle_new_user lors de la confirmation
      // Les rôles seront ajoutés après confirmation d'email dans auth-confirm component

      return { user: data.user, error: null };
    } catch (error) {
      console.error('💥 [AUTH] signUp() - Exception:', error);
      return { user: null, error: this.normalizeError(error, 'Erreur inconnue lors de l\'inscription') };
    }
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
                new_role: role
              });
            
            if (addError) {
              console.error(`❌ [AUTH] Error adding role ${role}:`, addError);
            }
          }
        }
        // Recharger le profil
        const profile = await this.getProfile();
        return { profile, error: null };
      }

      // Si le profil n'existe pas, utiliser create_profile_after_signup
      const { error } = await this.supabaseService.client
        .rpc('create_profile_after_signup', {
          user_id: userId,
          roles_array: roles,
          metadata_json: null
        });

      if (error) {
        console.error('❌ [AUTH] create_profile_after_signup error:', error);
        return { profile: null, error };
      }

      // Recharger le profil
      const profile = await this.getProfile();
      return { profile, error: null };
    } catch (error) {
      console.error('💥 [AUTH] createProfileWithRoles() - Exception:', error);
      return { profile: null, error: this.normalizeError(error, 'Erreur lors de la création du profil') };
    }
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    try {
      const normalizedEmail = this.normalizeEmail(email);
      const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        return { session: null, error };
      }

      if (data.session) {
        this.currentUserSubject.next(data.session.user);
        await this.loadProfile();
        
        // Initialiser les données pour le rôle actif si disponible
        // Note: L'initialisation doit être gérée dans l'application admin
        // const activeRole = this.getActiveRole();
        // if (activeRole) {
        //   this.appInitializationService.initializeForRole(activeRole);
        // }
      }

      return { session: data.session, error: null };
    } catch (error) {
      return { session: null, error: this.normalizeError(error, 'Erreur lors de la connexion') };
    }
  }

  async signOut(): Promise<void> {
    const user = this.getCurrentUser();
    await this.supabaseService.client.auth.signOut();
    this.currentUserSubject.next(null);
    this.currentProfileSubject.next(null);
    this.activeRoleSignal.set(null);
    
    // Nettoyer le rôle sauvegardé dans localStorage
    if (user) {
      try {
        localStorage.removeItem(`activeRole_${user.id}`);
      } catch (error) {
        console.warn('[AuthService] Impossible de supprimer le rôle sauvegardé:', error);
      }
    }
    
    this.router.navigate(['/login']);
  }

  async requestPasswordReset(email: string): Promise<{ error: ServiceError | null }> {
    try {
      const normalizedEmail = this.normalizeEmail(email);
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/auth/reset` : undefined;
      const { error } = await this.supabaseService.client.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: this.normalizeError(error, 'Erreur lors de la demande de réinitialisation de mot de passe') };
    }
  }

  async updatePassword(newPassword: string): Promise<{ error: ServiceError | null }> {
    try {
      const { error } = await this.supabaseService.client.auth.updateUser({ password: newPassword });

      if (error) {
        return { error };
      }

      // Recharger la session et le profil
      const { data } = await this.supabaseService.client.auth.getSession();
      if (data.session) {
        this.currentUserSubject.next(data.session.user);
        await this.loadProfile();
      }

      return { error: null };
    } catch (error) {
      return { error: this.normalizeError(error, 'Erreur lors de la mise à jour du mot de passe') };
    }
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.supabaseService.client.auth.getSession();
    if (error) {
      console.error('Erreur lors de la récupération de la session:', error);
      return null;
    }
    return data.session;
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
        const { data: profileData, error } = await this.supabaseService.client
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          return null;
        }

        let finalProfileData = profileData;

        // Si le profil existe mais n'a pas de rôles, vérifier user_metadata et ajouter les rôles
        if (profileData && (!profileData.roles || profileData.roles.length === 0)) {
          const rolesFromMetadata = (user.user_metadata?.['roles'] as string[] | undefined) || [];
          if (rolesFromMetadata.length > 0) {
            // Ajouter les rôles au profil
            await this.createProfileWithRoles(user.id, rolesFromMetadata);
            // Recharger le profil pour obtenir la version mise à jour (sans passer par getProfile pour éviter les récursions)
            const { data: updatedData, error: updateError } = await this.supabaseService.client
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
            if (!updateError && updatedData) {
              finalProfileData = updatedData;
            }
          }
        }

        this.currentProfileSubject.next(finalProfileData);
        
        // Restaurer le rôle sauvegardé après avoir chargé le profil
        if (finalProfileData && finalProfileData.roles && finalProfileData.roles.length > 0) {
          if (finalProfileData.roles.length === 1) {
            // Un seul rôle, le définir automatiquement
            this.activeRoleSignal.set(finalProfileData.roles[0]);
            this.saveActiveRole(finalProfileData.roles[0]);
          } else {
            // Plusieurs rôles, restaurer le rôle sauvegardé
            this.restoreActiveRole();
          }
        }
        
        return finalProfileData;
      } finally {
        // Réinitialiser la promesse après le chargement
        this.profileLoadingPromise = null;
      }
    })();

    return this.profileLoadingPromise;
  }

  private async loadProfile() {
    const profile = await this.getProfile();
    if (profile && profile.roles.length > 0) {
      // Si un seul rôle, le définir automatiquement
      if (profile.roles.length === 1) {
        this.activeRoleSignal.set(profile.roles[0]);
        this.saveActiveRole(profile.roles[0]);
      } else {
        // Pour plusieurs rôles, restaurer automatiquement le rôle sauvegardé lors du rechargement
        // Cela permet de conserver le dernier rôle sélectionné après un refresh
        this.restoreActiveRole();
      }
    }
  }

  async addRoleToProfile(newRole: string): Promise<ProfileMutationResult> {
    const user = this.getCurrentUser();
    
    if (!user) {
      console.error('❌ [AUTH] User not authenticated');
      return { profile: null, error: { message: 'User not authenticated', code: 'user_not_authenticated' } };
    }

    try {
      const { error } = await this.supabaseService.client
        .rpc('add_role_to_profile', {
          user_id: user.id,
          new_role: newRole
        });

      if (error) {
        console.error('❌ [AUTH] add_role_to_profile error:', error);
        return { profile: null, error };
      }

      // Recharger le profil
      const updatedProfile = await this.getProfile();
      return { profile: updatedProfile, error: null };
    } catch (error) {
      console.error('💥 [AUTH] addRoleToProfile() - Exception:', error);
      return { profile: null, error: this.normalizeError(error, 'Erreur lors de l\'ajout du rôle') };
    }
  }

  setActiveRole(role: string) {
    const profile = this.currentProfileSubject.value;
    if (profile && profile.roles.includes(role)) {
      this.activeRoleSignal.set(role);
      this.saveActiveRole(role);
      // Initialiser les données pour le nouveau rôle
      // Note: L'initialisation doit être gérée dans l'application admin
      // this.appInitializationService.initializeForRole(role);
    }
  }

  /**
   * Sauvegarde le rôle actif dans localStorage
   */
  private saveActiveRole(role: string): void {
    const user = this.getCurrentUser();
    if (user) {
      try {
        localStorage.setItem(`activeRole_${user.id}`, role);
      } catch (error) {
        console.warn('[AuthService] Impossible de sauvegarder le rôle actif:', error);
      }
    }
  }

  /**
   * Restaure le dernier rôle actif depuis localStorage
   */
  private restoreActiveRole(): void {
    const user = this.getCurrentUser();
    const profile = this.currentProfileSubject.value;
    
    if (!user || !profile || profile.roles.length === 0) {
      return;
    }

    try {
      const savedRole = localStorage.getItem(`activeRole_${user.id}`);
      if (savedRole && profile.roles.includes(savedRole)) {
        this.activeRoleSignal.set(savedRole);
      } else if (profile.roles.length === 1) {
        // Si un seul rôle, le définir automatiquement
        this.activeRoleSignal.set(profile.roles[0]);
        this.saveActiveRole(profile.roles[0]);
      }
    } catch (error) {
      console.warn('[AuthService] Impossible de restaurer le rôle actif:', error);
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

  /**
   * Normalise un email en minuscules et supprime les espaces
   * @param email L'email à normaliser
   * @returns L'email normalisé
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
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
