import { Component, Input, Output, EventEmitter, signal, computed, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import type { Game, GameUpdate } from '../../../../types/game';
import type { GameType } from '../../../../types/game-type';
import type { CaseVideData, ReponseLibreData, LiensData, ChronologieData, QcmData, VraiFauxData, MemoryData, SimonData, ImageInteractiveData, PuzzleData } from '@shared/games';
import type { GameGlobalFieldsData } from '../game-global-fields/game-global-fields.component';
import { CaseVideFormComponent } from '../case-vide-form/case-vide-form.component';
import { ReponseLibreFormComponent } from '../reponse-libre-form/reponse-libre-form.component';
import { LiensFormComponent } from '../liens-form/liens-form.component';
import { ChronologieFormComponent } from '../chronologie-form/chronologie-form.component';
import { QcmFormComponent } from '../qcm-form/qcm-form.component';
import { VraiFauxFormComponent } from '../vrai-faux-form/vrai-faux-form.component';
import { MemoryFormComponent } from '../memory-form/memory-form.component';
import { SimonFormComponent } from '../simon-form/simon-form.component';
import { ImageInteractiveFormComponent, type ImageInteractiveDataWithFile } from '../image-interactive-form/image-interactive-form.component';
import { PuzzleFormComponent, type PuzzleDataWithFile } from '../puzzle-form/puzzle-form.component';
import { GameGlobalFieldsComponent } from '../game-global-fields/game-global-fields.component';
import { GamePreviewComponent } from '../game-preview/game-preview.component';
import { normalizeGameData } from '../../../../utils/game-data-mapper';
import { ImageUploadService, type ImageUploadResult } from '../../services/image-upload/image-upload.service';
import { ErrorSnackbarService } from '../../../../../../shared';
import { GameCreationService } from '../../../../services/game-creation/game-creation.service';
import { GameTypeStyleService } from '../../../../../../shared/services/game-type-style/game-type-style.service';
import {
  isGameType,
  isGameTypeOneOf,
  isGameTypeConstant,
  GAME_TYPE_QCM,
  GAME_TYPE_MEMORY,
  GAME_TYPE_SIMON,
  GAME_TYPE_CHRONOLOGIE,
  GAME_TYPE_LIENS,
  GAME_TYPE_VRAI_FAUX,
  GAME_TYPE_CASE_VIDE,
  GAME_TYPE_IMAGE_INTERACTIVE,
  GAME_TYPE_PUZZLE,
  GAME_TYPE_REPONSE_LIBRE,
  getGameTypeVariations,
} from '../../../../utils/game-type.util';

@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CaseVideFormComponent,
    ReponseLibreFormComponent,
    LiensFormComponent,
    ChronologieFormComponent,
    QcmFormComponent,
    VraiFauxFormComponent,
    MemoryFormComponent,
    SimonFormComponent,
    ImageInteractiveFormComponent,
    PuzzleFormComponent,
    GameGlobalFieldsComponent,
    GamePreviewComponent,
  ],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
})
export class GameCardComponent implements OnInit, OnChanges {
  private readonly imageUploadService = inject(ImageUploadService);
  private readonly errorSnackbar = inject(ErrorSnackbarService);
  private readonly gameCreationService = inject(GameCreationService);
  private readonly gameTypeStyleService = inject(GameTypeStyleService);
  
  // Exposer les fonctions utilitaires pour le template
  readonly isGameType = isGameType;
  readonly isGameTypeOneOf = isGameTypeOneOf;

  /**
   * Récupère le style (icône et couleur) pour le type de jeu
   */
  getGameTypeStyle() {
    return this.gameTypeStyleService.getGameTypeStyleSync(this.gameTypeName);
  }

  @Input({ required: true }) game!: Game;
  @Input({ required: true }) gameTypeName!: string;
  @Input() gameTypes: GameType[] = []; // Pour déterminer le type de jeu

  @Output() edit = new EventEmitter<Game>();
  @Output() delete = new EventEmitter<string>();
  @Output() update = new EventEmitter<{ gameId: string; updates: GameUpdate }>();
  @Output() duplicate = new EventEmitter<Game>();

