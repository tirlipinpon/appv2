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

  async signUp(email: string, password: string, roles: string[]): Promise<{ user: User | null; error: any }> {
    try {
      const { data, error } = await this.supabaseService.client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: {
            roles: roles // Stocker les rôles dans les metadata de l'utilisateur
          }
        }
      });

      if (error) {
        return { user: null, error };
      }

      // Ne pas créer le profil immédiatement car l'utilisateur n'est pas encore confirmé
      // Le profil sera créé automatiquement par le trigger handle_new_user lors de la confirmation
      // Les rôles seront ajoutés après confirmation d'email dans auth-confirm component

      return { user: data.user, error: null };
    } catch (error) {
      return { user: null, error };
    }
  }

  async createProfileWithRoles(userId: string, roles: string[]): Promise<{ profile: Profile | null; error: any }> {
    try {
      // Vérifier d'abord si le profil existe déjà
      const { data: existingProfile, error: checkError } = await this.supabaseService.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Si le profil existe déjà, utiliser add_role_to_profile pour chaque rôle
      if (existingProfile && !checkError) {
        const results = [];
        for (const role of roles) {
          // Vérifier si le rôle existe déjà
          if (!existingProfile.roles.includes(role)) {
            const { error: addError } = await this.supabaseService.client
              .rpc('add_role_to_profile', {
                user_id: userId,
                new_role: role
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
          metadata_json: null
        });

      if (error) {
        return { profile: null, error };
      }

      // Recharger le profil
      const profile = await this.getProfile();
      return { profile, error: null };
    } catch (error: any) {
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
    const user = this.getCurrentUser();
    if (!user) {
      return { profile: null, error: { message: 'User not authenticated' } };
    }

    try {
      const { data, error } = await this.supabaseService.client
        .rpc('add_role_to_profile', {
          user_id: user.id,
          new_role: newRole
        });

      if (error) {
        return { profile: null, error };
      }

      // Recharger le profil
      const updatedProfile = await this.getProfile();
      return { profile: updatedProfile, error: null };
    } catch (error) {
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
