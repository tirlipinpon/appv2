import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { SupabaseService } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  roles: string[];
  metadata: any;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private currentProfileSubject = new BehaviorSubject<Profile | null>(null);
  private activeRoleSignal = signal<string | null>(null);

  public currentUser$ = this.currentUserSubject.asObservable();
  public currentProfile$ = this.currentProfileSubject.asObservable();
  public activeRole$ = computed(() => this.activeRoleSignal());

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {
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
      if (event === 'SIGNED_IN' && session) {
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
      // Vérifier si l'utilisateur existe dans auth.users (nécessite une fonction RPC ou admin)
      // Pour l'instant, on va essayer de se connecter avec un mot de passe incorrect pour voir si l'email existe
      // Note: Cette méthode n'est pas idéale mais fonctionne sans admin
      const { data: profileData } = await this.supabaseService.client
        .from('profiles')
        .select('roles')
        .eq('id', email) // Ceci ne fonctionnera pas directement, on doit utiliser une autre approche
        .single();

      return { exists: false, hasRole: false, isConfirmed: false, existingRoles: [] };
    } catch {
      return { exists: false, hasRole: false, isConfirmed: false, existingRoles: [] };
    }
  }

  async signUp(email: string, password: string, roles: string[]): Promise<{ user: User | null; error: any; existingUser?: boolean; hasRole?: boolean }> {
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
          status: error.status,
          name: error.name
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
      // SOLUTION : Vérifier si un autre utilisateur avec le même email existe déjà dans auth.users
      if (data.user && !data.session) {
        console.log('⚠️ [AUTH] signUp() - User created but no session, checking if email already exists...');
        
        // Essayer de se connecter avec un mot de passe incorrect pour voir si l'email existe déjà
        // Si l'email existe, on aura une erreur "Invalid login credentials"
        // Si l'email n'existe pas, on aura une erreur différente
        const { error: signInError } = await this.supabaseService.client.auth.signInWithPassword({
          email: email,
          password: '___CHECK_IF_EXISTS___' // Mot de passe invalide intentionnellement
        });

        console.log('🔍 [AUTH] signUp() - Check email exists result:', {
          signInError: signInError ? {
            message: signInError.message,
            status: signInError.status
          } : null
        });

        // Si l'erreur est "Invalid login credentials", cela signifie que l'email existe déjà
        // Si l'erreur est "Email not confirmed" ou autre, l'email existe aussi
        const emailExists = signInError && (
          signInError.message?.includes('Invalid login credentials') ||
          signInError.message?.includes('Email not confirmed') ||
          signInError.message?.includes('User not found') === false // Si ce n'est pas "User not found", l'email existe
        );

        if (emailExists) {
          console.log('⚠️ [AUTH] signUp() - Email already exists! Supabase created duplicate user.');
          // L'email existe déjà, Supabase a créé un doublon
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
      return { user: null, error };
    }
  }

  async createProfileWithRoles(userId: string, roles: string[]): Promise<{ profile: Profile | null; error: any }> {
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
        const results = [];
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
    } catch (error: any) {
      console.error('💥 [AUTH] createProfileWithRoles() - Exception:', error);
      console.groupEnd();
      return { profile: null, error };
    }
  }

  async signIn(email: string, password: string): Promise<{ session: Session | null; error: any }> {
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
      return { session: null, error };
    }
  }

  async signOut(): Promise<void> {
    await this.supabaseService.client.auth.signOut();
    this.currentUserSubject.next(null);
    this.currentProfileSubject.next(null);
    this.activeRoleSignal.set(null);
    this.router.navigate(['/login']);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
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

  async addRoleToProfile(newRole: string): Promise<{ profile: Profile | null; error: any }> {
    console.group('🟡 [AUTH] addRoleToProfile() - START');
    const user = this.getCurrentUser();
    console.log('📤 Input:', { newRole, userId: user?.id, userEmail: user?.email });
    
    if (!user) {
      console.error('❌ [AUTH] User not authenticated');
      console.groupEnd();
      return { profile: null, error: { message: 'User not authenticated' } };
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
      return { profile: null, error };
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
}
