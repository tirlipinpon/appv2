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

  // Observable pour savoir si une notification est en cours
  readonly hasNotifications = computed(() => this.badgeQueue().length > 0 || this.isVisible());

  /**
   * Affiche une notification de badge débloqué
   * Si une notification est déjà en cours, ajoute le badge à la file d'attente
   */
  showBadgeNotification(badge: NewlyUnlockedBadge, description?: string): Promise<void> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badge-notification.service.ts:21',message:'showBadgeNotification ENTRY',data:{badgeId:badge.badge_id,badgeName:badge.badge_name,badgeType:badge.badge_type,level:badge.level,value:badge.value},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
    // #endregion
    return new Promise((resolve) => {
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badge-notification.service.ts:34',message:'showBadgeNotification QUEUE',data:{badgeId:badge.badge_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
        // #endregion
        this.badgeQueue.update((queue) => [...queue, badgeData]);
        // Résoudre immédiatement car le badge sera affiché plus tard
        resolve();
        return;
      }

      // Afficher immédiatement
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'badge-notification.service.ts:42',message:'showBadgeNotification SHOW',data:{badgeId:badge.badge_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
      // #endregion
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
}
