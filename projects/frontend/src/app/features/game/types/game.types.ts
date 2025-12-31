import { Game } from '../../../core/types/game.types';

export interface GameQuestion {
  id: string;
  question: string;
  answers: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface GameState {
  currentQuestionIndex: number;
  questions: GameQuestion[];
  selectedAnswer: number | null;
  score: number;
  isCompleted: boolean;
  startedAt: Date;
  completedAt?: Date;
}

export interface GameSession {
  game: Game;
  state: GameState;
  difficultyLevel: number;
}

