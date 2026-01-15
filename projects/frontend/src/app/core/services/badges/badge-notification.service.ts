import { Injectable, signal, computed, inject } from '@angular/core';
import { BadgeNotificationData } from '../../../shared/components/badge-notification-modal/badge-notification-modal.component';
import { NewlyUnlockedBadge } from '../../types/badge.types';
import { SoundService } from '../sounds/sound.service';

@Injectable({
  providedIn: 'root',
})
export class BadgeNotificationService {
  private readonly soundService = inject(SoundService);
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
      // Utiliser badge_id + level pour la déduplication (cohérent avec queueBadgeNotification)
      const badgeKey = `${badge.badge_id}-${badge.level ?? 'default'}`;

      // Si le badge a déjà été affiché, ne pas l'afficher à nouveau
      if (this.displayedBadges.has(badgeKey)) {
        resolve();
        return;
      }

      // Vérifier aussi dans la file d'attente pour éviter les doublons
      const currentQueue = this.badgeQueue();
      const alreadyInQueue = currentQueue.some(
        existing => existing.badge_id === badge.badge_id && existing.level === badge.level
      );

      if (alreadyInQueue) {
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

      // Jouer le son de badge spécifique au type
      this.soundService.playBadgeSoundByType(badge.badge_type);

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
      
      // CRITICAL FIX: Ajouter le badge à displayedBadges pour éviter qu'il soit réajouté
      const badgeKey = `${nextBadge.badge_id}-${nextBadge.level ?? 'default'}`;
      this.displayedBadges.add(badgeKey);
      
      this.currentBadge.set(nextBadge);
      this.isVisible.set(true);
      
      // Jouer le son de badge spécifique au type
      this.soundService.playBadgeSoundByType(nextBadge.badge_type);
      
      // Note: On n'initialise pas waitForClose ici car les badges de la queue
      // n'ont pas de promesse en attente (ils ont été ajoutés via queueBadgeNotification
      // qui ne retourne pas de promesse). Si quelqu'un veut attendre la fermeture,
      // il doit utiliser showBadgeNotification à la place.
      this.waitForClose = null;
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

  /**
   * Ajoute un badge à la file d'attente sans bloquer
   * Utile pour mettre les badges en attente pendant qu'un autre modal est affiché
   */
  queueBadgeNotification(badge: NewlyUnlockedBadge, description?: string): void {
    // Utiliser badge_id + level pour la déduplication (plus fiable que unlocked_at)
    // car le même badge peut être débloqué plusieurs fois avec des unlocked_at différents
    const badgeKey = `${badge.badge_id}-${badge.level ?? 'default'}`;

    if (this.displayedBadges.has(badgeKey)) {
      return; // Ce badge avec ce niveau a déjà été ajouté
    }

    this.displayedBadges.add(badgeKey);

    const badgeData: BadgeNotificationData = {
      badge_id: badge.badge_id,
      badge_name: badge.badge_name,
      badge_type: badge.badge_type,
      level: badge.level,
      value: badge.value,
      description,
    };

    // Vérifier aussi dans la file d'attente pour éviter les doublons
    const currentQueue = this.badgeQueue();
    const alreadyInQueue = currentQueue.some(
      existing => existing.badge_id === badge.badge_id && existing.level === badge.level
    );

    if (!alreadyInQueue) {
      // Toujours ajouter à la file d'attente, même si rien n'est visible
      this.badgeQueue.update((queue) => [...queue, badgeData]);
    }
  }

  /**
   * Affiche le prochain badge de la file d'attente si aucun n'est visible
   */
  processNextBadgeInQueue(): void {
    if (this.isVisible()) {
      return; // Un badge est déjà affiché
    }

    const queue = this.badgeQueue();
    if (queue.length === 0) {
      return; // Aucun badge en attente
    }

    const nextBadge = queue[0];
    this.badgeQueue.update((q) => q.slice(1));
    
    // CRITICAL FIX: Ajouter le badge à displayedBadges pour éviter qu'il soit réajouté
    // même s'il est retourné par getNewlyUnlockedBadges() lors d'appels ultérieurs
    const badgeKey = `${nextBadge.badge_id}-${nextBadge.level ?? 'default'}`;
    this.displayedBadges.add(badgeKey);
    
    this.currentBadge.set(nextBadge);
    this.isVisible.set(true);
    
    // Jouer le son de badge spécifique au type
    this.soundService.playBadgeSoundByType(nextBadge.badge_type);
    
    // Note: On n'initialise pas waitForClose ici car les badges de la queue
    // n'ont pas de promesse en attente (ils ont été ajoutés via queueBadgeNotification
    // qui ne retourne pas de promesse). Si quelqu'un veut attendre la fermeture,
    // il doit utiliser showBadgeNotification à la place.
    this.waitForClose = null;
  }
}
