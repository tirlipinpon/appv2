import { Injectable } from '@angular/core';

/**
 * Service de cache simple pour optimiser les requêtes répétées
 */
@Injectable({
  providedIn: 'root',
})
export class CacheService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  /**
   * Stocke une valeur dans le cache
   */
  set(key: string, data: any, ttl: number = 5 * 60 * 1000): void {
    // ttl en millisecondes, par défaut 5 minutes
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Récupère une valeur du cache
   */
  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    // Vérifier si le cache a expiré
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Vérifie si une clé existe dans le cache et n'est pas expirée
   */
  has(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) {
      return false;
    }

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Supprime une clé du cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Vide tout le cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Nettoie les entrées expirées
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.cache.delete(key);
      }
    }
  }
}