  readonly isEditing = signal<boolean>(false); // Mode lecture par défaut
  readonly isExpanded = signal<boolean>(false); // État du toggle (fermé par défaut)
  readonly showAides = signal<boolean>(false); // État pour afficher/masquer les aides

  ngOnInit(): void {
    // Ne pas initialiser le mode édition au démarrage, laisser en mode lecture
  }

  ngOnChanges(changes: SimpleChanges): void {
    // S'assurer que les jeux restent fermés par défaut même si le jeu change
    if (changes['game']) {
      // Réinitialiser à l'état fermé
      this.isEditing.set(false);
      this.isExpanded.set(false);
      this.showAides.set(false); // Réinitialiser le toggle des aides
      // Ne pas initialiser le mode édition automatiquement
    }
  }
  readonly gameSpecificData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | PuzzleData | null>(null);
  readonly gameSpecificValid = signal<boolean>(false);
  readonly initialGameData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | PuzzleData | null>(null);
  
  // Données spécifiques pour le jeu image-interactive avec le fichier File (pour l'upload)
  private imageInteractiveDataWithFile = signal<ImageInteractiveDataWithFile | null>(null);
  private puzzleDataWithFile = signal<PuzzleDataWithFile | null>(null);
  readonly initialGlobalFields = signal<GameGlobalFieldsData | null>(null);
  readonly currentGlobalFields = signal<GameGlobalFieldsData | null>(null);
  readonly previewIsOpen = signal<boolean>(false);

  readonly currentGameTypeName = computed(() => {
    if (this.gameTypes.length > 0) {
      const gameType = this.gameTypes.find(gt => gt.id === this.game.game_type_id);
      return gameType?.name || this.gameTypeName;
    }
    return this.gameTypeName;
  });

  readonly hasChanges = computed(() => {
    // Si on n'est pas en mode édition, pas de changements
    if (!this.isEditing()) return false;

    // Comparer les champs globaux
    const initialGlobal = this.initialGlobalFields();
    const currentGlobal = this.currentGlobalFields();
    
    if (!initialGlobal && !currentGlobal) {
      // Les deux sont null, continuer à vérifier les données spécifiques
    } else if (!initialGlobal || !currentGlobal) {
      // L'un est null et l'autre non, il y a des changements
      return true;
    } else {
      // Les deux existent, comparer
      if (this.normalizeString(initialGlobal.instructions) !== this.normalizeString(currentGlobal.instructions)) return true;
      if (this.normalizeString(initialGlobal.question) !== this.normalizeString(currentGlobal.question)) return true;
      
      // Comparer les aides (arrays)
      const initialAides = (initialGlobal.aides || []).map(a => this.normalizeString(a)).filter(a => a);
      const currentAides = (currentGlobal.aides || []).map(a => this.normalizeString(a)).filter(a => a);
      if (initialAides.length !== currentAides.length) return true;
      if (initialAides.some((aide, idx) => aide !== currentAides[idx])) return true;
    }

    // Comparer les données spécifiques au jeu
    const initialData = this.initialGameData();
    const currentData = this.gameSpecificData();
    
    if (!initialData && !currentData) {
      // Les deux sont null, aucun changement
      return false;
    } else if (!initialData || !currentData) {
      // L'un est null et l'autre non, il y a des changements
      return true;
    } else {
      // Comparaison en profondeur avec JSON.stringify pour simplifier
      try {
        return JSON.stringify(initialData) !== JSON.stringify(currentData);
      } catch {
        // Si la comparaison JSON échoue, considérer qu'il y a des changements
        return true;
      }
    }
  });

  private normalizeString(value: string | null | undefined): string {
    return (value || '').trim();
  }

  toggleExpanded(): void {
    // Si on est en mode édition, sortir du mode édition et refermer
    if (this.isEditing()) {
      this.isEditing.set(false);
      this.isExpanded.set(false);
    } else {
      // Sinon, passer en mode édition pour voir tout le jeu complet
      this.initializeEditMode();
      this.isExpanded.set(true);
    }
  }

  toggleEdit(): void {
    if (!this.isEditing()) {
      // Entrer en mode édition
      this.initializeEditMode();
      this.isExpanded.set(true); // Ouvrir le toggle lors de l'édition
    } else {
      // Sortir du mode édition
      this.isEditing.set(false);
    }
  }

