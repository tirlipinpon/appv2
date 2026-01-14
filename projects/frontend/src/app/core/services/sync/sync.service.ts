import { Injectable } from '@angular/core';
import { fromEvent, merge, of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class SyncService {
  private readonly onlineStatus$ = merge(
    of(navigator.onLine),
    fromEvent(window, 'online').pipe(map(() => true)),
    fromEvent(window, 'offline').pipe(map(() => false))
  );

  /**
   * Observable pour surveiller l'état de la connexion
   */
  get isOnline$() {
    return this.onlineStatus$.pipe(startWith(navigator.onLine));
  }

  /**
   * Vérifie si l'application est en ligne
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Synchronise les données en attente quand la connexion est rétablie
   */
  async syncPendingData(): Promise<void> {
    if (!this.isOnline()) {
      return;
    }

    // Ici, on pourrait synchroniser les données mises en file d'attente
    // Par exemple, les tentatives de jeux, la progression, etc.
  }
}

