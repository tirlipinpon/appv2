import { GameCreate } from './game';

export interface AIGameGenerationRequest {
  subjectName: string; // Nom de la matière scolaire (ex: "Mathématiques", "Histoire")
  subject: string; // Thème/sujet du jeu (ex: "Les fractions", "La Révolution française")
  pdfFile?: File;
  numberOfGames: number;
  schoolYearLabel: string; // ex: "CP", "6ème", "Terminale"
  difficulty: number;
  subjectId: string;
  selectedGameTypeIds?: string[]; // IDs des types de jeux sélectionnés. Si vide/undefined, l'IA choisit parmi tous les types
  alreadyGeneratedInSession?: { question: string | null; game_type_id: string; metadata: Record<string, unknown> | null }[]; // Jeux déjà générés dans cette session
}

export interface AIGameGenerationResponse {
  games: GameCreate[];
  metadata: {
    distribution: Record<string, number>; // type -> count
  };
}

export interface GeneratedGameWithState extends GameCreate {
  _tempId: string; // ID temporaire pour tracking avant sauvegarde
  _isEditing: boolean; // Mode édition activé
}

// Structure de la réponse de l'IA (format DeepSeek)
export interface AIRawGameResponse {
  type_name: string;
  question: string | null;
  instructions: string | null;
  metadata: Record<string, unknown>;
  aides: string[];
}

export interface AIRawResponse {
  games: AIRawGameResponse[];
}