  toggleAides(): void {
    this.showAides.update(v => !v);
  }

  private initializeEditMode(): void {
    this.isEditing.set(true);
    
    // Charger les champs globaux
    const globalFields = {
      instructions: this.game.instructions || null,
      question: this.game.question || null,
      aides: this.game.aides || null,
      aideImageUrl: this.game.aide_image_url || null,
      aideVideoUrl: this.game.aide_video_url || null,
    };
    this.initialGlobalFields.set(globalFields);
    this.currentGlobalFields.set(globalFields); // Initialiser aussi currentGlobalFields

    // Charger les données spécifiques depuis metadata et normaliser si nécessaire
    if (this.game.metadata) {
      const normalizedMetadata = normalizeGameData(
        this.currentGameTypeName(),
        this.game.metadata as Record<string, unknown>
      );
      const gameData = normalizedMetadata as unknown as CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | PuzzleData;
      this.initialGameData.set(gameData);
      this.gameSpecificData.set(gameData); // Initialiser aussi gameSpecificData
      this.gameSpecificValid.set(true); // Considérer comme valide si les données existent
    }
  }

  onGlobalFieldsChange(data: GameGlobalFieldsData): void {
    this.currentGlobalFields.set(data);
  }

  onGlobalFieldsValidityChange(): void {
    // La validité est toujours vraie pour les champs globaux (optionnels)
  }

  onGameDataChange(data: CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | ImageInteractiveDataWithFile | PuzzleData | PuzzleDataWithFile): void {
    // Si c'est ImageInteractiveDataWithFile, stocker séparément pour gérer l'upload
    if (('imageFile' in data || 'oldImageUrl' in data) && ('zones' in data)) {
      this.imageInteractiveDataWithFile.set(data as ImageInteractiveDataWithFile);
      this.puzzleDataWithFile.set(null);
      // Stocker aussi les données sans le fichier pour la compatibilité
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { imageFile, oldImageUrl, ...dataWithoutFile } = data as ImageInteractiveDataWithFile;
      this.gameSpecificData.set(dataWithoutFile as ImageInteractiveData);
    } else if (('imageFile' in data || 'oldImageUrl' in data) && ('pieces' in data)) {
      // Si c'est PuzzleDataWithFile, stocker séparément pour gérer l'upload
      this.puzzleDataWithFile.set(data as PuzzleDataWithFile);
      this.imageInteractiveDataWithFile.set(null);
      // Stocker aussi les données sans le fichier pour la compatibilité
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { imageFile, oldImageUrl, ...dataWithoutFile } = data as PuzzleDataWithFile;
      this.gameSpecificData.set(dataWithoutFile as PuzzleData);
    } else {
      // Autres types de jeux
      const gameData: CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | PuzzleData | null = data as Exclude<typeof data, ImageInteractiveDataWithFile | PuzzleDataWithFile>;
      this.gameSpecificData.set(gameData);
      this.imageInteractiveDataWithFile.set(null);
      this.puzzleDataWithFile.set(null);
    }
  }

  onGameValidityChange(valid: boolean): void {
    this.gameSpecificValid.set(valid);
  }

