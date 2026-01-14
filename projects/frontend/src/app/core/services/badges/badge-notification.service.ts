import { Injectable, signal, computed } from '@angular/core';
import { BadgeNotificationData } from '../../../shared/components/badge-notification-modal/badge-notification-modal.component';
import { NewlyUnlockedBadge } from '../../types/badge.types';

@Injectable({
  providedIn: 'root',
})
export class BadgeNotificationService {
  // File d'attente des badges à afficher
  private readonly badgeQueue = signal<BadgeNotificationData[]>([]);
  private readonly currentBadge = signal<BadgeNotificationData | null>(null);
  private readonly isVisible = signal<boolean>(false);

  // Cache des badges déjà affichés dans cette session (pour éviter les doublons)
  private readonly displayedBadges = new Set<string>();

  // Observable pour savoir si une notification est en cours
  readonly hasNotifications = computed(() => this.badgeQueue().length > 0 || this.isVisible());

  /**
   * Affiche une notification de badge débloqué
   * Si une notification est déjà en cours, ajoute le badge à la file d'attente
   * Évite d'afficher deux fois le même badge dans la même session
   */
  showBadgeNotification(badge: NewlyUnlockedBadge, description?: string): Promise<void> {
    return new Promise((resolve) => {
      // Créer une clé unique pour ce badge (badge_id + unlocked_at si disponible)
      const badgeKey = badge.unlocked_at 
        ? `${badge.badge_id}-${badge.unlocked_at}`
        : `${badge.badge_id}-${Date.now()}`;

      // Si le badge a déjà été affiché, ne pas l'afficher à nouveau
      if (this.displayedBadges.has(badgeKey)) {
        resolve();
        return;
      }

      // Marquer le badge comme affiché
      this.displayedBadges.add(badgeKey);

      const badgeData: BadgeNotificationData = {
        badge_id: badge.badge_id,
        badge_name: badge.badge_name,
        badge_type: badge.badge_type,
        level: badge.level,
        value: badge.value,
        description,
      };

      // Si une notification est déjà visible, ajouter à la file d'attente
      if (this.isVisible()) {
        this.badgeQueue.update((queue) => [...queue, badgeData]);
        // Résoudre immédiatement car le badge sera affiché plus tard
        resolve();
        return;
      }

      // Afficher immédiatement
      this.currentBadge.set(badgeData);
      this.isVisible.set(true);

      // Attendre que l'utilisateur ferme la modal
      // La résolution se fera dans closeCurrentNotification()
      this.waitForClose = resolve;
    });
  }

  private waitForClose: (() => void) | null = null;

  /**
   * Ferme la notification actuelle et affiche la suivante dans la file d'attente
   */
  closeCurrentNotification(): void {
    this.isVisible.set(false);
    this.currentBadge.set(null);

    // Résoudre la promesse en attente
    if (this.waitForClose) {
      this.waitForClose();
      this.waitForClose = null;
    }

    // Afficher le prochain badge dans la file d'attente
    const queue = this.badgeQueue();
    if (queue.length > 0) {
      const nextBadge = queue[0];
      this.badgeQueue.update((q) => q.slice(1));
      this.currentBadge.set(nextBadge);
      this.isVisible.set(true);
    }
  }

  /**
   * Récupère le badge actuellement affiché
   */
  getCurrentBadge(): BadgeNotificationData | null {
    return this.currentBadge();
  }

  /**
   * Vérifie si une notification est actuellement visible
   */
  isNotificationVisible(): boolean {
    return this.isVisible();
  }

  /**
   * Vide la file d'attente et ferme la notification actuelle
   */
  clearAll(): void {
    this.badgeQueue.set([]);
    this.isVisible.set(false);
    this.currentBadge.set(null);
    if (this.waitForClose) {
      this.waitForClose();
      this.waitForClose = null;
    }
  }

  /**
   * Vide le cache des badges déjà affichés
   * Utile pour réinitialiser entre les sessions de jeu
   */
  clearDisplayedBadgesCache(): void {
    this.displayedBadges.clear();
  }
}
