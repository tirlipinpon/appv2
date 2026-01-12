import { Injectable, inject } from '@angular/core';
import { Observable, of, forkJoin, from } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { GamesApplication } from '../../components/games/application/application';
import { ImageUploadService } from '../../components/games/services/image-upload/image-upload.service';
import { AideMediaUploadService } from '../../components/games/services/aide-media/aide-media-upload.service';
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
  PuzzleData,
} from '@shared/games';
import type { ImageInteractiveDataWithFile } from '../../components/games/components/image-interactive-form/image-interactive-form.component';
import type { PuzzleDataWithFile } from '../../components/games/components/puzzle-form/puzzle-form.component';
import { PuzzleStorageService } from '../puzzle/puzzle-storage.service';
import { PuzzlePieceGeneratorService } from '../puzzle/puzzle-piece-generator.service';

export type GameData =
  | CaseVideData
  | ReponseLibreData
  | LiensData
  | ChronologieData
  | QcmData
  | VraiFauxData
  | MemoryData
  | SimonData
  | ImageInteractiveData
  | PuzzleData;

export interface CreateGameParams {
  gameTypeId: string;
  gameTypeName: string | null;
  subjectId: string;
  categoryId?: string | null;
  instructions?: string | null;
  question?: string | null;
  aides?: string[] | null;
  aideImageFile?: File | null;
  aideImageUrl?: string | null;
  aideVideoUrl?: string | null;
  gameData: GameData | ImageInteractiveDataWithFile | PuzzleDataWithFile;
  imageDataWithFile?: ImageInteractiveDataWithFile | null;
  puzzleDataWithFile?: PuzzleDataWithFile | null;
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
  private readonly aideMediaUploadService = inject(AideMediaUploadService);
  private readonly puzzleStorageService = inject(PuzzleStorageService);
  private readonly puzzlePieceGenerator = inject(PuzzlePieceGeneratorService);
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
   * Vérifie si un type de jeu est un jeu Puzzle
   */
  isPuzzleGame(gameTypeName: string | null): boolean {
    if (!gameTypeName) return false;
    const normalized = gameTypeName.toLowerCase().trim();
    return normalized === 'puzzle';
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
      aideImageFile,
      aideImageUrl,
      aideVideoUrl,
      gameData,
      imageDataWithFile,
      puzzleDataWithFile,
    } = params;

    const isImageInteractive = this.isImageInteractiveGame(gameTypeName);
    const isPuzzle = this.isPuzzleGame(gameTypeName);
    const hasFile = imageDataWithFile?.imageFile !== undefined;
    const hasPuzzleFile = puzzleDataWithFile?.imageFile !== undefined;
    const hasUrl = isImageInteractive && this.hasImageUrl(gameData);
    const hasPuzzleUrl = isPuzzle && this.hasImageUrl(gameData);

    const autoName = this.generateAutoName(gameTypeName, question);
    const filteredAides = aides?.filter((a) => a && a.trim()) || null;

    // Normaliser categoryId : convertir les chaînes vides en null
    const normalizedCategoryId = categoryId && typeof categoryId === 'string' && categoryId.trim() ? categoryId.trim() : null;

    console.log('🔍 GameCreationService - createGameWithImage:', {
      categoryId,
      normalizedCategoryId,
      subjectId,
      willUseCategory: !!normalizedCategoryId
    });

