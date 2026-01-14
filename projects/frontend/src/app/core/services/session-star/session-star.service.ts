import { Injectable, signal, OnDestroy } from '@angular/core';

/**
 * Service pour gérer le clignotement des nouvelles étoiles gagnées pendant la session.
 * Utilise un setInterval unique pour synchroniser toutes les étoiles.
 * Le clignotement est détruit à la fin de la session.
 */
@Injectable({
  providedIn: 'root',
})
export class SessionStarService implements OnDestroy {
  /**
   * Map des étoiles qui doivent clignoter avec leur nombre.
   * Format: "category:uuid" ou "subject:uuid" -> nombre d'étoiles nouvelles
   */
  readonly newStarsBlinking = signal<Map<string, number>>(new Map());

  /**
   * État actuel du clignotement (true = visible, false = semi-transparent).
   * Toggle toutes les 500ms via setInterval.
   */
  readonly blinkingState = signal<boolean>(true);

  /**
   * ID du setInterval (null si pas démarré).
   */
  private intervalId: number | null = null;

  /**
   * Intervalle de clignotement en millisecondes.
   */
  private readonly BLINK_INTERVAL = 500;

  /**
   * Marque une étoile comme nouvelle (doit clignoter).
   * Démarre automatiquement le setInterval si pas déjà démarré.
   *
   * @param type Type d'étoile ('category' ou 'subject')
   * @param id ID de la catégorie ou matière
   * @param count Nombre d'étoiles nouvelles (par défaut 1)
   */
  markStarAsNew(type: 'category' | 'subject', id: string, count: number = 1): void {
    const key = this.createKey(type, id);
    
    // Ajouter ou mettre à jour dans la Map
    this.newStarsBlinking.update((map) => {
      const newMap = new Map(map);
      const currentCount = newMap.get(key) || 0;
      newMap.set(key, currentCount + count);
      return newMap;
    });

    // Démarrer le clignotement si pas déjà démarré
    if (this.intervalId === null) {
      this.startBlinking();
    }
  }

  /**
   * Vérifie si une étoile doit clignoter.
   *
   * @param type Type d'étoile ('category' ou 'subject')
   * @param id ID de la catégorie ou matière
   * @returns true si l'étoile doit clignoter
   */
  isStarBlinking(type: 'category' | 'subject', id: string): boolean {
    const key = this.createKey(type, id);
    return this.newStarsBlinking().has(key);
  }

  /**
   * Retourne le nombre d'étoiles nouvelles pour une catégorie/matière.
   * Utilisé pour savoir combien d'étoiles doivent clignoter.
   *
   * @param type Type d'étoile ('category' ou 'subject')
   * @param id ID de la catégorie ou matière
   * @returns Nombre d'étoiles nouvelles
   */
  getNewStarsCount(type: 'category' | 'subject', id: string): number {
    const key = this.createKey(type, id);
    return this.newStarsBlinking().get(key) || 0;
  }

  /**
   * Démarre le setInterval pour le clignotement.
   * Toggle blinkingState toutes les 500ms.
   */
  private startBlinking(): void {
    if (this.intervalId !== null) {
      return; // Déjà démarré
    }

    this.intervalId = window.setInterval(() => {
      this.blinkingState.update((state) => !state);
    }, this.BLINK_INTERVAL);
  }

  /**
   * Arrête le clignotement et nettoie les ressources.
   * Appelé à la fin de la session (ngOnDestroy).
   */
  stopBlinking(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Vider la Map
    this.newStarsBlinking.set(new Map());
    
    // Réinitialiser l'état
    this.blinkingState.set(true);
  }

  /**
   * Crée une clé unique pour identifier une étoile.
   *
   * @param type Type d'étoile ('category' ou 'subject')
   * @param id ID de la catégorie ou matière
   * @returns Clé unique (ex: "category:uuid-123")
   */
  private createKey(type: 'category' | 'subject', id: string): string {
    return `${type}:${id}`;
  }

  /**
   * Nettoie les ressources à la destruction du service.
   */
  ngOnDestroy(): void {
    this.stopBlinking();
  }
}
