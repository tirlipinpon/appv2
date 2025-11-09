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
      });

      if (error) {
        return { user: null, error };
      }

      if (data.user) {
        // Appeler la fonction RPC pour créer le profil avec les rôles
        const { data: profileData, error: profileError } = await this.supabaseService.client
          .rpc('create_profile_after_signup', {
            user_id: data.user.id,
            roles_array: roles,
            metadata_json: null
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          return { user: data.user, error: profileError };
        }
      }

      return { user: data.user, error: null };
    } catch (error) {
      return { user: null, error };
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
