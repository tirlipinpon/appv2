import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from '../../../../shared';

@Injectable({
  providedIn: 'root',
})
export class PuzzleStorageService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly bucketName = 'puzzle-images';

  /**
   * Upload une pièce PNG dans Supabase Storage
   * @param pieceId UUID de la pièce
   * @param blob Blob PNG de la pièce
   * @param gameId ID du jeu pour organiser les fichiers
   * @returns Observable avec l'URL publique de l'image
   */
  uploadPiecePNG(pieceId: string, blob: Blob, gameId: string): Observable<string> {
    const fileName = `${gameId}/${pieceId}.png`;

    return from(
      this.supabaseService.client.storage
        .from(this.bucketName)
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: true, // Permettre l'écrasement des fichiers existants lors de la régénération
          contentType: 'image/png'
        })
    ).pipe(
      map((result) => {
        if (result.error) {
          throw new Error(result.error.message || 'Erreur lors de l\'upload de la pièce');
        }

        // Obtenir l'URL publique
        const { data: urlData } = this.supabaseService.client.storage
          .from(this.bucketName)
          .getPublicUrl(fileName);

        return urlData.publicUrl;
      }),
      catchError((error) => {
        throw error instanceof Error ? error : new Error('Erreur lors de l\'upload de la pièce');
      })
    );
  }

  /**
   * Supprime une pièce PNG du storage
   * @param pieceUrl URL de la pièce à supprimer
   */
  deletePiecePNG(pieceUrl: string): Observable<void> {
    try {
      const url = new URL(pieceUrl);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.indexOf(this.bucketName);
      
      if (bucketIndex < 0 || bucketIndex >= pathParts.length - 1) {
        throw new Error('URL invalide');
      }

      const filePath = pathParts.slice(bucketIndex + 1).join('/');
      const cleanPath = filePath.split('?')[0];

      return from(
        this.supabaseService.client.storage
          .from(this.bucketName)
          .remove([cleanPath])
      ).pipe(
        map((result) => {
          if (result.error) {
            throw new Error(result.error.message || 'Erreur lors de la suppression');
          }
        }),
        catchError((error) => {
          throw error instanceof Error ? error : new Error('Erreur lors de la suppression');
        })
      );
    } catch (error) {
      return from(Promise.reject(error));
    }
  }

  /**
   * Compresse un blob PNG/WebP en WebP pour réduire la taille
   */
  async compressImage(blob: Blob, quality: number = 0.85): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Impossible de créer un contexte canvas'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (compressedBlob) => {
            if (!compressedBlob) {
              reject(new Error('Erreur lors de la compression'));
              return;
            }
            resolve(compressedBlob);
          },
          'image/webp',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Erreur lors du chargement de l\'image'));
      img.src = URL.createObjectURL(blob);
    });
  }
}
