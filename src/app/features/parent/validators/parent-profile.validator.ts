import type { Parent } from '../types/parent';

/**
 * Validateurs pour les profils parents
 * Principe SRP : Gère uniquement la validation des profils parents
 */
export class ParentProfileValidator {
  /**
   * Vérifie si le profil parent est complété
   */
  static isProfileComplete(parent: Parent | null): boolean {
    if (!parent) {
      return false;
    }
    return !!(parent.fullname && parent.phone && parent.address && parent.city);
  }

  /**
   * Retourne la liste des champs manquants
   */
  static getMissingFields(parent: Parent | null): string[] {
    if (!parent) {
      return ['Profil entier'];
    }

    const missing: string[] = [];
    
    if (!parent.fullname) missing.push('Nom complet');
    if (!parent.phone) missing.push('Téléphone');
    if (!parent.address) missing.push('Adresse');
    if (!parent.city) missing.push('Ville');

    return missing;
  }

  /**
   * Vérifie si un numéro de téléphone est valide
   */
  static isValidPhone(phone: string | null): boolean {
    if (!phone) return false;
    // Format français basique : 10 chiffres
    const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Vérifie si une adresse est valide
   */
  static isValidAddress(address: string | null): boolean {
    if (!address) return false;
    return address.trim().length >= 5;
  }
}
