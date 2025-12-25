import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { SupabaseService } from '../../../../../../shared/services/supabase/supabase.service';

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

  /**
   * Upload une image vers Supabase Storage
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

    // Générer un nom de fichier unique
    const fileExt = file.name.split('.').pop();
    const fileName = gameId 
      ? `${gameId}/${Date.now()}.${fileExt}`
      : `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload vers Supabase Storage
    return from(
      this.supabaseService.client.storage
        .from(this.bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
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

