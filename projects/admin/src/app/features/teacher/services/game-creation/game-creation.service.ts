import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { GamesApplication } from '../../components/games/application/application';
import { ImageUploadService } from '../../components/games/services/image-upload/image-upload.service';
import { ErrorSnackbarService } from '../../../../shared';
import type { Game, GameCreate } from '../../types/game';
import type {
  CaseVideData,
  ReponseLibreData,
  LiensData,
  ChronologieData,
  QcmData,
  VraiFauxData,
  MemoryData,
  SimonData,
  ImageInteractiveData,
} from '@shared/games';
import type { ImageInteractiveDataWithFile } from '../../components/games/components/image-interactive-form/image-interactive-form.component';

export type GameData =
  | CaseVideData
  | ReponseLibreData
  | LiensData
  | ChronologieData
  | QcmData
  | VraiFauxData
  | MemoryData
  | SimonData
  | ImageInteractiveData;

export interface CreateGameParams {
  gameTypeId: string;
  gameTypeName: string | null;
  subjectId: string;
  categoryId?: string | null;
  instructions?: string | null;
  question?: string | null;
  aides?: string[] | null;
  gameData: GameData | ImageInteractiveDataWithFile;
  imageDataWithFile?: ImageInteractiveDataWithFile | null;
}

export interface DuplicateGameParams {
  gameTypeId: string;
  gameTypeName: string;
  subjectId: string;
  categoryId?: string | null;
  instructions?: string | null;
  question?: string | null;
  aides?: string[] | null;
  metadata: Record<string, unknown> | null;
  sourceImageUrl?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class GameCreationService {
  private readonly application = inject(GamesApplication);
  private readonly imageUploadService = inject(ImageUploadService);
  private readonly errorSnackbar = inject(ErrorSnackbarService);

  /**
   * Génère un nom automatique pour un jeu basé sur le type et la question
   */
  generateAutoName(
    gameTypeName: string | null,
    question: string | null | undefined
  ): string {
    const typeName = gameTypeName || 'Jeu';
    const questionPreview =
      question && typeof question === 'string' && question.trim()
        ? question.trim().substring(0, 30)
        : '';
    return questionPreview
      ? `${typeName} - ${questionPreview}${questionPreview.length >= 30 ? '...' : ''}`
      : typeName;
  }

  /**
   * Vérifie si un type de jeu est un jeu ImageInteractive (click)
   */
  isImageInteractiveGame(gameTypeName: string | null): boolean {
    if (!gameTypeName) return false;
    const normalized = gameTypeName.toLowerCase();
    return normalized === 'click' || normalized === 'image interactive';
  }

  /**
   * Vérifie si les données contiennent une image_url valide
   */
  hasImageUrl(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    return (
      'image_url' in data &&
      typeof (data as { image_url: unknown }).image_url === 'string' &&
      ((data as { image_url: string }).image_url.length > 0)
    );
  }

  /**
   * Crée un jeu avec gestion automatique de l'upload d'image si nécessaire
   */
  createGameWithImage(params: CreateGameParams): Observable<Game | null> {
    const {
      gameTypeId,
      gameTypeName,
      subjectId,
      categoryId,
      instructions,
      question,
      aides,
      gameData,
      imageDataWithFile,
    } = params;

    const isImageInteractive = this.isImageInteractiveGame(gameTypeName);
    const hasFile = imageDataWithFile?.imageFile !== undefined;
    const hasUrl = isImageInteractive && this.hasImageUrl(gameData);

    const autoName = this.generateAutoName(gameTypeName, question);
    const filteredAides = aides?.filter((a) => a && a.trim()) || null;

    // Construire les données de base du jeu
    const baseGameData: GameCreate = {
      subject_id: categoryId ? null : subjectId,
      subject_category_id: categoryId || null,
      game_type_id: gameTypeId,
      name: autoName,
      instructions: instructions || null,
      question: question?.trim() || null,
      reponses: null,
      aides: filteredAides && filteredAides.length > 0 ? filteredAides : null,
      metadata: null, // Sera défini selon le cas
    };

    // Cas 1: Jeu ImageInteractive avec nouveau fichier à uploader
    if (isImageInteractive && hasFile && imageDataWithFile?.imageFile) {
      return this.createGameWithFileUpload(
        baseGameData,
        imageDataWithFile,
        gameData as ImageInteractiveData
      );
    }

    // Cas 2: Jeu ImageInteractive avec image_url existante
    if (isImageInteractive && hasUrl && !hasFile) {
      baseGameData.metadata = gameData as unknown as Record<string, unknown>;
      return this.application.createGame(baseGameData);
    }

    // Cas 3: Jeu normal (pas ImageInteractive ou pas d'image)
    baseGameData.metadata = gameData as unknown as Record<string, unknown>;
    return this.application.createGame(baseGameData);
  }

  /**
   * Crée un jeu ImageInteractive avec upload d'image
   */
  private createGameWithFileUpload(
    baseGameData: GameCreate,
    imageDataWithFile: ImageInteractiveDataWithFile,
    gameData: ImageInteractiveData
  ): Observable<Game | null> {
    const file = imageDataWithFile.imageFile!;

    // Extraire les données sans le fichier
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { imageFile, oldImageUrl, ...imageData } = imageDataWithFile;
    const imageDataTyped = imageData as ImageInteractiveData;

    // Créer le jeu sans image d'abord
    const gameDataWithoutImage: ImageInteractiveData = {
      image_url: '',
      image_width: 0,
      image_height: 0,
      zones: imageDataTyped.zones,
      require_all_correct_zones: imageDataTyped.require_all_correct_zones,
    };

    baseGameData.metadata = gameDataWithoutImage as unknown as Record<string, unknown>;

    return this.application.createGame(baseGameData).pipe(
      switchMap((createdGame) => {
        if (!createdGame) {
          this.errorSnackbar.showError('Erreur lors de la création du jeu');
          return of(null);
        }

        // Uploader l'image dans le dossier du jeu créé
        return this.imageUploadService.uploadImage(file, createdGame.id).pipe(
          switchMap((result) => {
            if (result.error) {
              this.errorSnackbar.showError(
                `Erreur lors de l'upload de l'image: ${result.error}`
              );
              return of(null);
            }

            // Mettre à jour le jeu avec l'URL de l'image
            const updatedImageData: ImageInteractiveData = {
              image_url: result.url,
              image_width: result.width,
              image_height: result.height,
              zones: imageDataTyped.zones,
              require_all_correct_zones: imageDataTyped.require_all_correct_zones,
            };

            this.application.updateGame(createdGame.id, {
              metadata: updatedImageData as unknown as Record<string, unknown>,
            });

            return of(createdGame);
          }),
          catchError((error) => {
            this.errorSnackbar.showError('Erreur lors de l\'upload de l\'image');
            return of(null);
          })
        );
      }),
      catchError((error) => {
        this.errorSnackbar.showError('Erreur lors de la création du jeu');
        return of(null);
      })
    );
  }

  /**
   * Duplique un jeu avec gestion automatique de la copie d'image si nécessaire
   */
  duplicateGameWithImage(params: DuplicateGameParams): Observable<Game | null> {
    const {
      gameTypeId,
      gameTypeName,
      subjectId,
      categoryId,
      instructions,
      question,
      aides,
      metadata,
      sourceImageUrl,
    } = params;

    const isClickGame = this.isImageInteractiveGame(gameTypeName);
    const hasImageUrl =
      sourceImageUrl &&
      typeof sourceImageUrl === 'string' &&
      sourceImageUrl.length > 0;

    const autoName = this.generateAutoName(gameTypeName, question);
    const filteredAides = aides?.filter((a) => a && a.trim()) || null;

    const baseGameData: GameCreate = {
      subject_id: categoryId ? null : subjectId,
      subject_category_id: categoryId || null,
      game_type_id: gameTypeId,
      name: autoName,
      instructions: instructions || null,
      question: question?.trim() || null,
      reponses: null,
      aides: filteredAides && filteredAides.length > 0 ? filteredAides : null,
      metadata: null,
    };

    // Cas 1: Jeu click avec image à copier
    if (isClickGame && hasImageUrl && metadata) {
      return this.duplicateGameWithImageCopy(
        baseGameData,
        metadata,
        sourceImageUrl!
      );
    }

    // Cas 2: Jeu click sans image_url
    if (isClickGame && !hasImageUrl && metadata) {
      const metadataWithoutImage: ImageInteractiveData = {
        image_url: '',
        image_width: 0,
        image_height: 0,
        zones: (metadata as unknown as ImageInteractiveData)?.zones || [],
        require_all_correct_zones:
          (metadata as unknown as ImageInteractiveData)?.require_all_correct_zones ??
          true,
      };
      baseGameData.metadata = metadataWithoutImage as unknown as Record<string, unknown>;
      return this.application.createGame(baseGameData);
    }

    // Cas 3: Jeu normal
    baseGameData.metadata = metadata;
    return this.application.createGame(baseGameData);
  }

  /**
   * Duplique un jeu ImageInteractive en copiant l'image
   */
  private duplicateGameWithImageCopy(
    baseGameData: GameCreate,
    metadata: Record<string, unknown>,
    sourceImageUrl: string
  ): Observable<Game | null> {
    const metadataWithoutImage: ImageInteractiveData = {
      image_url: '',
      image_width: 0,
      image_height: 0,
      zones: (metadata as unknown as ImageInteractiveData)?.zones || [],
      require_all_correct_zones:
        (metadata as unknown as ImageInteractiveData)?.require_all_correct_zones ??
        true,
    };

    baseGameData.metadata = metadataWithoutImage as unknown as Record<string, unknown>;

    return this.application.createGame(baseGameData).pipe(
      switchMap((createdGame) => {
        if (!createdGame) {
          this.errorSnackbar.showError('Erreur lors de la duplication du jeu');
          return of(null);
        }

        // Copier l'image dans le nouveau dossier du jeu
        return this.imageUploadService.copyImageToGame(sourceImageUrl, createdGame.id).pipe(
          switchMap((result) => {
            if (result.error) {
              this.errorSnackbar.showError(
                `Erreur lors de la copie de l'image: ${result.error}`
              );
              return of(null);
            }

            // Mettre à jour le jeu avec la nouvelle URL d'image
            const updatedMetadata: ImageInteractiveData = {
              image_url: result.url,
              image_width: result.width,
              image_height: result.height,
              zones: metadataWithoutImage.zones,
              require_all_correct_zones: metadataWithoutImage.require_all_correct_zones,
            };

            this.application.updateGame(createdGame.id, {
              metadata: updatedMetadata as unknown as Record<string, unknown>,
            });

            return of(createdGame);
          }),
          catchError((error) => {
            this.errorSnackbar.showError('Erreur lors de la copie de l\'image');
            return of(null);
          })
        );
      }),
      catchError((error) => {
        this.errorSnackbar.showError('Erreur lors de la duplication du jeu');
        return of(null);
      })
    );
  }
}
