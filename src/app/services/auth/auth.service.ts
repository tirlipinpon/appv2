import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from '../supabase/supabase.service';
import type { User, Session, AuthError, PostgrestError } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  roles: string[];
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type ServiceError =
  | (AuthError & { code?: string })
  | (PostgrestError & { status?: number })
  | { message: string; code?: string; status?: number; name?: string };

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
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private currentProfileSubject = new BehaviorSubject<Profile | null>(null);
  private activeRoleSignal = signal<string | null>(null);

  public currentUser$ = this.currentUserSubject.asObservable();
  public currentProfile$ = this.currentProfileSubject.asObservable();
  public activeRole$ = computed(() => this.activeRoleSignal());

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    // Vérifier la session existante
    const { data: { session } } = await this.supabaseService.client.auth.getSession();
    if (session) {
      this.currentUserSubject.next(session.user);
      await this.loadProfile();
    }

    // Écouter les changements d'authentification
    this.supabaseService.client.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && session) {
        this.currentUserSubject.next(session.user);
        await this.loadProfile();
      } else if (event === 'SIGNED_OUT') {
        this.currentUserSubject.next(null);
        this.currentProfileSubject.next(null);
        this.activeRoleSignal.set(null);
      }
    });
  }

  async checkUserExists(email: string): Promise<{ exists: boolean; hasRole: boolean; isConfirmed: boolean; existingRoles: string[] }> {
    try {
      await this.supabaseService.client
        .from('profiles')
        .select('roles')
        .eq('id', email)
        .single();

      return { exists: false, hasRole: false, isConfirmed: false, existingRoles: [] };
    } catch {
      return { exists: false, hasRole: false, isConfirmed: false, existingRoles: [] };
    }
  }

  async signUp(email: string, password: string, roles: string[]): Promise<SignupResult> {
    console.group('🔵 [AUTH] signUp() - START');
    console.log('📤 Input:', { email, roles, rolesType: typeof roles, rolesIsArray: Array.isArray(roles) });
    
    try {
      const signUpOptions = {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: {
          roles: roles // Stocker les rôles dans les metadata de l'utilisateur
        }
      };
      console.log('📤 SignUp Options:', signUpOptions);
      
      const { data, error } = await this.supabaseService.client.auth.signUp({
        email,
        password,
        options: signUpOptions
      });

      console.log('📥 SignUp Response:', { 
        hasData: !!data, 
        hasUser: !!data?.user, 
        hasSession: !!data?.session,
        user: data?.user ? {
          id: data.user.id,
          email: data.user.email,
          user_metadata: data.user.user_metadata,
          app_metadata: data.user.app_metadata
        } : null,
        error: error ? {
          message: error.message,
          status: 'status' in error ? (error as { status?: number }).status : undefined,
          name: 'name' in error ? (error as { name?: string }).name : undefined,
          code: 'code' in error ? (error as { code?: string }).code : undefined
        } : null
      });

      if (error) {
        // Vérifier si c'est une erreur "already registered"
        const isAlreadyRegistered = error.message?.includes('already registered') || 
                                     error.message?.includes('User already registered') ||
                                     error.message?.includes('already exists');
        
        console.log('❌ [AUTH] signUp() - Error detected:', {
          isAlreadyRegistered,
          errorMessage: error.message,
          errorStatus: error.status
        });
        
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
        console.log('⚠️ [AUTH] signUp() - User created but no session, checking if email already exists...');
        
        // Utiliser la fonction RPC pour vérifier si un AUTRE utilisateur avec le même email existe déjà
        // On exclut l'utilisateur qui vient d'être créé pour éviter les faux positifs
        const { data: emailExists, error: checkError } = await this.supabaseService.client
          .rpc('check_email_exists', { 
            email_to_check: email,
            exclude_user_id: data.user.id // Exclure l'utilisateur qui vient d'être créé
          });

        console.log('🔍 [AUTH] signUp() - check_email_exists RPC result:', {
          emailExists,
          excludeUserId: data.user.id,
          checkError: checkError ? {
            message: checkError.message,
            code: checkError.code
          } : null
        });

        // Si un AUTRE utilisateur avec le même email existe déjà (et que ce n'est pas une erreur de la fonction RPC)
        if (emailExists === true && !checkError) {
          console.log('⚠️ [AUTH] signUp() - Another user with same email exists! Supabase created duplicate user.');
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

        console.log('📥 [AUTH] signUp() - Profile check result:', {
          existingProfile,
          profileError,
          existingRoles: existingProfile?.roles
        });

        if (existingProfile && !profileError) {
          // Le profil existe déjà, vérifier si le rôle existe
          const requestedRole = roles[0];
          console.log('🔍 [AUTH] signUp() - Checking if role exists:', {
            requestedRole,
            existingRoles: existingProfile.roles,
            roleExists: existingProfile.roles?.includes(requestedRole)
          });
          
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

      // Ne pas créer le profil immédiatement car l'utilisateur n'est pas encore confirmé
      // Le profil sera créé automatiquement par le trigger handle_new_user lors de la confirmation
      // Les rôles seront ajoutés après confirmation d'email dans auth-confirm component

      console.log('✅ [AUTH] signUp() - Success, returning user:', {
        userId: data.user?.id,
        email: data.user?.email,
        userMetadata: data.user?.user_metadata
      });
      console.groupEnd();
      return { user: data.user, error: null };
    } catch (error) {
      console.error('💥 [AUTH] signUp() - Exception:', error);
      console.groupEnd();
      return { user: null, error: this.normalizeError(error, 'Erreur inconnue lors de l\'inscription') };
    }
  }

  async createProfileWithRoles(userId: string, roles: string[]): Promise<ProfileMutationResult> {
    console.group('🟢 [AUTH] createProfileWithRoles() - START');
    console.log('📤 Input:', { userId, roles, rolesType: typeof roles, rolesIsArray: Array.isArray(roles) });
    
    try {
      // Vérifier d'abord si le profil existe déjà
      console.log('🔍 [AUTH] Checking if profile exists...');
      const { data: existingProfile, error: checkError } = await this.supabaseService.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      console.log('📥 [AUTH] Profile check result:', {
        existingProfile,
        checkError,
        existingRoles: existingProfile?.roles
      });

      // Si le profil existe déjà, utiliser add_role_to_profile pour chaque rôle
      if (existingProfile && !checkError) {
        console.log('✅ [AUTH] Profile exists, adding roles one by one...');
        for (const role of roles) {
          // Vérifier si le rôle existe déjà
          const roleExists = existingProfile.roles.includes(role);
          console.log(`🔍 [AUTH] Role '${role}':`, { roleExists, existingRoles: existingProfile.roles });
          
          if (!roleExists) {
            console.log(`➕ [AUTH] Adding role '${role}'...`);
            const { data: addData, error: addError } = await this.supabaseService.client
              .rpc('add_role_to_profile', {
                user_id: userId,
                new_role: role
              });
            
            console.log(`📥 [AUTH] add_role_to_profile('${role}') result:`, { addData, addError });
            
            if (addError) {
              console.error(`❌ [AUTH] Error adding role ${role}:`, addError);
            } else {
              console.log(`✅ [AUTH] Role '${role}' added successfully`);
            }
          } else {
            console.log(`⏭️ [AUTH] Role '${role}' already exists, skipping`);
          }
        }
        // Recharger le profil
        console.log('🔄 [AUTH] Reloading profile...');
        const profile = await this.getProfile();
        console.log('📥 [AUTH] Final profile:', profile);
        console.groupEnd();
        return { profile, error: null };
      }

      // Si le profil n'existe pas, utiliser create_profile_after_signup
      console.log('🆕 [AUTH] Profile does not exist, creating with create_profile_after_signup...');
      const { data, error } = await this.supabaseService.client
        .rpc('create_profile_after_signup', {
          user_id: userId,
          roles_array: roles,
          metadata_json: null
        });

      console.log('📥 [AUTH] create_profile_after_signup result:', { data, error });

      if (error) {
        console.error('❌ [AUTH] create_profile_after_signup error:', error);
        console.groupEnd();
        return { profile: null, error };
      }

      // Recharger le profil
      console.log('🔄 [AUTH] Reloading profile...');
      const profile = await this.getProfile();
      console.log('📥 [AUTH] Final profile:', profile);
      console.groupEnd();
      return { profile, error: null };
    } catch (error) {
      console.error('💥 [AUTH] createProfileWithRoles() - Exception:', error);
      console.groupEnd();
      return { profile: null, error: this.normalizeError(error, 'Erreur lors de la création du profil') };
    }
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    try {
      const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { session: null, error };
      }

      if (data.session) {
        this.currentUserSubject.next(data.session.user);
        await this.loadProfile();
      }

      return { session: data.session, error: null };
    } catch (error) {
      return { session: null, error: this.normalizeError(error, 'Erreur lors de la connexion') };
    }
  }

  async signOut(): Promise<void> {
    await this.supabaseService.client.auth.signOut();
    this.currentUserSubject.next(null);
    this.currentProfileSubject.next(null);
    this.activeRoleSignal.set(null);
    this.router.navigate(['/login']);
  }

  async requestPasswordReset(email: string): Promise<{ error: ServiceError | null }> {
    try {
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/auth/reset` : undefined;
      const { error } = await this.supabaseService.client.auth.resetPasswordForEmail(email, {
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

  async getProfile(): Promise<Profile | null> {
    const user = this.getCurrentUser();
    if (!user) {
      return null;
    }

    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    this.currentProfileSubject.next(data);
    return data;
  }

  private async loadProfile() {
    const profile = await this.getProfile();
    if (profile && profile.roles.length > 0) {
      // Si un seul rôle, le définir automatiquement
      if (profile.roles.length === 1) {
        this.activeRoleSignal.set(profile.roles[0]);
      }
    }
  }

  async addRoleToProfile(newRole: string): Promise<ProfileMutationResult> {
    console.group('🟡 [AUTH] addRoleToProfile() - START');
    const user = this.getCurrentUser();
    console.log('📤 Input:', { newRole, userId: user?.id, userEmail: user?.email });
    
    if (!user) {
      console.error('❌ [AUTH] User not authenticated');
      console.groupEnd();
      return { profile: null, error: { message: 'User not authenticated', code: 'user_not_authenticated' } };
    }

    try {
      // Récupérer le profil actuel avant
      const currentProfile = await this.getProfile();
      console.log('📥 [AUTH] Current profile before:', currentProfile);
      
      const { data, error } = await this.supabaseService.client
        .rpc('add_role_to_profile', {
          user_id: user.id,
          new_role: newRole
        });

      console.log('📥 [AUTH] add_role_to_profile RPC result:', { data, error });

      if (error) {
        console.error('❌ [AUTH] add_role_to_profile error:', error);
        console.groupEnd();
        return { profile: null, error };
      }

      // Recharger le profil
      const updatedProfile = await this.getProfile();
      console.log('📥 [AUTH] Updated profile after:', updatedProfile);
      console.groupEnd();
      return { profile: updatedProfile, error: null };
    } catch (error) {
      console.error('💥 [AUTH] addRoleToProfile() - Exception:', error);
      console.groupEnd();
      return { profile: null, error: this.normalizeError(error, 'Erreur lors de l\'ajout du rôle') };
    }
  }

  setActiveRole(role: string) {
    const profile = this.currentProfileSubject.value;
    if (profile && profile.roles.includes(role)) {
      this.activeRoleSignal.set(role);
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