  saveEdit(): void {
    if (!this.gameSpecificValid()) return;
    
    const globalFields = this.currentGlobalFields() || this.initialGlobalFields();
    let gameData = this.gameSpecificData();
    if (!globalFields || !gameData) return;

    // Vérifier si on a un fichier image à uploader (pour ImageInteractive)
    const imageDataWithFile = this.imageInteractiveDataWithFile();
    const isImageInteractive = isGameTypeOneOf(this.currentGameTypeName(), 'click', 'image interactive');

    // Vérifier si on a un fichier image à uploader (pour Puzzle)
    const puzzleDataWithFile = this.puzzleDataWithFile();
    const isPuzzle = isGameTypeOneOf(this.currentGameTypeName(), ...getGameTypeVariations(GAME_TYPE_PUZZLE));

    if (isImageInteractive && imageDataWithFile?.imageFile) {
      // Uploader l'image avant de sauvegarder
      const file = imageDataWithFile.imageFile;
      const oldImageUrl = imageDataWithFile.oldImageUrl;

      // Supprimer l'ancienne image si elle existe, puis uploader la nouvelle
      const deleteOldImage$: Observable<{ success: boolean; error: string | null }> = oldImageUrl 
        ? this.imageUploadService.deleteImage(oldImageUrl)
        : of({ success: true, error: null });

      deleteOldImage$.pipe(
        switchMap(() => this.imageUploadService.uploadImage(file, this.game.id))
      ).subscribe({
        next: (result) => {
          if (result.error) {
            console.error('Erreur upload:', result.error);
            this.errorSnackbar.showError(`Erreur lors de l'upload de l'image: ${result.error}`);
            return;
          }

          // Mettre à jour les données avec la nouvelle URL en copiant toutes les propriétés
          const updatedImageData: ImageInteractiveData = {
            image_url: result.url,
            image_width: result.width,
            image_height: result.height,
            zones: imageDataWithFile.zones,
            require_all_correct_zones: imageDataWithFile.require_all_correct_zones,
          };

          // Sauvegarder le jeu avec la nouvelle URL
          this.saveGameWithData(globalFields, updatedImageData);
        },
        error: (error) => {
          console.error('Erreur upload:', error);
          this.errorSnackbar.showError('Erreur lors de l\'upload de l\'image');
        }
      });
    } else if (isPuzzle && puzzleDataWithFile?.imageFile) {
      // Générer et uploader les pièces du puzzle avec nouveau fichier
      this.gameCreationService.generateAndUploadPuzzlePieces(this.game.id, puzzleDataWithFile).subscribe({
        next: (updatedPuzzleData) => {
          if (!updatedPuzzleData) {
            console.error('Erreur lors de la génération des pièces');
            this.errorSnackbar.showError('Erreur lors de la génération des pièces');
            return;
          }

          // Sauvegarder le jeu avec les pièces générées
          this.saveGameWithData(globalFields, updatedPuzzleData);
        },
        error: (error) => {
          console.error('Erreur génération pièces:', error);
          this.errorSnackbar.showError('Erreur lors de la génération des pièces');
        }
      });
    } else if (isPuzzle && gameData && 'pieces' in gameData) {
      // Puzzle sans nouveau fichier : vérifier si les pièces ont des URLs
      const puzzleData = gameData as PuzzleData;
      const hasEmptyUrls = puzzleData.pieces.some(piece => !piece.image_url || piece.image_url === '');
      
      if (hasEmptyUrls && puzzleData.image_url) {
        // Régénérer les pièces depuis l'image existante
        this.gameCreationService.regeneratePuzzlePiecesFromExistingImage(this.game.id, puzzleData).subscribe({
          next: (updatedPuzzleData) => {
            if (!updatedPuzzleData) {
              console.error('Erreur lors de la régénération des pièces');
              this.errorSnackbar.showError('Erreur lors de la régénération des pièces');
              return;
            }

            // Sauvegarder le jeu avec les pièces régénérées
            this.saveGameWithData(globalFields, updatedPuzzleData);
          },
          error: (error) => {
            console.error('Erreur régénération pièces:', error);
            this.errorSnackbar.showError('Erreur lors de la régénération des pièces');
          }
        });
      } else {
        // Pas de nouveau fichier et URLs déjà présentes, sauvegarder directement
        this.saveGameWithData(globalFields, gameData);
      }
    } else {
      // Pas de nouveau fichier, sauvegarder directement
      this.saveGameWithData(globalFields, gameData);
    }
  }

