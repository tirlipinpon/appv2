import { Injectable } from '@angular/core';
import type { AuthError, PostgrestError } from '@supabase/supabase-js';

export type ServiceError =
  | (AuthError & { code?: string })
  | (PostgrestError & { status?: number })
  | { message: string; code?: string; status?: number; name?: string };

export interface NormalizedError {
  message: string;
  code?: string;
  status?: number;
  name?: string;
}

/**
 * Service de gestion centralisée des erreurs
 * Principe SRP : Gère uniquement la normalisation et le mapping des erreurs
 * Principe OCP : Extensible avec de nouveaux types d'erreurs
 */
@Injectable({
  providedIn: 'root',
})
export class ErrorHandlerService {
  private errorMessages: Record<string, string> = {
    // Erreurs d'authentification
    'invalid_credentials': 'Identifiants invalides',
    'user_not_found': 'Utilisateur non trouvé',
    'email_not_confirmed': 'Email non confirmé',
    'user_already_registered': 'Cet utilisateur existe déjà',
    'already_registered': 'Ce compte existe déjà',
    'weak_password': 'Le mot de passe est trop faible',
    'invalid_email': 'Email invalide',
    
    // Erreurs de base de données
    'PGRST116': 'Utilisateur non authentifié',
    '23505': 'Cette donnée existe déjà',
    '23503': 'Référence invalide',
    '42P01': 'Table non trouvée',
    
    // Erreurs métier
    'profile_incomplete': 'Veuillez compléter votre profil',
    'no_children_enrolled': 'Aucun enfant inscrit',
    'role_already_exists': 'Ce rôle existe déjà',
    'role_not_found': 'Rôle non trouvé',
  };

  /**
   * Normalise n'importe quelle erreur en un format standard
   */
  normalize(error: unknown, fallbackMessage = 'Une erreur est survenue'): NormalizedError {
    if (!error) {
      return { message: fallbackMessage };
    }

    if (typeof error === 'string') {
      return { message: error };
    }

    if (error instanceof Error) {
      return {
        message: error.message || fallbackMessage,
        name: error.name,
      };
    }

    if (typeof error === 'object') {
      const candidate = error as { message?: unknown; code?: unknown; status?: unknown; name?: unknown };
      const code = typeof candidate.code === 'string' ? candidate.code : undefined;
      const status = typeof candidate.status === 'number' ? candidate.status : undefined;
      const name = typeof candidate.name === 'string' ? candidate.name : undefined;
      
      let message = typeof candidate.message === 'string' ? candidate.message : fallbackMessage;
      
      // Tenter de mapper le code vers un message plus convivial
      if (code && this.errorMessages[code]) {
        message = this.errorMessages[code];
      }

      return { message, code, status, name };
    }

    return { message: fallbackMessage };
  }

  /**
   * Vérifie si une erreur correspond à un code spécifique
   */
  isErrorCode(error: unknown, code: string): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    
    const candidate = error as { code?: unknown };
    return candidate.code === code;
  }

  /**
   * Vérifie si une erreur est une erreur d'authentification
   */
  isAuthError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    
    const candidate = error as { name?: unknown };
    return candidate.name === 'AuthError' || candidate.name === 'AuthApiError';
  }

  /**
   * Vérifie si une erreur est une erreur de base de données
   */
  isDatabaseError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    
    const candidate = error as { name?: unknown };
    return candidate.name === 'PostgrestError';
  }

  /**
   * Ajoute un nouveau mapping code -> message
   */
  addErrorMessage(code: string, message: string): void {
    this.errorMessages[code] = message;
  }

  /**
   * Obtient un message d'erreur convivial pour un code donné
   */
  getErrorMessage(code: string, fallback?: string): string {
    return this.errorMessages[code] || fallback || 'Une erreur est survenue';
  }
}
