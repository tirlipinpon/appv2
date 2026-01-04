import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PuzzleValidationService {
  /**
   * Valide qu'un polygone a au moins 3 points
   */
  validatePolygon(points: Array<{ x: number; y: number }>): boolean {
    return points.length >= 3;
  }

  /**
   * Vérifie si un polygone a des auto-intersections (lignes qui se croisent)
   * Utilise l'algorithme de détection d'intersection de segments
   */
  hasIntersections(points: Array<{ x: number; y: number }>): boolean {
    if (points.length < 4) {
      // Un triangle ne peut pas avoir d'auto-intersection
      return false;
    }

    // Vérifier chaque segment avec tous les autres segments non adjacents
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      
      // Vérifier avec tous les segments non adjacents
      for (let j = i + 2; j < points.length; j++) {
        // Ne pas vérifier le dernier segment avec le premier (déjà couvert)
        if (i === 0 && j === points.length - 1) {
          continue;
        }
        
        const p3 = points[j];
        const p4 = points[(j + 1) % points.length];
        
        if (this.segmentsIntersect(p1, p2, p3, p4)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Vérifie si deux segments de ligne se croisent
   * Utilise l'algorithme CCW (Counter-Clockwise)
   */
  private segmentsIntersect(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    p4: { x: number; y: number }
  ): boolean {
    // Fonction pour déterminer l'orientation de trois points
    const ccw = (A: { x: number; y: number }, B: { x: number; y: number }, C: { x: number; y: number }): boolean => {
      return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
    };

    // Deux segments (p1,p2) et (p3,p4) se croisent si et seulement si
    // (p1,p2,p3) et (p1,p2,p4) ont des orientations différentes ET
    // (p3,p4,p1) et (p3,p4,p2) ont des orientations différentes
    return (
      ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
      ccw(p1, p2, p3) !== ccw(p1, p2, p4)
    );
  }
}
