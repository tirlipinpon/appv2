// Mapper pour convertir les anciennes structures de données (avec index) vers les nouvelles (avec contenu)
// Permet la rétrocompatibilité avec les jeux existants

import type { LiensData, ChronologieData } from '@shared/games';
import { isGameType } from './game-type.util';

// Anciennes structures (pour référence)
interface OldLiensData {
  mots: string[];
  reponses: string[];
  liens: { mot_index: number; reponse_index: number }[];
}

interface OldChronologieData {
  mots: string[];
  ordre_correct: number[];
}

/**
 * Convertit les données de liens de l'ancien format (index) vers le nouveau format (contenu)
 */
export function convertLiensDataFromIndex(data: OldLiensData | LiensData): LiensData {
  // Si déjà au nouveau format (vérifier si les liens utilisent des strings)
  if (data.liens && data.liens.length > 0) {
    const firstLien = data.liens[0] as any;
    if (firstLien && typeof firstLien === 'object' && 'mot' in firstLien && 'reponse' in firstLien) {
      // Déjà au nouveau format
      return data as LiensData;
    }
  }

  // Conversion depuis l'ancien format
  const oldData = data as OldLiensData;
  return {
    mots: oldData.mots || [],
    reponses: oldData.reponses || [],
    liens: (oldData.liens || []).map(l => ({
      mot: oldData.mots[l.mot_index] || '',
      reponse: oldData.reponses[l.reponse_index] || '',
    })).filter(l => l.mot && l.reponse), // Filtrer les associations invalides
  };
}

/**
 * Convertit les données de chronologie de l'ancien format (index) vers le nouveau format (contenu)
 */
export function convertChronologieDataFromIndex(data: OldChronologieData | ChronologieData): ChronologieData {
  // Si déjà au nouveau format (vérifier si ordre_correct contient des strings)
  if (data.ordre_correct && data.ordre_correct.length > 0) {
    if (typeof data.ordre_correct[0] === 'string') {
      // Déjà au nouveau format
      return data as ChronologieData;
    }
  }

  // Conversion depuis l'ancien format
  const oldData = data as OldChronologieData;
  return {
    mots: oldData.mots || [],
    ordre_correct: (oldData.ordre_correct || [])
      .map(index => oldData.mots[index])
      .filter(mot => mot !== undefined && mot !== null) as string[],
  };
}

/**
 * Normalise les données de jeu en convertissant automatiquement les anciens formats
 */
export function normalizeGameData(
  gameType: string,
  metadata: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!metadata) return null;

  try {
    if (isGameType(gameType, 'liens') && metadata['mots'] && metadata['reponses'] && metadata['liens']) {
      return convertLiensDataFromIndex(metadata as any) as unknown as Record<string, unknown>;
    }

    if (isGameType(gameType, 'chronologie') && metadata['mots'] && metadata['ordre_correct']) {
      return convertChronologieDataFromIndex(metadata as any) as unknown as Record<string, unknown>;
    }

    // Autres types de jeux n'ont pas besoin de conversion
    return metadata;
  } catch (error) {
    console.warn('Erreur lors de la normalisation des données de jeu:', error);
    return metadata;
  }
}

