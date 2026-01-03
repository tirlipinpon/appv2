import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { SupabaseService } from '../../../../../../shared';

export interface ImageUploadResult {
  url: string;
  width: number;
  height: number;
  error: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class ImageUploadService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly bucketName = 'game-images';
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  
  // Paramètres d'optimisation pour les images de jeux
  private readonly maxWidth = 1920; // Largeur maximale en pixels
  private readonly maxHeight = 1920; // Hauteur maximale en pixels
  private readonly webpQuality = 0.85; // Qualité WebP (0.0 à 1.0)

  /**
   * Upload une image vers Supabase Storage
   * Pour les jeux "click", l'image sera automatiquement convertie en WebP et optimisée
   * @param file Le fichier image à uploader
   * @param gameId Optionnel : ID du jeu pour organiser les fichiers
   * @returns Observable avec l'URL de l'image et ses dimensions
   */
  uploadImage(file: File, gameId?: string): Observable<ImageUploadResult> {
    // Validation du type de fichier
    if (!this.allowedTypes.includes(file.type)) {
      return from([{
        url: '',
        width: 0,
        height: 0,
        error: `Type de fichier non autorisé. Types acceptés : ${this.allowedTypes.join(', ')}`
      }]);
    }

    // Validation de la taille
    if (file.size > this.maxFileSize) {
      return from([{
        url: '',
        width: 0,
        height: 0,
        error: `Fichier trop volumineux. Taille maximale : ${this.maxFileSize / 1024 / 1024}MB`
      }]);
    }

    // Optimiser et convertir en WebP avant l'upload
    return from(this.optimizeImageToWebP(file)).pipe(
      switchMap((optimizedFile) => {
        // Générer un nom de fichier unique en WebP
        const fileName = gameId 
          ? `${gameId}/${Date.now()}.webp`
          : `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;

        // Upload vers Supabase Storage
        return from(
          this.supabaseService.client.storage
            .from(this.bucketName)
            .upload(fileName, optimizedFile, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'image/webp'
            })
        ).pipe(
          switchMap((result) => {
            if (result.error) {
              return from([{
                url: '',
                width: 0,
                height: 0,
                error: result.error.message || 'Erreur lors de l\'upload de l\'image'
              }]);
            }

            // Obtenir l'URL publique
            const { data: urlData } = this.supabaseService.client.storage
              .from(this.bucketName)
              .getPublicUrl(fileName);

            // Charger l'image pour obtenir ses dimensions
            return from(this.getImageDimensions(urlData.publicUrl)).pipe(
              map((dimensions) => ({
                url: urlData.publicUrl,
                width: dimensions.width,
                height: dimensions.height,
                error: null
              })),
              catchError((error) => of({
                url: urlData.publicUrl,
                width: 0,
                height: 0,
                error: error instanceof Error ? error.message : 'Erreur lors de la lecture des dimensions'
              }))
            );
          })
        );
      }),
      catchError((error) => of({
        url: '',
        width: 0,
        height: 0,
        error: error instanceof Error ? error.message : 'Erreur lors de l\'optimisation de l\'image'
      }))
    );
  }

  /**
   * Optimise une image et la convertit en WebP
   * Redimensionne si nécessaire et compresse avec qualité optimale
   */
  private async optimizeImageToWebP(file: File): Promise<File> {
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
          // Calculer les nouvelles dimensions en conservant le ratio
          let width = img.naturalWidth;
          let height = img.naturalHeight;

          if (width > this.maxWidth || height > this.maxHeight) {
            const ratio = Math.min(this.maxWidth / width, this.maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          // Définir la taille du canvas
          canvas.width = width;
          canvas.height = height;

          // Dessiner l'image redimensionnée sur le canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Convertir en WebP
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Erreur lors de la conversion en WebP'));
                return;
              }

              // Créer un nouveau File depuis le Blob
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

      img.onerror = () => {
        reject(new Error('Erreur lors du chargement de l\'image'));
      };

      // Charger l'image depuis le fichier
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        }
      };
      reader.onerror = () => {
        reject(new Error('Erreur lors de la lecture du fichier'));
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Obtient les dimensions d'une image depuis son URL
   */
  private getImageDimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        reject(new Error('Impossible de charger l\'image pour obtenir ses dimensions'));
      };
      img.src = url;
    });
  }

  /**
   * Copie une image d'un jeu vers un autre jeu
   * @param sourceImageUrl URL de l'image source
   * @param targetGameId ID du jeu de destination
   * @returns Observable avec la nouvelle URL de l'image
   */
  copyImageToGame(sourceImageUrl: string, targetGameId: string): Observable<ImageUploadResult> {
    try {
      // Extraire le chemin du fichier depuis l'URL Supabase
      const url = new URL(sourceImageUrl);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.indexOf(this.bucketName);
      
      if (bucketIndex < 0 || bucketIndex >= pathParts.length - 1) {
        return from([{
          url: '',
          width: 0,
          height: 0,
          error: 'URL d\'image invalide'
        }]);
      }

      // Extraire le chemin du fichier source
      const sourceFilePath = pathParts.slice(bucketIndex + 1).join('/');
      const cleanSourcePath = sourceFilePath.split('?')[0];

      // Télécharger l'image source depuis Supabase Storage
      return from(
        this.supabaseService.client.storage
          .from(this.bucketName)
          .download(cleanSourcePath)
      ).pipe(
        switchMap((result) => {
          if (result.error) {
            return from([{
              url: '',
              width: 0,
              height: 0,
              error: result.error.message || 'Erreur lors du téléchargement de l\'image source'
            }]);
          }

          // Convertir le Blob en File
          const blob = result.data;
          const fileName = cleanSourcePath.split('/').pop() || 'image.webp';
          const file = new File([blob], fileName, { type: 'image/webp' });

          // Uploader dans le nouveau dossier avec le gameId
          return this.uploadImage(file, targetGameId);
        }),
        catchError((error) => of({
          url: '',
          width: 0,
          height: 0,
          error: error instanceof Error ? error.message : 'Erreur lors de la copie de l\'image'
        }))
      );
    } catch (error) {
      return from([{
        url: '',
        width: 0,
        height: 0,
        error: error instanceof Error ? error.message : 'Erreur lors de l\'extraction du chemin de l\'image'
      }]);
    }
  }

  /**
   * Supprime une image du storage
   */
  deleteImage(imageUrl: string): Observable<{ success: boolean; error: string | null }> {
    // Extraire le chemin du fichier depuis l'URL Supabase
    // Format: https://...supabase.co/storage/v1/object/public/game-images/path/to/file.ext
    // On veut: path/to/file.ext
    try {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.indexOf(this.bucketName);
      
      if (bucketIndex >= 0 && bucketIndex < pathParts.length - 1) {
        // Prendre tout ce qui vient après le nom du bucket
        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        // Retirer les query params si présents
        const cleanPath = filePath.split('?')[0];
        
        return from(
          this.supabaseService.client.storage
            .from(this.bucketName)
            .remove([cleanPath])
        ).pipe(
          map((result) => ({
            success: !result.error,
            error: result.error?.message || null
          }))
        );
      } else {
        // Fallback: prendre juste le dernier segment
        const fileName = pathParts[pathParts.length - 1].split('?')[0];
        return from(
          this.supabaseService.client.storage
            .from(this.bucketName)
            .remove([fileName])
        ).pipe(
          map((result) => ({
            success: !result.error,
            error: result.error?.message || null
          }))
        );
      }
    } catch {
      // Si l'URL n'est pas valide, essayer de prendre le dernier segment
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];
      return from(
        this.supabaseService.client.storage
          .from(this.bucketName)
          .remove([fileName])
      ).pipe(
        map((result) => ({
          success: !result.error,
          error: result.error?.message || null
        }))
      );
    }
  }
}