  private saveGameWithData(
    globalFields: GameGlobalFieldsData,
    gameData: CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | PuzzleData
  ): void {
    // Générer un nom automatique
    const gameTypeName = this.currentGameTypeName();
    const questionPreview = globalFields.question?.trim() ? globalFields.question.trim().substring(0, 30) : '';
    const autoName = questionPreview ? `${gameTypeName} - ${questionPreview}${questionPreview.length >= 30 ? '...' : ''}` : gameTypeName;

    // Construire les aides
    const aides = globalFields.aides && globalFields.aides.length > 0 
      ? globalFields.aides.filter(a => a && a.trim())
      : null;

    const updates: GameUpdate = {
      name: autoName,
      instructions: globalFields.instructions || null,
      question: globalFields.question?.trim() || null,
      reponses: null,
      aides: aides,
      aide_image_url: globalFields.aideImageUrl || null,
      aide_video_url: globalFields.aideVideoUrl || null,
      metadata: gameData as unknown as Record<string, unknown>,
    };

    this.update.emit({
      gameId: this.game.id,
      updates
    });

    this.isEditing.set(false);
    // Réinitialiser les données avec fichier après sauvegarde
    this.imageInteractiveDataWithFile.set(null);
    this.puzzleDataWithFile.set(null);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
    this.gameSpecificData.set(null);
    this.gameSpecificValid.set(false);
    this.initialGameData.set(null);
    this.initialGlobalFields.set(null);
  }

  onDeleteClick(): void {
    this.delete.emit(this.game.id);
  }

  onDuplicateClick(): void {
    this.duplicate.emit(this.game);
  }

  openPreview(): void {
    // S'assurer que les données sont initialisées avant d'ouvrir la preview
    if (!this.isEditing()) {
      this.initializeEditMode();
    }
    // S'assurer que les données sont disponibles
    if (!this.gameSpecificData() && this.game.metadata) {
      const normalizedMetadata = normalizeGameData(
        this.currentGameTypeName(),
        this.game.metadata as Record<string, unknown>
      );
      const gameData = normalizedMetadata as unknown as CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | PuzzleData;
      this.gameSpecificData.set(gameData);
    }
    if (!this.currentGlobalFields()) {
      const globalFields = {
        instructions: this.game.instructions || null,
        question: this.game.question || null,
        aides: this.game.aides || null,
        aideImageUrl: this.game.aide_image_url || null,
        aideVideoUrl: this.game.aide_video_url || null,
      };
      this.currentGlobalFields.set(globalFields);
    }
    this.previewIsOpen.set(true);
  }

  closePreview(): void {
    this.previewIsOpen.set(false);
  }