    // Construire les données de base du jeu
    const baseGameData: GameCreate = {
      subject_id: normalizedCategoryId ? null : subjectId,
      subject_category_id: normalizedCategoryId,
      game_type_id: gameTypeId,
      name: autoName,
      instructions: instructions || null,
      question: question?.trim() || null,
      reponses: null,
      aides: filteredAides && filteredAides.length > 0 ? filteredAides : null,
      aide_video_url: aideVideoUrl?.trim() || null,
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

    // Cas 3: Jeu Puzzle avec nouveau fichier à uploader
    if (isPuzzle && hasPuzzleFile && puzzleDataWithFile?.imageFile) {
      return this.createPuzzleGameWithFileUpload(
        baseGameData,
        puzzleDataWithFile,
        gameData as PuzzleData
      );
    }

    // Cas 4: Jeu Puzzle avec image_url existante
    if (isPuzzle && hasPuzzleUrl && !hasPuzzleFile) {
      baseGameData.metadata = gameData as unknown as Record<string, unknown>;
      return this.application.createGame(baseGameData);
    }

    // Cas 5: Jeu normal (pas ImageInteractive/Puzzle ou pas d'image)
    baseGameData.metadata = gameData as unknown as Record<string, unknown>;
    
    // Créer le jeu d'abord, puis uploader l'image d'aide si nécessaire
    return this.application.createGame(baseGameData).pipe(
      switchMap((createdGame) => {
        if (!createdGame) {
          return of(null);
        }

        // Si une image d'aide doit être uploadée
        if (aideImageFile) {
          return this.uploadAideImageAndUpdateGame(createdGame.id, aideImageFile).pipe(
            switchMap(() => of(createdGame)),
            catchError((error) => {
              // Même en cas d'erreur d'upload, retourner le jeu créé
              console.error('Erreur lors de l\'upload de l\'image d\'aide:', error);
              return of(createdGame);
            })
          );
        }

        // Si une URL d'image d'aide existe déjà (mode édition)
        if (aideImageUrl) {
          this.application.updateGame(createdGame.id, {
            aide_image_url: aideImageUrl,
          });
          return of(createdGame);
        }

        return of(createdGame);
      })
    );
  }

  /**
   * Upload une image d'aide et met à jour le jeu
   */
  private uploadAideImageAndUpdateGame(
    gameId: string,
    imageFile: File
  ): Observable<void> {
    return this.aideMediaUploadService.uploadAideImage(imageFile, gameId).pipe(
      switchMap((result) => {
        if (result.error) {
          this.errorSnackbar.showError(
            `Erreur lors de l'upload de l'image d'aide: ${result.error}`
          );
          return of(void 0);
        }

        // Mettre à jour le jeu avec l'URL de l'image d'aide
        this.application.updateGame(gameId, {
          aide_image_url: result.url,
        });
        return of(void 0);
      }),
      catchError(() => {
        this.errorSnackbar.showError('Erreur lors de l\'upload de l\'image d\'aide');
        return of(void 0);
      })
    );
  }

