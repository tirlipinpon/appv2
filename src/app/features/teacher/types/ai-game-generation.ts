import { GameCreate } from './game';

export interface AIGameGenerationRequest {
  subjectName: string; // Nom de la matière scolaire (ex: "Mathématiques", "Histoire")
  subject: string; // Thème/sujet du jeu (ex: "Les fractions", "La Révolution française")
  pdfFile?: File;
  numberOfGames: number;
  schoolYearLabel: string; // ex: "CP", "6ème", "Terminale"
  difficulty: number;
  subjectId: string;
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

