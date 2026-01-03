import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GamesStore } from '../../../store/games.store';
import { Infrastructure } from '../../infrastructure/infrastructure';
import type { Game, GameCreate, GameUpdate } from '../../../types/game';
import type { AIGameGenerationRequest } from '../../../types/ai-game-generation';

@Injectable({
  providedIn: 'root',
})
export class GamesApplication {
  private readonly store = inject(GamesStore);
  private readonly infrastructure = inject(Infrastructure);

  loadGameTypes(): void {
    this.store.loadGameTypes();
  }

  loadGamesBySubject(subjectId: string, categoryId?: string): void {
    this.store.loadGamesBySubject({ subjectId, categoryId });
  }

  createGame(gameData: GameCreate): Observable<Game | null> {
    // Créer le jeu via l'infrastructure pour obtenir l'ID
    return this.infrastructure.createGame(gameData).pipe(
      map((result) => {
        if (result.error) {
          // Afficher l'erreur via le store
          this.store.setError(result.error.message || 'Erreur lors de la création du jeu');
          return null;
        }
        // Mettre à jour le store pour ajouter le jeu à la liste (sans recréer le jeu)
        // Ne pas appeler store.createGame() car il recrée le jeu dans la DB
        // On utilise addGameToStore() qui ajoute simplement le jeu au store sans le recréer
        if (result.game) {
          this.store.addGameToStore(result.game);
        }
        return result.game;
      })
    );
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