  getInitialDataForCaseVide(): CaseVideData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (isGameTypeConstant(currentType, GAME_TYPE_CASE_VIDE) && data) {
      // Accepter le nouveau format (texte + cases_vides) ou l'ancien format (debut_phrase)
      if (('texte' in data && 'cases_vides' in data) || 'debut_phrase' in data) {
        return data as CaseVideData;
      }
    }
    return null;
  }

  getInitialDataForReponseLibre(): ReponseLibreData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (isGameTypeConstant(currentType, GAME_TYPE_REPONSE_LIBRE) && data && 'reponse_valide' in data && !('debut_phrase' in data)) {
      return data as ReponseLibreData;
    }
    return null;
  }

  getInitialDataForLiens(): LiensData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (isGameTypeConstant(currentType, GAME_TYPE_LIENS) && data && 'mots' in data && 'reponses' in data && 'liens' in data) {
      return data as LiensData;
    }
    return null;
  }

  getInitialDataForChronologie(): ChronologieData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (isGameTypeConstant(currentType, GAME_TYPE_CHRONOLOGIE) && data && 'mots' in data && 'ordre_correct' in data && !('reponses' in data)) {
      return data as ChronologieData;
    }
    return null;
  }

  getInitialDataForQcm(): QcmData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (isGameTypeConstant(currentType, GAME_TYPE_QCM) && data && 'propositions' in data && 'reponses_valides' in data) {
      return data as QcmData;
    }
    return null;
  }

  getInitialDataForVraiFaux(): VraiFauxData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (isGameTypeConstant(currentType, GAME_TYPE_VRAI_FAUX) && data && 'enonces' in data) {
      return data as VraiFauxData;
    }
    return null;
  }

  getInitialDataForMemory(): MemoryData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (isGameTypeConstant(currentType, GAME_TYPE_MEMORY) && data && 'paires' in data) {
      return data as MemoryData;
    }
    return null;
  }

  getInitialDataForSimon(): SimonData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (isGameTypeConstant(currentType, GAME_TYPE_SIMON) && data) {
      // Vérifier que les propriétés requises existent
      if ('nombre_elements' in data && 'type_elements' in data) {
        return data as SimonData;
      }
    }
    return null;
  }

  getInitialDataForImageInteractive(): ImageInteractiveData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (currentType && isGameTypeOneOf(currentType, 'click', 'image interactive') && data) {
      // Vérifier que les propriétés requises existent
      if (
        'image_url' in data && 
        'image_width' in data && 
        'image_height' in data && 
        'zones' in data &&
        typeof data.image_url === 'string' &&
        typeof data.image_width === 'number' &&
        typeof data.image_height === 'number' &&
        Array.isArray(data.zones)
      ) {
        return data as ImageInteractiveData;
      }
    }
    return null;
  }

  getInitialDataForPuzzle(): PuzzleData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    
    if (currentType && isGameType(currentType, 'puzzle') && data) {
      if (
        'image_url' in data && 
        'image_width' in data && 
        'image_height' in data &&
        'pieces' in data &&
        typeof data.image_url === 'string' &&
        typeof data.image_width === 'number' &&
        typeof data.image_height === 'number' &&
        Array.isArray(data.pieces)
      ) {
        return data as PuzzleData;
      }
    }
    return null;
  }

  formatMetadataForDisplay(): string {
    const typeName = this.currentGameTypeName().toLowerCase();
    const metadata = this.game.metadata;

    if (!metadata) return 'Pas de métadonnées';

    try {
      // Utiliser les fonctions de comparaison normalisées
      if (isGameTypeConstant(typeName, GAME_TYPE_QCM)) {
        const qcm = metadata as unknown as QcmData;
        return `${qcm.propositions?.length || 0} propositions, ${qcm.reponses_valides?.length || 0} bonne(s) réponse(s)`;
      }
      
      if (isGameTypeConstant(typeName, GAME_TYPE_CASE_VIDE)) {
        const caseVide = metadata as unknown as CaseVideData;
        return `"${caseVide.debut_phrase || ''} ___ ${caseVide.fin_phrase || ''}"`;
      }
      
      if (isGameTypeConstant(typeName, GAME_TYPE_REPONSE_LIBRE)) {
        const reponseLibre = metadata as unknown as ReponseLibreData;
        return `Réponse attendue: "${reponseLibre.reponse_valide || 'N/A'}"`;
      }
      
      if (isGameTypeConstant(typeName, GAME_TYPE_LIENS)) {
        const liens = metadata as unknown as LiensData;
        return `${liens.mots?.length || 0} mots à relier`;
      }
      
      if (isGameTypeConstant(typeName, GAME_TYPE_CHRONOLOGIE)) {
        const chronologie = metadata as unknown as ChronologieData;
        return `${chronologie.mots?.length || 0} éléments à ordonner`;
      }
      
      if (isGameTypeConstant(typeName, GAME_TYPE_VRAI_FAUX)) {
        const vraiFaux = metadata as unknown as VraiFauxData;
        return `${vraiFaux.enonces?.length || 0} énoncé(s)`;
      }
      
      if (isGameTypeConstant(typeName, GAME_TYPE_MEMORY)) {
        const memory = metadata as unknown as MemoryData;
        return `${memory.paires?.length || 0} paire(s) de cartes`;
      }
      
      if (isGameTypeConstant(typeName, GAME_TYPE_SIMON)) {
        const simon = metadata as unknown as SimonData;
        return `${simon.nombre_elements || 0} élément(s), type: ${simon.type_elements || 'N/A'}`;
      }
      
      if (isGameTypeConstant(typeName, GAME_TYPE_IMAGE_INTERACTIVE)) {
        const click = metadata as unknown as ImageInteractiveData;
        return `Image ${click.image_width || 0}×${click.image_height || 0}px, ${click.zones?.length || 0} zone(s) cliquable(s)`;
      }
      
      if (isGameTypeConstant(typeName, GAME_TYPE_PUZZLE)) {
        const puzzle = metadata as unknown as PuzzleData;
        return `Image ${puzzle.image_width || 0}×${puzzle.image_height || 0}px, ${puzzle.pieces?.length || 0} pièce(s)`;
      }
      
      return JSON.stringify(metadata).substring(0, 100);
    } catch {
      return JSON.stringify(metadata).substring(0, 100);
    }
  }
}

