import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from '../../../shared/services/supabase/supabase.service';
import { AuthCoreService } from '../core/auth-core.service';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  roles: string[];
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Service responsable de la gestion des profils utilisateurs
 * Principe SRP : Gère uniquement les profils
 */
@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authCoreService = inject(AuthCoreService);
  private currentProfileSubject = new BehaviorSubject<Profile | null>(null);
  private profileLoadingPromise: Promise<Profile | null> | null = null;

  public currentProfile$ = this.currentProfileSubject.asObservable();

  getCurrentProfile(): Profile | null {
    return this.currentProfileSubject.value;
  }

  async getProfile(): Promise<Profile | null> {
    if (this.profileLoadingPromise) {
      return this.profileLoadingPromise;
    }

    const currentProfile = this.currentProfileSubject.value;
    if (currentProfile) {
      return currentProfile;
    }

    const user = this.authCoreService.getCurrentUser();
    if (!user) {
      return null;
    }

    this.profileLoadingPromise = (async () => {
      try {
        const { data, error } = await this.supabaseService.client
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          return null;
        }

        this.currentProfileSubject.next(data);
        return data;
      } finally {
        this.profileLoadingPromise = null;
      }
    })();

    return this.profileLoadingPromise;
  }

  async createProfileWithRoles(userId: string, roles: string[]): Promise<{ profile: Profile | null; error: Error | null }> {
    try {
      const { data: existingProfile } = await this.supabaseService.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (existingProfile) {
        return { profile: existingProfile, error: null };
      }

      const { error } = await this.supabaseService.client
        .rpc('create_profile_after_signup', {
          user_id: userId,
          roles_array: roles,
          metadata_json: null
        });

      if (error) {
        return { profile: null, error: new Error(error.message) };
      }

      const profile = await this.getProfile();
      return { profile, error: null };
    } catch (error) {
      return { 
        profile: null, 
        error: error instanceof Error ? error : new Error('Erreur lors de la création du profil')
      };
    }
  }

  clearProfile(): void {
    this.currentProfileSubject.next(null);
    this.profileLoadingPromise = null;
  }
}
