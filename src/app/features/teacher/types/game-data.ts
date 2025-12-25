// Structures de données spécifiques pour chaque type de jeu

// Case vide : texte avec plusieurs cases vides + banque de mots (drag and drop)
// Supporte deux formats : ancien (rétrocompatibilité) et nouveau (drag and drop)
export interface CaseVideData {
  // Format nouveau (drag and drop)
  texte?: string; // Texte avec placeholders [1], [2], etc. pour les cases vides
  cases_vides?: { 
    index: number; // Index du placeholder dans le texte (1, 2, 3...)
    reponse_correcte: string; // Réponse correcte pour cette case
  }[];
  banque_mots?: string[]; // Tous les mots (corrects + leurres)
  mots_leurres?: string[]; // Mots d'erreur qui ne doivent pas être utilisés
  
  // Format ancien (rétrocompatibilité)
  debut_phrase?: string;
  fin_phrase?: string;
  reponse_valide?: string;
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

// Memory : paires de cartes question/réponse à retourner
export interface MemoryData {
  paires: { question: string; reponse: string }[];
}

// Simon : jeu de mémoire de séquence (type Simon)
export interface SimonData {
  nombre_elements: number; // Nombre d'éléments (3 à 10)
  type_elements: 'couleurs' | 'chiffres' | 'lettres' | 'symboles' | 'personnalise'; // Type d'éléments
  elements?: string[]; // Liste personnalisée d'éléments (si type_elements === 'personnalise')
}

// Image interactive : image avec zones cliquables
export interface ImageInteractiveZone {
  id: string; // UUID pour identifier la zone
  name?: string; // Nom optionnel de la zone
  x: number; // Position X relative (0-1)
  y: number; // Position Y relative (0-1)
  width: number; // Largeur relative (0-1)
  height: number; // Hauteur relative (0-1)
  is_correct: boolean; // Si cette zone est une réponse correcte
}

export interface ImageInteractiveData {
  image_url: string; // URL de l'image dans Supabase Storage
  image_width: number; // Largeur originale de l'image
  image_height: number; // Hauteur originale de l'image
  zones: ImageInteractiveZone[];
}

// Union type pour toutes les structures de données de jeu
export type GameData = CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData;

