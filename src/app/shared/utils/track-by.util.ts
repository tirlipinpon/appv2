/**
 * Fonctions trackBy réutilisables pour optimiser *ngFor
 * Principe DRY : Évite la duplication de code trackBy
 */

export class TrackByUtils {
  /**
   * Track by ID
   */
  static byId<T extends { id: string | number }>(index: number, item: T): string | number {
    return item.id;
  }

  /**
   * Track by index
   */
  static byIndex(index: number): number {
    return index;
  }

  /**
   * Track by propriété personnalisée
   */
  static by<T, K extends keyof T>(property: K): (index: number, item: T) => T[K] {
    return (index: number, item: T) => item[property];
  }

  /**
   * Track by pour les tableaux de primitives
   */
  static byValue<T extends string | number | boolean>(index: number, item: T): T {
    return item;
  }
}