  /**
   * Crée un jeu ImageInteractive avec upload d'image
   */
  private createGameWithFileUpload(
    baseGameData: GameCreate,
    imageDataWithFile: ImageInteractiveDataWithFile,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _gameData: ImageInteractiveData
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
          catchError(() => {
            this.errorSnackbar.showError('Erreur lors de l\'upload de l\'image');
            return of(null);
          })
        );
      }),
      catchError(() => {
        this.errorSnackbar.showError('Erreur lors de la création du jeu');
        return of(null);
      })
    );
  }

  /**
   * Crée un jeu Puzzle avec upload d'image et génération des PNG des pièces
   */
  private createPuzzleGameWithFileUpload(
    baseGameData: GameCreate,
    puzzleDataWithFile: PuzzleDataWithFile,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _gameData: PuzzleData
  ): Observable<Game | null> {
    const file = puzzleDataWithFile.imageFile!;

    // Extraire les données sans le fichier
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { imageFile, oldImageUrl, ...puzzleData } = puzzleDataWithFile;
    const puzzleDataTyped = puzzleData as PuzzleData;

    // Créer le jeu sans image d'abord (les pièces n'ont pas encore d'image_url)
    const gameDataWithoutImage: PuzzleData = {
      image_url: '',
      image_width: 0,
      image_height: 0,
      pieces: puzzleDataTyped.pieces.map(p => ({
        ...p,
        image_url: '', // Sera rempli après génération
      })),
    };

    baseGameData.metadata = gameDataWithoutImage as unknown as Record<string, unknown>;

    return this.application.createGame(baseGameData).pipe(
      switchMap((createdGame) => {
        if (!createdGame) {
          this.errorSnackbar.showError('Erreur lors de la création du jeu');
          return of(null);
        }

        // Uploader l'image originale dans le dossier du jeu créé
        return this.imageUploadService.uploadImage(file, createdGame.id).pipe(
          switchMap((result) => {
            if (result.error) {
              this.errorSnackbar.showError(
                `Erreur lors de l'upload de l'image: ${result.error}`
              );
              return of(null);
            }

            // Générer les PNG des pièces et les uploader
            const pieces = puzzleDataTyped.pieces;
            if (pieces.length === 0) {
              // Pas de pièces, juste mettre à jour avec l'image
              const updatedPuzzleData: PuzzleData = {
                image_url: result.url,
                image_width: result.width,
                image_height: result.height,
                pieces: [],
              };

              this.application.updateGame(createdGame.id, {
                metadata: updatedPuzzleData as unknown as Record<string, unknown>,
              });

              return of(createdGame);
            }

            // Générer et uploader les PNG des pièces en parallèle
            const pieceGenerationPromises = pieces.map(piece =>
              this.puzzlePieceGenerator.generatePiecePNG(
                result.url,
                piece.polygon_points,
                result.width,
                result.height
              ).then(result => ({
                pieceId: piece.id,
                blob: result.blob,
                croppedPolygonPoints: result.croppedPolygonPoints,
              })).catch(error => {
                console.error(`Erreur génération pièce ${piece.id}:`, error);
                return null;
              })
            );

            // Générer les PNG des pièces
            return from(Promise.all(pieceGenerationPromises)).pipe(
              switchMap((results) => {
                const validResults = results.filter((r): r is { pieceId: string; blob: Blob; croppedPolygonPoints: { x: number; y: number }[] } => r !== null);

                if (validResults.length !== pieces.length) {
                  this.errorSnackbar.showError('Erreur lors de la génération de certaines pièces');
                }

                // Uploader les PNG des pièces en parallèle
                const uploadObservables = validResults.map(({ pieceId, blob }) =>
                  this.puzzleStorageService.uploadPiecePNG(pieceId, blob, createdGame.id)
                );

                if (uploadObservables.length === 0) {
                  // Pas de pièces à uploader
                  const updatedPuzzleData: PuzzleData = {
                    image_url: result.url,
                    image_width: result.width,
                    image_height: result.height,
                    pieces: [],
                  };

                  this.application.updateGame(createdGame.id, {
                    metadata: updatedPuzzleData as unknown as Record<string, unknown>,
                  });

                  return of(createdGame);
                }

                return forkJoin(uploadObservables).pipe(
                  switchMap((imageUrls) => {
                    // Mettre à jour les pièces avec les URLs et les nouveaux polygon_points
                    const updatedPieces = pieces.map((piece) => {
                      const resultIndex = validResults.findIndex(r => r.pieceId === piece.id);
                      const generatedResult = resultIndex >= 0 ? validResults[resultIndex] : null;
                      
                      // Recalculer la bounding box AVANT cropping pour obtenir les vraies coordonnées
                      const bbox = this.puzzlePieceGenerator.calculateBoundingBox(
                        piece.polygon_points,
                        result.width,
                        result.height,
                        2
                      );
                      
                      return {
                        ...piece,
                        image_url: resultIndex >= 0 ? imageUrls[resultIndex] : '',
                        polygon_points: generatedResult?.croppedPolygonPoints || piece.polygon_points,
                        original_x: bbox.minX / result.width,
                        original_y: bbox.minY / result.height,
                      };
                    });

                    const updatedPuzzleData: PuzzleData = {
                      image_url: result.url,
                      image_width: result.width,
                      image_height: result.height,
                      pieces: updatedPieces,
                    };

                    this.application.updateGame(createdGame.id, {
                      metadata: updatedPuzzleData as unknown as Record<string, unknown>,
                    });

                    return of(createdGame);
                  }),
                  catchError((error) => {
                    console.error('Erreur upload pièces:', error);
                    this.errorSnackbar.showError('Erreur lors de l\'upload des pièces');
                    return of(null);
                  })
                );
              }),
              catchError((error) => {
                console.error('Erreur génération pièces:', error);
                this.errorSnackbar.showError('Erreur lors de la génération des pièces');
                return of(null);
              })
            );
          }),
          catchError(() => {
            this.errorSnackbar.showError('Erreur lors de l\'upload de l\'image');
            return of(null);
          })
        );
      }),
      catchError(() => {
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

    // Normaliser categoryId : convertir les chaînes vides en null
    const normalizedCategoryId = categoryId && categoryId.trim() ? categoryId.trim() : null;

    const baseGameData: GameCreate = {
      subject_id: normalizedCategoryId ? null : subjectId,
      subject_category_id: normalizedCategoryId,
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
          this.errorSnackbar.showError('Erreur lors de la création du jeu');
          return of(null);
        }

        // Copier l'image
        return this.imageUploadService.copyImageToGame(sourceImageUrl, createdGame.id).pipe(
          switchMap((result) => {
            if (result.error) {
              this.errorSnackbar.showError(
                `Erreur lors de la copie de l'image: ${result.error}`
              );
              return of(null);
            }

            // Mettre à jour le jeu avec l'URL de l'image copiée
            const updatedImageData: ImageInteractiveData = {
              image_url: result.url,
              image_width: result.width,
              image_height: result.height,
              zones: metadataWithoutImage.zones,
              require_all_correct_zones: metadataWithoutImage.require_all_correct_zones,
            };

            this.application.updateGame(createdGame.id, {
              metadata: updatedImageData as unknown as Record<string, unknown>,
            });

            return of(createdGame);
          }),
          catchError(() => {
            this.errorSnackbar.showError('Erreur lors de la copie de l\'image');
            return of(null);
          })
        );
      }),
      catchError(() => {
        this.errorSnackbar.showError('Erreur lors de la création du jeu');
        return of(null);
      })
    );
  }

  /**
   * Génère et upload les pièces d'un puzzle, retourne les données mises à jour
   * @param gameId ID du jeu
   * @param puzzleDataWithFile Données du puzzle avec le fichier image
   * @returns Observable avec les données PuzzleData mises à jour (avec URLs des pièces)
   */
  generateAndUploadPuzzlePieces(
    gameId: string,
    puzzleDataWithFile: PuzzleDataWithFile
  ): Observable<PuzzleData | null> {
    const file = puzzleDataWithFile.imageFile!;
    const oldImageUrl = puzzleDataWithFile.oldImageUrl;

    // Extraire les données sans le fichier
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { imageFile, oldImageUrl: _, ...puzzleData } = puzzleDataWithFile;
    const puzzleDataTyped = puzzleData as PuzzleData;

    // Supprimer l'ancienne image si elle existe
    const deleteOldImage$: Observable<{ success: boolean; error: string | null }> = oldImageUrl
      ? this.imageUploadService.deleteImage(oldImageUrl)
      : of({ success: true, error: null });

    return deleteOldImage$.pipe(
      switchMap(() => {
        // Uploader la nouvelle image
        return this.imageUploadService.uploadImage(file, gameId).pipe(
          switchMap((result) => {
            if (result.error) {
              this.errorSnackbar.showError(
                `Erreur lors de l'upload de l'image: ${result.error}`
              );
              return of(null);
            }

            // Générer les PNG des pièces et les uploader
            const pieces = puzzleDataTyped.pieces;
            if (pieces.length === 0) {
              // Pas de pièces, juste retourner les données avec l'image
              const updatedPuzzleData: PuzzleData = {
                image_url: result.url,
                image_width: result.width,
                image_height: result.height,
                pieces: [],
              };

              return of(updatedPuzzleData);
            }

            // Générer et uploader les PNG des pièces en parallèle
            const pieceGenerationPromises = pieces.map(piece =>
              this.puzzlePieceGenerator.generatePiecePNG(
                result.url,
                piece.polygon_points,
                result.width,
                result.height
              ).then(result => ({
                pieceId: piece.id,
                blob: result.blob,
                croppedPolygonPoints: result.croppedPolygonPoints,
              })).catch(error => {
                console.error(`Erreur génération pièce ${piece.id}:`, error);
                return null;
              })
            );

            // Générer les PNG des pièces
            return from(Promise.all(pieceGenerationPromises)).pipe(
              switchMap((results) => {
                const validResults = results.filter((r): r is { pieceId: string; blob: Blob; croppedPolygonPoints: { x: number; y: number }[] } => r !== null);

                if (validResults.length !== pieces.length) {
                  this.errorSnackbar.showError('Erreur lors de la génération de certaines pièces');
                }

                // Uploader les PNG des pièces en parallèle
                const uploadObservables = validResults.map(({ pieceId, blob }) =>
                  this.puzzleStorageService.uploadPiecePNG(pieceId, blob, gameId)
                );

                if (uploadObservables.length === 0) {
                  // Pas de pièces à uploader
                  const updatedPuzzleData: PuzzleData = {
                    image_url: result.url,
                    image_width: result.width,
                    image_height: result.height,
                    pieces: [],
                  };

                  return of(updatedPuzzleData);
                }

                return forkJoin(uploadObservables).pipe(
                  switchMap((imageUrls) => {
                    // Mettre à jour les pièces avec les URLs et les nouveaux polygon_points
                    const updatedPieces = pieces.map((piece) => {
                      const resultIndex = validResults.findIndex(r => r.pieceId === piece.id);
                      const generatedResult = resultIndex >= 0 ? validResults[resultIndex] : null;
                      
                      // Recalculer la bounding box AVANT cropping pour obtenir les vraies coordonnées
                      const bbox = this.puzzlePieceGenerator.calculateBoundingBox(
                        piece.polygon_points,
                        result.width,
                        result.height,
                        2
                      );
                      
                      return {
                        ...piece,
                        image_url: resultIndex >= 0 ? imageUrls[resultIndex] : '',
                        polygon_points: generatedResult?.croppedPolygonPoints || piece.polygon_points,
                        original_x: bbox.minX / result.width,
                        original_y: bbox.minY / result.height,
                      };
                    });

                    const updatedPuzzleData: PuzzleData = {
                      image_url: result.url,
                      image_width: result.width,
                      image_height: result.height,
                      pieces: updatedPieces,
                    };

                    return of(updatedPuzzleData);
                  }),
                  catchError((error) => {
                    console.error('Erreur upload pièces:', error);
                    this.errorSnackbar.showError('Erreur lors de l\'upload des pièces');
                    return of(null);
                  })
                );
              }),
              catchError((error) => {
                console.error('Erreur génération pièces:', error);
                this.errorSnackbar.showError('Erreur lors de la génération des pièces');
                return of(null);
              })
            );
          }),
          catchError(() => {
            this.errorSnackbar.showError('Erreur lors de l\'upload de l\'image');
            return of(null);
          })
        );
      }),
      catchError(() => {
        this.errorSnackbar.showError('Erreur lors de la suppression de l\'ancienne image');
        return of(null);
      })
    );
  }

  /**
   * Régénère les pièces d'un puzzle depuis l'image existante (quand les URLs des pièces sont vides)
   * @param gameId ID du jeu
   * @param puzzleData Données du puzzle avec l'image_url existante
   * @returns Observable avec les données PuzzleData mises à jour (avec URLs des pièces)
   */
  regeneratePuzzlePiecesFromExistingImage(
    gameId: string,
    puzzleData: PuzzleData
  ): Observable<PuzzleData | null> {
    if (!puzzleData.image_url || puzzleData.pieces.length === 0) {
      return of(puzzleData);
    }

    // Générer et uploader les PNG des pièces en parallèle
    const pieceGenerationPromises = puzzleData.pieces.map(piece =>
      this.puzzlePieceGenerator.generatePiecePNG(
        puzzleData.image_url,
        piece.polygon_points,
        puzzleData.image_width,
        puzzleData.image_height
      ).then(result => ({
        pieceId: piece.id,
        blob: result.blob,
        croppedPolygonPoints: result.croppedPolygonPoints,
      })).catch(error => {
        console.error(`Erreur génération pièce ${piece.id}:`, error);
        return null;
      })
    );

    // Générer les PNG des pièces
    return from(Promise.all(pieceGenerationPromises)).pipe(
      switchMap((results) => {
        const validResults = results.filter((r): r is { pieceId: string; blob: Blob; croppedPolygonPoints: { x: number; y: number }[] } => r !== null);

        if (validResults.length !== puzzleData.pieces.length) {
          this.errorSnackbar.showError('Erreur lors de la génération de certaines pièces');
        }

        if (validResults.length === 0) {
          return of(puzzleData);
        }

        // Supprimer les anciennes pièces avant de les régénérer
        const existingPieces = puzzleData.pieces.filter(p => p.image_url && p.image_url.trim() !== '');
        const deleteObservables = existingPieces.map(piece =>
          this.puzzleStorageService.deletePiecePNG(piece.image_url!).pipe(
            catchError((error) => {
              // Ignorer les erreurs de suppression (fichier peut ne pas exister)
              console.warn(`Impossible de supprimer la pièce ${piece.id}:`, error);
              return of(void 0);
            })
          )
        );

        // Supprimer les anciennes pièces, puis uploader les nouvelles
        const deleteAll$ = deleteObservables.length > 0 
          ? forkJoin(deleteObservables)
          : of([]);

        return deleteAll$.pipe(
          switchMap(() => {

            // Uploader les PNG des pièces en parallèle
            const uploadObservables = validResults.map(({ pieceId, blob }) =>
              this.puzzleStorageService.uploadPiecePNG(pieceId, blob, gameId)
            );

            return forkJoin(uploadObservables).pipe(
              switchMap((imageUrls) => {
                // Mettre à jour les pièces avec les URLs et les nouveaux polygon_points
                const updatedPieces = puzzleData.pieces.map((piece) => {
                  const resultIndex = validResults.findIndex(r => r.pieceId === piece.id);
                  const generatedResult = resultIndex >= 0 ? validResults[resultIndex] : null;
                  
                  // Recalculer la bounding box AVANT cropping pour obtenir les vraies coordonnées
                  const bbox = this.puzzlePieceGenerator.calculateBoundingBox(
                    piece.polygon_points,
                    puzzleData.image_width,
                    puzzleData.image_height,
                    2
                  );
                  
                  return {
                    ...piece,
                    image_url: resultIndex >= 0 ? imageUrls[resultIndex] : piece.image_url || '',
                    polygon_points: generatedResult?.croppedPolygonPoints || piece.polygon_points,
                    original_x: bbox.minX / puzzleData.image_width,
                    original_y: bbox.minY / puzzleData.image_height,
                  };
                });

                const updatedPuzzleData: PuzzleData = {
                  image_url: puzzleData.image_url,
                  image_width: puzzleData.image_width,
                  image_height: puzzleData.image_height,
                  pieces: updatedPieces,
                };

                return of(updatedPuzzleData);
              }),
              catchError((error) => {
                console.error('Erreur upload pièces:', error);
                this.errorSnackbar.showError('Erreur lors de l\'upload des pièces');
                return of(null);
              })
            );
          }),
          catchError((error) => {
            console.error('Erreur lors de la suppression des anciennes pièces:', error);
            // Continuer quand même avec l'upload même si la suppression a échoué
            const uploadObservables = validResults.map(({ pieceId, blob }) =>
              this.puzzleStorageService.uploadPiecePNG(pieceId, blob, gameId)
            );
            return forkJoin(uploadObservables).pipe(
              switchMap((imageUrls) => {
                const updatedPieces = puzzleData.pieces.map((piece) => {
                  const resultIndex = validResults.findIndex(r => r.pieceId === piece.id);
                  const generatedResult = resultIndex >= 0 ? validResults[resultIndex] : null;
                  
                  const bbox = this.puzzlePieceGenerator.calculateBoundingBox(
                    piece.polygon_points,
                    puzzleData.image_width,
                    puzzleData.image_height,
                    2
                  );
                  
                  return {
                    ...piece,
                    image_url: resultIndex >= 0 ? imageUrls[resultIndex] : piece.image_url || '',
                    polygon_points: generatedResult?.croppedPolygonPoints || piece.polygon_points,
                    original_x: bbox.minX / puzzleData.image_width,
                    original_y: bbox.minY / puzzleData.image_height,
                  };
                });

                const updatedPuzzleData: PuzzleData = {
                  image_url: puzzleData.image_url,
                  image_width: puzzleData.image_width,
                  image_height: puzzleData.image_height,
                  pieces: updatedPieces,
                };

                return of(updatedPuzzleData);
              }),
              catchError((uploadError) => {
                console.error('Erreur upload pièces:', uploadError);
                this.errorSnackbar.showError('Erreur lors de l\'upload des pièces');
                return of(null);
              })
            );
          })
        );
      }),
      catchError((error) => {
        console.error('Erreur génération pièces:', error);
        this.errorSnackbar.showError('Erreur lors de la génération des pièces');
        return of(null);
      })
    );
  }
}