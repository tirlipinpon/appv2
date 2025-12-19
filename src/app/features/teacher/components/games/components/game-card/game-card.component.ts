import { Component, Input, Output, EventEmitter, signal, computed, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import type { Game, GameUpdate } from '../../../../types/game';
import type { GameType } from '../../../../types/game-type';
import type { CaseVideData, ReponseLibreData, LiensData, ChronologieData, QcmData } from '../../../../types/game-data';
import type { GameGlobalFieldsData } from '../game-global-fields/game-global-fields.component';
import { CaseVideFormComponent } from '../case-vide-form/case-vide-form.component';
import { ReponseLibreFormComponent } from '../reponse-libre-form/reponse-libre-form.component';
import { LiensFormComponent } from '../liens-form/liens-form.component';
import { ChronologieFormComponent } from '../chronologie-form/chronologie-form.component';
import { QcmFormComponent } from '../qcm-form/qcm-form.component';
import { GameGlobalFieldsComponent } from '../game-global-fields/game-global-fields.component';
import { GamePreviewComponent } from '../game-preview/game-preview.component';
import { normalizeGameData } from '../../../../utils/game-data-mapper';

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
    GameGlobalFieldsComponent,
    GamePreviewComponent,
  ],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
})
export class GameCardComponent implements OnInit, OnChanges {
  @Input({ required: true }) game!: Game;
  @Input({ required: true }) gameTypeName!: string;
  @Input() gameTypes: GameType[] = []; // Pour déterminer le type de jeu

  @Output() edit = new EventEmitter<Game>();
  @Output() delete = new EventEmitter<string>();
  @Output() update = new EventEmitter<{ gameId: string; updates: GameUpdate }>();

  readonly isEditing = signal<boolean>(true); // Mode édition par défaut

  ngOnInit(): void {
    // Initialiser le mode édition au démarrage
    this.initializeEditMode();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Réinitialiser le mode édition si le jeu change
    if (changes['game'] && !changes['game'].firstChange) {
      this.initializeEditMode();
    }
  }
  readonly gameSpecificData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | null>(null);
  readonly gameSpecificValid = signal<boolean>(false);
  readonly initialGameData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | null>(null);
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

  toggleEdit(): void {
    if (!this.isEditing()) {
      // Entrer en mode édition
      this.initializeEditMode();
    } else {
      // Sortir du mode édition
      this.isEditing.set(false);
    }
  }

  private initializeEditMode(): void {
    this.isEditing.set(true);
    
    // Charger les champs globaux
    const globalFields = {
      instructions: this.game.instructions || null,
      question: this.game.question || null,
      aides: this.game.aides || null,
    };
    this.initialGlobalFields.set(globalFields);
    this.currentGlobalFields.set(globalFields); // Initialiser aussi currentGlobalFields

    // Charger les données spécifiques depuis metadata et normaliser si nécessaire
    if (this.game.metadata) {
      const normalizedMetadata = normalizeGameData(
        this.currentGameTypeName(),
        this.game.metadata as Record<string, unknown>
      );
      const gameData = normalizedMetadata as unknown as CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData;
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

  onGameDataChange(data: CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData): void {
    this.gameSpecificData.set(data);
  }

  onGameValidityChange(valid: boolean): void {
    this.gameSpecificValid.set(valid);
  }

  saveEdit(): void {
    if (!this.gameSpecificValid()) return;
    
    const globalFields = this.currentGlobalFields() || this.initialGlobalFields();
    const gameData = this.gameSpecificData();
    if (!globalFields || !gameData) return;

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
      metadata: gameData as unknown as Record<string, unknown>,
    };

    this.update.emit({
      gameId: this.game.id,
      updates
    });

    this.isEditing.set(false);
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

  openPreview(): void {
    this.previewIsOpen.set(true);
  }

  closePreview(): void {
    this.previewIsOpen.set(false);
  }

  getInitialDataForCaseVide(): CaseVideData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (currentType.toLowerCase() === 'case vide' && data && 'debut_phrase' in data) {
      return data as CaseVideData;
    }
    return null;
  }

  getInitialDataForReponseLibre(): ReponseLibreData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (currentType.toLowerCase() === 'reponse libre' && data && 'reponse_valide' in data && !('debut_phrase' in data)) {
      return data as ReponseLibreData;
    }
    return null;
  }

  getInitialDataForLiens(): LiensData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (currentType.toLowerCase() === 'liens' && data && 'mots' in data && 'reponses' in data && 'liens' in data) {
      return data as LiensData;
    }
    return null;
  }

  getInitialDataForChronologie(): ChronologieData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (currentType.toLowerCase() === 'chronologie' && data && 'mots' in data && 'ordre_correct' in data && !('reponses' in data)) {
      return data as ChronologieData;
    }
    return null;
  }

  getInitialDataForQcm(): QcmData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (currentType.toLowerCase() === 'qcm' && data && 'propositions' in data && 'reponses_valides' in data) {
      return data as QcmData;
    }
    return null;
  }

  formatMetadataForDisplay(): string {
    const typeName = this.currentGameTypeName().toLowerCase();
    const metadata = this.game.metadata;

    if (!metadata) return 'Pas de métadonnées';

    try {
      switch (typeName) {
        case 'qcm':
          const qcm = metadata as unknown as QcmData;
          return `${qcm.propositions?.length || 0} propositions, ${qcm.reponses_valides?.length || 0} bonne(s) réponse(s)`;
        
        case 'case vide':
          const caseVide = metadata as unknown as CaseVideData;
          return `"${caseVide.debut_phrase || ''} ___ ${caseVide.fin_phrase || ''}"`;
        
        case 'reponse libre':
          const reponseLibre = metadata as unknown as ReponseLibreData;
          return `Réponse attendue: "${reponseLibre.reponse_valide || 'N/A'}"`;
        
        case 'liens':
          const liens = metadata as unknown as LiensData;
          return `${liens.mots?.length || 0} mots à relier`;
        
        case 'chronologie':
          const chronologie = metadata as unknown as ChronologieData;
          return `${chronologie.mots?.length || 0} éléments à ordonner`;
        
        default:
          return JSON.stringify(metadata).substring(0, 100);
      }
    } catch (error) {
      return JSON.stringify(metadata).substring(0, 100);
    }
  }
}

