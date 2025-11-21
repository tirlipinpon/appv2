export interface GameReponses {
  propositions: string[];
  reponse_valide: string;
}

export interface Game {
  id: string;
  subject_id: string;
  game_type_id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  difficulty: string | null;
  duration: number | null;
  question: string | null;
  reponses: GameReponses | null;
  aides: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface GameCreate {
  subject_id: string;
  game_type_id: string;
  name: string;
  instructions?: string | null;
  question?: string | null;
  reponses?: GameReponses | null;
  aides?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

export interface GameUpdate {
  name?: string;
  instructions?: string | null;
  question?: string | null;
  reponses?: GameReponses | null;
  aides?: string[] | null;
  metadata?: Record<string, unknown> | null;
  game_type_id?: string;
}

