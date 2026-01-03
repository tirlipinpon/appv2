/**
 * Constantes pour les types de jeux
 * Source de vérité centralisée pour éviter les noms en dur
 */

// Types de jeux principaux (noms normalisés)
export const GAME_TYPE_QCM = 'qcm';
export const GAME_TYPE_MEMORY = 'memory';
export const GAME_TYPE_SIMON = 'simon';
export const GAME_TYPE_CHRONOLOGIE = 'chronologie';
export const GAME_TYPE_LIENS = 'liens';
export const GAME_TYPE_VRAI_FAUX = 'vrai_faux';
export const GAME_TYPE_CASE_VIDE = 'case_vide';
export const GAME_TYPE_IMAGE_INTERACTIVE = 'image_interactive';
export const GAME_TYPE_REPONSE_LIBRE = 'reponse_libre';

// Variations de noms acceptées pour chaque type
export const GAME_TYPE_VARIATIONS: Record<string, readonly string[]> = {
  [GAME_TYPE_QCM]: ['qcm'] as const,
  [GAME_TYPE_MEMORY]: ['memory'] as const,
  [GAME_TYPE_SIMON]: ['simon'] as const,
  [GAME_TYPE_CHRONOLOGIE]: ['chronologie'] as const,
  [GAME_TYPE_LIENS]: ['liens', 'lien'] as const,
  [GAME_TYPE_VRAI_FAUX]: [
    'vrai_faux',
    'vrai/faux',
    'vrai faux',
    'vrais faux',
    'vrai-faux',
  ] as const,
  [GAME_TYPE_CASE_VIDE]: ['case_vide', 'case vide'] as const,
  [GAME_TYPE_IMAGE_INTERACTIVE]: [
    'image_interactive',
    'image interactive',
    'click',
  ] as const,
  [GAME_TYPE_REPONSE_LIBRE]: ['reponse_libre', 'reponse libre'] as const,
} as const;

// Liste de tous les types de jeux spécifiques
export const SPECIFIC_GAME_TYPES = [
  GAME_TYPE_CASE_VIDE,
  'case vide',
  GAME_TYPE_LIENS,
  GAME_TYPE_VRAI_FAUX,
  'vrai/faux',
  GAME_TYPE_IMAGE_INTERACTIVE,
  'image interactive',
  GAME_TYPE_MEMORY,
  GAME_TYPE_SIMON,
  GAME_TYPE_QCM,
  GAME_TYPE_CHRONOLOGIE,
  'click',
  GAME_TYPE_REPONSE_LIBRE,
] as const;

/**
 * Récupère toutes les variations d'un type de jeu
 */
export function getGameTypeVariations(constantType: string): readonly string[] {
  return GAME_TYPE_VARIATIONS[constantType] || [];
}