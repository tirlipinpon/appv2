import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, shareReplay } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface CacheEntry<T> {
  data: T | null | undefined;
  loading: Observable<T | null> | null;
}

/**
 * Service de cache générique réutilisable
 * Principe SRP : Gère uniquement la mise en cache des données
 * Principe OCP : Extensible pour tout type de données
 */
@Injectable({
  providedIn: 'root',
})
export class CacheService {
  private caches = new Map<string, CacheEntry<unknown>>();
  private cacheSubjects = new Map<string, BehaviorSubject<unknown>>();

  /**
   * Récupère une valeur depuis le cache ou exécute la factory si non présent
   */
  getOrLoad<T>(
    key: string,
    factory: () => Observable<T | null>,
    userId?: string
  ): Observable<T | null> {
    const cacheKey = userId ? `${key}:${userId}` : key;
    const entry = this.caches.get(cacheKey);

    // Si les données sont déjà en cache
    if (entry?.data !== undefined) {
      return of(entry.data as T | null);
    }

    // Si un chargement est déjà en cours
    if (entry?.loading) {
      return entry.loading as Observable<T | null>;
    }

    // Créer un nouvel Observable avec cache
    const loading$ = factory().pipe(
      tap((data) => {
        this.set(cacheKey, data);
        this.caches.set(cacheKey, { data, loading: null });
        
        // Notifier les abonnés via le subject
        const subject = this.cacheSubjects.get(cacheKey);
        if (subject) {
          subject.next(data);
        }
      }),
      shareReplay(1)
    );

    this.caches.set(cacheKey, { data: undefined, loading: loading$ });
    return loading$;
  }

  /**
   * Récupère la valeur actuelle depuis le cache sans déclencher de chargement
   */
  get<T>(key: string, userId?: string): T | null | undefined {
    const cacheKey = userId ? `${key}:${userId}` : key;
    return this.caches.get(cacheKey)?.data as T | null | undefined;
  }

  /**
   * Définit une valeur dans le cache
   */
  set<T>(key: string, value: T | null, userId?: string): void {
    const cacheKey = userId ? `${key}:${userId}` : key;
    this.caches.set(cacheKey, { data: value, loading: null });
    
    // Notifier les abonnés via le subject
    const subject = this.cacheSubjects.get(cacheKey);
    if (subject) {
      subject.next(value);
    }
  }

  /**
   * Supprime une entrée du cache
   */
  delete(key: string, userId?: string): void {
    const cacheKey = userId ? `${key}:${userId}` : key;
    this.caches.delete(cacheKey);
    
    // Compléter et supprimer le subject
    const subject = this.cacheSubjects.get(cacheKey);
    if (subject) {
      subject.complete();
      this.cacheSubjects.delete(cacheKey);
    }
  }

  /**
   * Vide tout le cache
   */
  clear(): void {
    this.caches.clear();
    
    // Compléter tous les subjects
    this.cacheSubjects.forEach(subject => subject.complete());
    this.cacheSubjects.clear();
  }

  /**
   * Obtient un Observable qui émet à chaque fois que la valeur en cache change
   */
  watch<T>(key: string, userId?: string): Observable<T | null> {
    const cacheKey = userId ? `${key}:${userId}` : key;
    
    if (!this.cacheSubjects.has(cacheKey)) {
      const currentValue = this.get<T>(cacheKey);
      this.cacheSubjects.set(cacheKey, new BehaviorSubject<T | null>(currentValue ?? null) as unknown as BehaviorSubject<unknown>);
    }
    
    return this.cacheSubjects.get(cacheKey)!.asObservable() as Observable<T | null>;
  }

  /**
   * Vérifie si une clé existe dans le cache
   */
  has(key: string, userId?: string): boolean {
    const cacheKey = userId ? `${key}:${userId}` : key;
    return this.caches.has(cacheKey) && this.caches.get(cacheKey)?.data !== undefined;
  }
}
