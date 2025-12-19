// Structures de données spécifiques pour chaque type de jeu

// Case vide : début de phrase + case vide + fin de phrase
export interface CaseVideData {
  debut_phrase: string;
  fin_phrase: string;
  reponse_valide: string;
}

// Réponse libre : une seule réponse valide
export interface ReponseLibreData {
  reponse_valide: string;
}

// Liens : colonne de mots à relier à une colonne de réponses
export interface LiensData {
  mots: string[];
  reponses: string[];
  liens: { mot: string; reponse: string }[]; // Les associations correctes par contenu (pas par index)
}

// Chronologie : suite de mots à mettre dans un ordre
export interface ChronologieData {
  mots: string[];
  ordre_correct: string[]; // Mots dans l'ordre correct (par contenu, pas par index)
}

// QCM : plusieurs propositions dont une ou plusieurs justes
export interface QcmData {
  propositions: string[];
  reponses_valides: string[]; // Une ou plusieurs réponses valides
}

// Vrai/Faux : liste d'énoncés avec réponse Vrai ou Faux
export interface VraiFauxData {
  enonces: { texte: string; reponse_correcte: boolean }[];
}

// Union type pour toutes les structures de données de jeu
export type GameData = CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData;

