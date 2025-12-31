import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools } from "@angular-architects/ngrx-toolkit";
import { inject } from '@angular/core';
import { pipe, switchMap, catchError, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { GameInfrastructure } from '../components/infrastructure/infrastructure';
import { Game } from '../../../core/types/game.types';
import { GameState } from '../types/game.types';

interface GameStoreState {
  currentGame: Game | null;
  gameState: GameState | null;
  loading: boolean;
  error: string | null;
}

const initialState: GameStoreState = {
  currentGame: null,
  gameState: null,
  loading: false,
  error: null,
};

export const GameStore = signalStore(
  { providedIn: 'root' },
  withDevtools('game'),
  withState(initialState),
  withComputed((state) => ({
    hasGame: () => state.currentGame() !== null,
    hasGameState: () => state.gameState() !== null,
    currentQuestion: () => {
      const gameState = state.gameState();
      if (!gameState || gameState.questions.length === 0) return null;
      return gameState.questions[gameState.currentQuestionIndex];
    },
    progress: () => {
      const gameState = state.gameState();
      if (!gameState || gameState.questions.length === 0) return 0;
      return Math.round(((gameState.currentQuestionIndex + 1) / gameState.questions.length) * 100);
    },
  })),
  withMethods((store, infrastructure = inject(GameInfrastructure)) => ({
    loadGame: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((gameId) =>
          infrastructure.loadGame(gameId).then(
            (game) => {
              patchState(store, { currentGame: game, loading: false });
            },
            (error) => {
              patchState(store, { error: error.message, loading: false });
            }
          )
        ),
        catchError((error) => {
          patchState(store, { error: error.message, loading: false });
          return of(null);
        })
      )
    ),
    setGameState: (gameState: GameState) => {
      patchState(store, { gameState });
    },
    saveAttempt: rxMethod<Partial<any>>(
      pipe(
        switchMap((attempt) =>
          infrastructure.saveGameAttempt(attempt).then(
            () => {
              // Succès
            },
            (error) => {
              patchState(store, { error: error.message });
            }
          )
        ),
        catchError((error) => {
          patchState(store, { error: error.message });
          return of(null);
        })
      )
    ),
  }))
);

