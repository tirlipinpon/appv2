import { Injectable, inject } from '@angular/core';
import { GamesStore } from '../../../store/games.store';
import type { GameCreate, GameUpdate } from '../../../types/game';

@Injectable({
  providedIn: 'root',
})
export class GamesApplication {
  private readonly store = inject(GamesStore);

  loadGameTypes(): void {
    this.store.loadGameTypes();
  }

  loadGamesBySubject(subjectId: string): void {
    this.store.loadGamesBySubject(subjectId);
  }

  createGame(gameData: GameCreate): void {
    this.store.createGame(gameData);
  }

  updateGame(id: string, updates: GameUpdate): void {
    this.store.updateGame({ id, updates });
  }

  deleteGame(gameId: string): void {
    this.store.deleteGame(gameId);
  }
}

