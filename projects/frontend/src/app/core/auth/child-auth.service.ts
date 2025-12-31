import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../services/supabase/supabase.service';
import { ChildSession } from '../types/child-session';

const CHILD_SESSION_KEY = 'child_session';

@Injectable({
  providedIn: 'root',
})
export class ChildAuthService {
  private readonly supabase = inject(SupabaseService);
  private currentSession: ChildSession | null = null;

  constructor() {
    // Restaurer la session depuis localStorage au démarrage
    this.restoreSession();
  }

  /**
   * Authentifie un enfant via prénom + code PIN
   */
  async login(firstname: string, pin: string): Promise<ChildSession> {
    try {
      // Note: Les RLS policies peuvent bloquer l'accès si l'utilisateur n'est pas authentifié via Supabase Auth
      // On utilise l'anon key qui devrait permettre la lecture selon les policies
      const { data, error } = await this.supabase.client
        .from('children')
        .select('id, firstname, school_level, parent_id, school_id, avatar_url, avatar_seed, avatar_style')
        .eq('firstname', firstname)
        .eq('login_pin', pin)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Erreur Supabase:', error);
        throw new Error(`Erreur de connexion: ${error.message}`);
      }

      if (!data) {
        throw new Error('Prénom ou code PIN incorrect. Vérifie tes informations.');
      }

      const session: ChildSession = {
        child_id: data.id,
        firstname: data.firstname,
        school_level: data.school_level,
        parent_id: data.parent_id,
        school_id: data.school_id,
        avatar_url: data.avatar_url,
        avatar_seed: data.avatar_seed,
        avatar_style: data.avatar_style,
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
  logout(): void {
    this.currentSession = null;
    localStorage.removeItem(CHILD_SESSION_KEY);
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
    return this.currentSession !== null;
  }

  /**
   * Sauvegarde la session dans localStorage
   */
  private saveSession(session: ChildSession): void {
    try {
      localStorage.setItem(CHILD_SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la session:', error);
    }
  }

  /**
   * Restaure la session depuis localStorage
   */
  private restoreSession(): void {
    try {
      const sessionData = localStorage.getItem(CHILD_SESSION_KEY);
      if (sessionData) {
        this.currentSession = JSON.parse(sessionData) as ChildSession;
      }
    } catch (error) {
      console.error('Erreur lors de la restauration de la session:', error);
      localStorage.removeItem(CHILD_SESSION_KEY);
      this.currentSession = null;
    }
  }
}

