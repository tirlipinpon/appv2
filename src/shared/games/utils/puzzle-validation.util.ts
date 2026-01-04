/**
 * Utilitaires pour la validation des positions des pièces de puzzle
 */

import type { PuzzlePiece } from '../types/game-data';

/**
 * Vérifie si toutes les pièces sont à leur position correcte
 * @param pieces État des pièces avec leurs positions actuelles et cibles
 * @param threshold Seuil de tolérance en pixels (défaut: 30px)
 * @returns true si toutes les pièces sont à leur position correcte
 */
export function validatePiecePositions(
  pieces: Array<{
    piece: PuzzlePiece;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    isPlaced: boolean;
  }>,
  threshold: number = 30
): boolean {
  if (pieces.length === 0) {
    return false;
  }

  return pieces.every(pieceState => {
    const dx = Math.abs(pieceState.x - pieceState.targetX);
    const dy = Math.abs(pieceState.y - pieceState.targetY);
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= threshold;
  });
}
