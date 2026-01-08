import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PuzzlePieceGeneratorService {
  /**
   * Génère un PNG d'une pièce de puzzle depuis un polygone
   * Utilise un Web Worker avec OffscreenCanvas pour ne pas bloquer l'UI
   * @param imageUrl URL de l'image originale
   * @param polygonPoints Points du polygone en coordonnées relatives (0-1)
   * @param imageWidth Largeur originale de l'image
   * @param imageHeight Hauteur originale de l'image
   * @returns Observable avec le Blob PNG de la pièce
   */
  /**
   * Génère un PNG d'une pièce de puzzle
   * Pour l'instant, utilise la version sync (on peut ajouter un Worker plus tard si nécessaire)
   * @param imageUrl URL de l'image originale
   * @param polygonPoints Points du polygone en coordonnées relatives (0-1)
   * @param imageWidth Largeur originale de l'image
   * @param imageHeight Hauteur originale de l'image
   * @returns Promise avec le Blob PNG de la pièce
   */
  generatePiecePNG(
    imageUrl: string,
    polygonPoints: { x: number; y: number }[],
    imageWidth: number,
    imageHeight: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = imageWidth;
          canvas.height = imageHeight;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Impossible de créer un contexte canvas'));
            return;
          }

          // Créer le chemin du polygone
          ctx.beginPath();
          polygonPoints.forEach((p, i) => {
            const x = p.x * imageWidth;
            const y = p.y * imageHeight;
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.closePath();

          // Clipper avec le polygone
          ctx.clip();

          // Dessiner l'image
          ctx.drawImage(img, 0, 0, imageWidth, imageHeight);

          // Convertir en Blob PNG
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Erreur lors de la conversion en PNG'));
                return;
              }
              resolve(blob);
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
