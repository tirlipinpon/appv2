import { Injectable } from '@angular/core';

export interface PiecePNGResult {
  blob: Blob;
  croppedPolygonPoints: { x: number; y: number }[];
}

export interface BoundingBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

@Injectable({
  providedIn: 'root',
})
export class PuzzlePieceGeneratorService {
  /**
   * Calcule la bounding box d'un polygone avec padding
   * @param polygonPoints Points du polygone en coordonnées relatives (0-1)
   * @param imageWidth Largeur de l'image
   * @param imageHeight Hauteur de l'image
   * @param padding Padding en pixels autour de la bounding box (défaut: 2)
   * @returns Bounding box avec minX, minY, width, height
   */
  public calculateBoundingBox(
    polygonPoints: { x: number; y: number }[],
    imageWidth: number,
    imageHeight: number,
    padding = 2
  ): BoundingBox {
    if (polygonPoints.length === 0) {
      return { minX: 0, minY: 0, width: imageWidth, height: imageHeight };
    }

    // Convertir en coordonnées absolues
    const absolutePoints = polygonPoints.map(p => ({
      x: p.x * imageWidth,
      y: p.y * imageHeight,
    }));

    // Trouver min/max
    let minX = absolutePoints[0].x;
    let minY = absolutePoints[0].y;
    let maxX = absolutePoints[0].x;
    let maxY = absolutePoints[0].y;

    for (const point of absolutePoints) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    // Ajouter le padding
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(imageWidth, maxX + padding);
    maxY = Math.min(imageHeight, maxY + padding);

    const width = maxX - minX;
    const height = maxY - minY;

    return { minX, minY, width, height };
  }

  /**
   * Génère un PNG d'une pièce de puzzle croppée à la taille exacte de la pièce
   * @param imageUrl URL de l'image originale
   * @param polygonPoints Points du polygone en coordonnées relatives (0-1)
   * @param imageWidth Largeur originale de l'image
   * @param imageHeight Hauteur originale de l'image
   * @returns Promise avec le Blob PNG et les points du polygone recalculés relativement à l'image croppée
   */
  generatePiecePNG(
    imageUrl: string,
    polygonPoints: { x: number; y: number }[],
    imageWidth: number,
    imageHeight: number
  ): Promise<PiecePNGResult> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          // Calculer la bounding box du polygone
          const bbox = this.calculateBoundingBox(polygonPoints, imageWidth, imageHeight, 2);

          // Créer le canvas à la taille de la bounding box seulement
          const canvas = document.createElement('canvas');
          canvas.width = bbox.width;
          canvas.height = bbox.height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Impossible de créer un contexte canvas'));
            return;
          }

          // Convertir les points du polygone en coordonnées absolues
          const absolutePoints = polygonPoints.map(p => ({
            x: p.x * imageWidth,
            y: p.y * imageHeight,
          }));

          // Décaler les points relativement à la bounding box (soustraire minX et minY)
          const shiftedPoints = absolutePoints.map(p => ({
            x: p.x - bbox.minX,
            y: p.y - bbox.minY,
          }));

          // Créer le chemin du polygone avec les points décalés
          ctx.beginPath();
          shiftedPoints.forEach((p, i) => {
            if (i === 0) {
              ctx.moveTo(p.x, p.y);
            } else {
              ctx.lineTo(p.x, p.y);
            }
          });
          ctx.closePath();

          // Clipper avec le polygone
          ctx.clip();

          // Dessiner seulement la zone croppée de l'image source
          // drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
          ctx.drawImage(
            img,
            bbox.minX,      // sx: source X
            bbox.minY,      // sy: source Y
            bbox.width,     // sWidth: source width
            bbox.height,    // sHeight: source height
            0,              // dx: destination X
            0,              // dy: destination Y
            bbox.width,     // dWidth: destination width
            bbox.height     // dHeight: destination height
          );

          // Convertir les points décalés en coordonnées relatives (0-1) par rapport à l'image croppée
          const croppedPolygonPoints = shiftedPoints.map(p => ({
            x: p.x / bbox.width,
            y: p.y / bbox.height,
          }));

          // Convertir en Blob PNG
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Erreur lors de la conversion en PNG'));
                return;
              }
              resolve({ blob, croppedPolygonPoints });
            },
            'image/png'
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Erreur lors du chargement de l\'image'));
      };

      img.src = imageUrl;
    });
  }
}
