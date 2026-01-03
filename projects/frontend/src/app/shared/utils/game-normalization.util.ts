/**
 * Utilitaires pour la normalisation des jeux depuis la structure de la base de données
 * vers l'interface Game standardisée.
 * 
 * Gère la conversion depuis la structure ancienne (metadata, question, reponses)
 * vers la nouvelle structure (game_data_json).
 */

import { Game } from '../../core/types/game.types';
import { isGameTypeOneOf } from '@shared/utils/game-type.util';

/**
 * Normalise un type de jeu pour la comparaison
 * - Convertit en minuscules
 * - Remplace les espaces par des underscores
 * - Remplace les slashes par des underscores
 * - Normalise les accents (é -> e, è -> e, etc.)
 * 
 * @param gameType - Le type de jeu à normaliser
 * @returns Le type de jeu normalisé
 */
export function normalizeGameType(gameType: string | undefined): string {
  if (!gameType) return '';
  return gameType
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/\//g, '_')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Interface pour représenter un jeu brut depuis la base de données
 * avant normalisation
 */
interface RawGameFromDb {
  id: string;
  name: string;
  description?: string;
  subject_id?: string;
  subject_category_id?: string;
  game_type?: string;
  game_data_json?: Record<string, unknown>;
  image_url?: string;
  created_at: string;
  updated_at: string;
  question?: string;
  instructions?: string;
  reponses?: Record<string, unknown>;
  aides?: string[];
  metadata?: Record<string, unknown>;
  game_types?: {
    name: string;
  };
}

/**
 * Interface pour une paire mémoire (question/réponse)
 */
interface MemoryPair {
  question?: string;
  reponse?: string;
}

/**
 * Interface pour un énoncé vrai/faux
 */
interface VraiFauxEnonce {
  texte?: string;
  reponse_correcte?: boolean;
}

/**
 * Normalise un jeu depuis la structure de la base de données vers l'interface Game
 * 
 * @param rawGame - Jeu brut depuis la base de données
 * @returns Jeu normalisé selon l'interface Game
 */
export function normalizeGame(rawGame: RawGameFromDb): Game {
  // Normaliser le nom du type de jeu
  let gameTypeName = (rawGame.game_types?.name || rawGame.game_type || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  
  // Normaliser les accents (é -> e, è -> e, etc.)
  gameTypeName = gameTypeName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Normaliser "click" vers "image_interactive"
  if (isGameTypeOneOf(gameTypeName, 'click', 'image interactive', 'image_interactive')) {
    gameTypeName = 'image_interactive';
  }
  
  // Vérifier d'abord si game_data_json existe déjà dans la base de données
  // Si oui, l'utiliser en priorité (pour les nouveaux jeux)
  let gameDataJson: Record<string, unknown> = {};
  
  if (rawGame.game_data_json && typeof rawGame.game_data_json === 'object' && Object.keys(rawGame.game_data_json).length > 0) {
    // Utiliser game_data_json s'il existe et n'est pas vide
    gameDataJson = rawGame.game_data_json;
  } else {
    // Sinon, convertir depuis metadata, question, reponses, aides (anciens jeux)
    if (gameTypeName === 'reponse_libre') {
      // Réponse libre : convertir depuis metadata.reponse_valide ou reponses.reponse_valide
      if (rawGame.metadata?.['reponse_valide']) {
        gameDataJson = {
          reponse_valide: rawGame.metadata['reponse_valide']
        };
      } else if (rawGame.reponses?.['reponse_valide']) {
        gameDataJson = {
          reponse_valide: rawGame.reponses['reponse_valide']
        };
      }
    } else if (gameTypeName === 'memory') {
      // Memory : convertir metadata.paires en game_data_json.paires
      if (rawGame.metadata?.['paires'] && Array.isArray(rawGame.metadata['paires'])) {
        gameDataJson = {
          paires: (rawGame.metadata['paires'] as MemoryPair[]).map((paire: MemoryPair) => ({
            question: paire.question || '',
            reponse: paire.reponse || ''
          }))
        };
      }
    } else if (gameTypeName === 'qcm') {
      // QCM : convertir depuis metadata ou reponses
      if (rawGame.metadata?.['propositions'] || rawGame.reponses?.['propositions']) {
        gameDataJson = {
          propositions: rawGame.metadata?.['propositions'] || rawGame.reponses?.['propositions'] || [],
          reponses_valides: rawGame.metadata?.['reponses_valides'] || rawGame.reponses?.['reponses_valides'] || (rawGame.reponses?.['reponse_valide'] ? [rawGame.reponses['reponse_valide']] : [])
        };
      } else if (rawGame.reponses) {
        gameDataJson = rawGame.reponses;
      }
    } else if (gameTypeName === 'chronologie') {
      // Chronologie : convertir depuis metadata
      if (rawGame.metadata?.['mots'] || rawGame.metadata?.['ordre_correct']) {
        gameDataJson = {
          mots: rawGame.metadata['mots'] || [],
          ordre_correct: rawGame.metadata['ordre_correct'] || []
        };
      } else if (rawGame.reponses) {
        gameDataJson = rawGame.reponses;
      }
    } else if (gameTypeName === 'vrai_faux' || gameTypeName === 'vrai/faux' || gameTypeName === 'vrai faux' || gameTypeName === 'vrais faux') {
      // Vrai/Faux : convertir depuis metadata.enonces
      if (rawGame.metadata?.['enonces'] && Array.isArray(rawGame.metadata['enonces'])) {
        gameDataJson = {
          enonces: (rawGame.metadata['enonces'] as VraiFauxEnonce[]).map((enonce: VraiFauxEnonce) => ({
            texte: enonce.texte || '',
            reponse_correcte: enonce.reponse_correcte ?? false
          }))
        };
      } else if (rawGame.reponses) {
        gameDataJson = rawGame.reponses;
      }
    } else if (gameTypeName === 'liens') {
      // Liens : convertir depuis metadata
      if (rawGame.metadata?.['mots'] || rawGame.metadata?.['reponses'] || rawGame.metadata?.['liens']) {
        gameDataJson = {
          mots: rawGame.metadata['mots'] || [],
          reponses: rawGame.metadata['reponses'] || [],
          liens: rawGame.metadata['liens'] || []
        };
      } else if (rawGame.reponses) {
        gameDataJson = rawGame.reponses;
      }
    } else if (gameTypeName === 'case_vide' || gameTypeName === 'case vide') {
      // Case vide : convertir depuis metadata
      if (rawGame.metadata) {
        gameDataJson = {
          texte: rawGame.metadata['texte'] || '',
          cases_vides: rawGame.metadata['cases_vides'] || [],
          banque_mots: rawGame.metadata['banque_mots'] || [],
          mots_leurres: rawGame.metadata['mots_leurres'] || []
        };
      } else if (rawGame.reponses) {
        gameDataJson = rawGame.reponses;
      }
    } else if (gameTypeName === 'simon') {
      // Simon : convertir depuis metadata
      if (rawGame.metadata) {
        gameDataJson = {
          nombre_elements: rawGame.metadata['nombre_elements'] || 4,
          type_elements: rawGame.metadata['type_elements'] || 'couleurs',
          elements: rawGame.metadata['elements'] || []
        };
      } else if (rawGame.reponses) {
        gameDataJson = rawGame.reponses;
      }
    } else if (gameTypeName === 'image_interactive') {
      // Image interactive (click) : convertir depuis metadata
      if (rawGame.metadata) {
        gameDataJson = {
          image_url: rawGame.metadata['image_url'] || '',
          image_width: rawGame.metadata['image_width'] || 0,
          image_height: rawGame.metadata['image_height'] || 0,
          zones: rawGame.metadata['zones'] || [],
          require_all_correct_zones: rawGame.metadata['require_all_correct_zones'] !== undefined 
            ? rawGame.metadata['require_all_correct_zones'] 
            : true
        };
      } else if (rawGame.reponses) {
        gameDataJson = rawGame.reponses;
      }
    } else if (rawGame.reponses) {
      // Pour les autres types, utiliser reponses si disponible
      gameDataJson = rawGame.reponses;
    }
  }
  
  // Retourner le jeu normalisé
  return {
    id: rawGame.id,
    name: rawGame.name,
    description: rawGame.description,
    subject_id: rawGame.subject_id,
    subject_category_id: rawGame.subject_category_id,
    game_type: gameTypeName || rawGame.game_type || 'generic',
    game_data_json: gameDataJson,
    image_url: rawGame.image_url,
    created_at: rawGame.created_at,
    updated_at: rawGame.updated_at,
    // Garder les anciens champs pour compatibilité
    question: rawGame.question,
    reponses: rawGame.reponses,
    aides: rawGame.aides,
    metadata: rawGame.metadata,
    instructions: rawGame.instructions
  };
}
