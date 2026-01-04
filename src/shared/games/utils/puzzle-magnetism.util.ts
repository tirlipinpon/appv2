/**
 * Utilitaires pour l'aimantation (snap) des pièces de puzzle
 */

export interface Position {
  x: number;
  y: number;
}

export interface SnappedPosition extends Position {
  snapped: boolean;
}

/**
 * Calcule la position aimantée d'une pièce en fonction de sa position cible
 * @param currentPosition Position actuelle de la pièce
 * @param targetPosition Position cible (original_x, original_y converties en pixels)
 * @param snapThreshold Seuil de tolérance en pixels (défaut: 30px)
 * @returns Position avec flag snapped si dans le seuil
 */
export function calculateSnappedPosition(
  currentPosition: Position,
  targetPosition: Position,
  snapThreshold: number = 30
): SnappedPosition {
  const distance = Math.sqrt(
    Math.pow(currentPosition.x - targetPosition.x, 2) +
    Math.pow(currentPosition.y - targetPosition.y, 2)
  );

  if (distance <= snapThreshold) {
    return {
      x: targetPosition.x,
      y: targetPosition.y,
      snapped: true,
    };
  }

  return {
    x: currentPosition.x,
    y: currentPosition.y,
    snapped: false,
  };
}

/**
 * Convertit une position relative (0-1) en position absolue en pixels
 * @param relativeX Position X relative (0-1)
 * @param relativeY Position Y relative (0-1)
 * @param width Largeur de référence en pixels
 * @param height Hauteur de référence en pixels
 * @returns Position absolue en pixels
 */
export function relativeToAbsolute(
  relativeX: number,
  relativeY: number,
  width: number,
  height: number
): Position {
  return {
    x: relativeX * width,
    y: relativeY * height,
  };
}
