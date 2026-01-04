import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PuzzleImageOptimizerService {
  private readonly maxWidth = 1920;
  private readonly maxHeight = 1920;
  private readonly webpQuality = 0.85;

  /**
   * Optimise une image avant upload (redimensionne si nécessaire, convertit en WebP)
   * @param file Fichier image à optimiser
   * @returns Promise avec le fichier optimisé en WebP
   */
  async optimizeUploadImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Impossible de créer un contexte canvas'));
        return;
      }

      img.onload = () => {
        try {
          let width = img.naturalWidth;
          let height = img.naturalHeight;

          // Redimensionner si nécessaire
          if (width > this.maxWidth || height > this.maxHeight) {
            const ratio = Math.min(this.maxWidth / width, this.maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Erreur lors de la conversion en WebP'));
                return;
              }

              const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                type: 'image/webp',
                lastModified: Date.now()
              });

              resolve(webpFile);
            },
            'image/webp',
            this.webpQuality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Erreur lors du chargement de l\'image'));

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        }
      };
      reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Obtient les dimensions d'une image
   */
  async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => reject(new Error('Impossible de charger l\'image'));
      
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    });
  }
}
