import { Injectable, inject } from '@angular/core';
import { GamesStore } from '../../../store/games.store';
import type { GameCreate, GameUpdate } from '../../../types/game';
import type { AIGameGenerationRequest } from '../../../types/ai-game-generation';

@Injectable({
  providedIn: 'root',
})
export class GamesApplication {
  private readonly store = inject(GamesStore);

  loadGameTypes(): void {
    this.store.loadGameTypes();
  }

  loadGamesBySubject(subjectId: string, categoryId?: string): void {
    this.store.loadGamesBySubject({ subjectId, categoryId });
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

  // Méthodes pour la génération IA
  generateGamesWithAI(request: AIGameGenerationRequest): void {
    this.store.generateGamesWithAI(request);
  }

  validateGeneratedGames(): void {
    this.store.validateGeneratedGames();
  }

  updateGeneratedGame(tempId: string, updates: Partial<GameCreate>): void {
    this.store.updateGeneratedGame(tempId, updates);
  }

  toggleEditGeneratedGame(tempId: string): void {
    this.store.toggleEditGeneratedGame(tempId);
  }

  removeGeneratedGame(tempId: string): void {
    this.store.removeGeneratedGame(tempId);
  }

  cancelGeneration(): void {
    this.store.clearGeneratedGames();
  }
}

