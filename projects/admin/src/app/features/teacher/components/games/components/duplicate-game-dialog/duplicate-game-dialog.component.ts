import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, computed, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import type { Game } from '../../../../types/game';
import type { GameType } from '../../../../types/game-type';
import type { TeacherAssignment } from '../../../../types/teacher-assignment';
import type { School } from '../../../../types/school';
import type { Subject } from '../../../../types/subject';
import type { SubjectCategory } from '../../../../types/subject';
import type { CaseVideData, ReponseLibreData, LiensData, ChronologieData, QcmData, VraiFauxData, MemoryData, SimonData } from '@shared/games';
import { Infrastructure } from '../../../../components/infrastructure/infrastructure';
import { GameGlobalFieldsComponent, type GameGlobalFieldsData } from '../game-global-fields/game-global-fields.component';
import { CaseVideFormComponent } from '../case-vide-form/case-vide-form.component';
import { ReponseLibreFormComponent } from '../reponse-libre-form/reponse-libre-form.component';
import { LiensFormComponent } from '../liens-form/liens-form.component';
import { ChronologieFormComponent } from '../chronologie-form/chronologie-form.component';
import { QcmFormComponent } from '../qcm-form/qcm-form.component';
import { VraiFauxFormComponent } from '../vrai-faux-form/vrai-faux-form.component';
import { MemoryFormComponent } from '../memory-form/memory-form.component';
import { SimonFormComponent } from '../simon-form/simon-form.component';
import { SCHOOL_LEVELS, getSchoolLevelLabel } from '../../../../utils/school-levels.util';
import { normalizeGameData } from '../../../../utils/game-data-mapper';
import { GameDataInitializerService } from '../../../../services/game-data-initializer/game-data-initializer.service';
import { AssignmentFilterService } from '../../../../services/assignment-filter/assignment-filter.service';
import { isGameType } from '../../../../utils/game-type.util';

export interface DuplicateGameData {
  schoolId: string | null;
  level: string | null;
  subjectId: string;
  subjectCategoryId: string | null;
  gameData: {
    instructions: string | null;
    question: string | null;
    aides: string[] | null;
    metadata: Record<string, unknown> | null;
    aideImageFile?: File | null;
    aideImageUrl?: string | null;
    aideVideoUrl?: string | null;
  };
}

@Component({
  selector: 'app-duplicate-game-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    GameGlobalFieldsComponent,
    CaseVideFormComponent,
    ReponseLibreFormComponent,
    LiensFormComponent,
    ChronologieFormComponent,
    QcmFormComponent,
    VraiFauxFormComponent,
    MemoryFormComponent,
    SimonFormComponent,
  ],
  templateUrl: './duplicate-game-dialog.component.html',
  styleUrls: ['./duplicate-game-dialog.component.scss'],
})
export class DuplicateGameDialogComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly infrastructure = inject(Infrastructure);
  private readonly gameDataInitializer = inject(GameDataInitializerService);
  private readonly assignmentFilter = inject(AssignmentFilterService);
  
  // Exposer la fonction utilitaire pour le template
  readonly isGameType = isGameType;

  @Input({ required: true }) game!: Game;
  @Input({ required: true }) currentAssignment!: TeacherAssignment | null;
  @Input({ required: true }) availableSchools: School[] = [];
  @Input({ required: true }) availableAssignments: TeacherAssignment[] = [];
  @Input({ required: true }) availableSubjects: Subject[] = [];
  @Input({ required: true }) gameTypes: GameType[] = [];
  @Input({ required: true }) gameTypeName!: string;

  @Output() confirm = new EventEmitter<DuplicateGameData>();
  @Output() cancel = new EventEmitter<void>();

  duplicateForm: FormGroup;
  readonly globalFieldsData = signal<GameGlobalFieldsData | null>(null);
  readonly selectedSchoolId = signal<string | null>(null);
  readonly selectedLevel = signal<string | null>(null);
  readonly selectedSubjectId = signal<string | null>(null);
  readonly categories = signal<SubjectCategory[]>([]);
  readonly gameSpecificData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | null>(null);
  readonly gameSpecificValid = signal<boolean>(false);
  readonly initialGameData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | null>(null);
  readonly isProcessing = signal<boolean>(false);

  readonly currentGameTypeName = computed(() => {
    if (this.gameTypes.length > 0) {
      const gameType = this.gameTypes.find(gt => gt.id === this.game.game_type_id);
      return gameType?.name || this.gameTypeName;
    }
    return this.gameTypeName;
  });

  // Computed pour les niveaux disponibles selon l'école sélectionnée
  readonly availableLevels = computed(() => {
    return this.assignmentFilter.getAvailableLevels(
      this.availableAssignments,
      this.selectedSchoolId()
    );
  });

  // Computed pour les matières disponibles selon l'école et le niveau
  readonly availableSubjectsForSelection = computed(() => {
    return this.assignmentFilter.getAvailableSubjects(
      this.availableAssignments,
      this.availableSubjects,
      this.selectedSchoolId(),
      this.selectedLevel()
    );
  });

  // Computed pour vérifier si le formulaire est valide
  readonly isFormValid = computed(() => {
    return this.duplicateForm.valid && this.globalFieldsData() !== null && this.gameSpecificValid();
  });

  constructor() {
    this.duplicateForm = this.fb.group({
      schoolId: ['', Validators.required],
      level: ['', Validators.required],
      subjectId: ['', Validators.required],
      subjectCategoryId: [''], // Optionnel
    });

    // Réinitialiser le niveau quand l'école change
    this.duplicateForm.get('schoolId')?.valueChanges.subscribe((value) => {
      this.selectedSchoolId.set(value || null);
      this.duplicateForm.patchValue({ level: '', subjectId: '', subjectCategoryId: '' }, { emitEvent: false });
      this.selectedLevel.set(null);
      this.selectedSubjectId.set(null);
      this.categories.set([]);
    });

    // Réinitialiser la matière quand le niveau change
    this.duplicateForm.get('level')?.valueChanges.subscribe((value) => {
      this.selectedLevel.set(value || null);
      this.duplicateForm.patchValue({ subjectId: '', subjectCategoryId: '' }, { emitEvent: false });
      this.selectedSubjectId.set(null);
      this.categories.set([]);
    });

    // Charger les sous-catégories quand la matière change
    this.duplicateForm.get('subjectId')?.valueChanges.subscribe((value) => {
      this.selectedSubjectId.set(value || null);
      this.duplicateForm.patchValue({ subjectCategoryId: '' }, { emitEvent: false });
      if (value) {
        this.loadCategories(value);
      } else {
        this.categories.set([]);
      }
    });

    // Gérer l'état disabled du contrôle subjectCategoryId selon les catégories disponibles
    effect(() => {
      const cats = this.categories();
      const control = this.duplicateForm.get('subjectCategoryId');
      if (cats.length === 0) {
        control?.disable();
      } else {
        control?.enable();
      }
    });
  }

  private loadCategories(subjectId: string): void {
    this.infrastructure.getCategoriesBySubject(subjectId).subscribe(({ categories, error }) => {
      if (error) {
        console.error('[DuplicateGameDialog] Erreur lors du chargement des sous-catégories:', error);
        this.categories.set([]);
        return;
      }
      this.categories.set(categories || []);
    });
  }

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['game'] || changes['currentAssignment']) {
      this.initializeForm();
    }
  }

  private initializeForm(): void {
    if (!this.game) return;
    
    // Réinitialiser le flag de traitement
    this.isProcessing.set(false);

    // Si currentAssignment est disponible, l'utiliser pour pré-remplir
    // Sinon, laisser les champs vides pour que l'utilisateur les remplisse
    const schoolId = this.currentAssignment?.school_id || '';
    const level = this.currentAssignment?.school_level || '';

    // Si le jeu est lié à une sous-catégorie, utiliser le subject_id de l'assignment
    // Sinon, utiliser le subject_id du jeu
    const subjectId = this.game.subject_id || this.currentAssignment?.subject_id || '';

    // Pré-remplir avec les valeurs courantes si disponibles
    this.duplicateForm.patchValue({
      schoolId: schoolId,
      level: level,
      subjectId: subjectId,
      subjectCategoryId: this.game.subject_category_id || '',
    });

    // Initialiser les signals pour la réactivité
    this.selectedSchoolId.set(schoolId || null);
    this.selectedLevel.set(level || null);
    this.selectedSubjectId.set(subjectId || null);
    
    // Charger les sous-catégories si une matière est sélectionnée
    if (subjectId) {
      this.loadCategories(subjectId);
    }

    // Initialiser les champs globaux
    this.globalFieldsData.set({
      instructions: this.game.instructions || null,
      question: this.game.question || null,
      aides: this.game.aides || null,
      aideImageUrl: this.game.aide_image_url || null,
      aideVideoUrl: this.game.aide_video_url || null,
    });

    // Charger les données spécifiques depuis metadata et normaliser si nécessaire
    if (this.game.metadata) {
      const normalizedMetadata = normalizeGameData(
        this.currentGameTypeName(),
        this.game.metadata as Record<string, unknown>
      );
      const gameData = normalizedMetadata as unknown as CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData;
      this.initialGameData.set(gameData);
      this.gameSpecificData.set(gameData);
      this.gameSpecificValid.set(true);
    } else {
      this.initialGameData.set(null);
      this.gameSpecificData.set(null);
      this.gameSpecificValid.set(false);
    }
  }

  onGlobalFieldsChange(data: GameGlobalFieldsData): void {
    this.globalFieldsData.set(data);
  }

  onGameDataChange(data: CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData): void {
    this.gameSpecificData.set(data);
  }

  onGameValidityChange(valid: boolean): void {
    this.gameSpecificValid.set(valid);
  }

  onConfirm(): void {
    if (!this.isFormValid() || this.isProcessing()) return;

    this.isProcessing.set(true);

    const formValue = this.duplicateForm.value;
    const globalFields = this.globalFieldsData();
    const gameData = this.gameSpecificData();

    this.confirm.emit({
      schoolId: formValue.schoolId || null,
      level: formValue.level || null,
      subjectId: formValue.subjectId,
      subjectCategoryId: formValue.subjectCategoryId || null,
      gameData: {
        instructions: globalFields?.instructions || null,
        question: globalFields?.question || null,
        aides: globalFields?.aides || null,
        metadata: gameData ? (gameData as unknown as Record<string, unknown>) : null,
        aideImageFile: globalFields?.aideImageFile || null,
        aideImageUrl: globalFields?.aideImageUrl || null,
        aideVideoUrl: globalFields?.aideVideoUrl || null,
      },
    });
  }

  // Méthodes pour obtenir les données initiales selon le type de jeu
  getInitialDataForCaseVide(): CaseVideData | null {
    return this.gameDataInitializer.getInitialData(
      this.currentGameTypeName(),
      this.initialGameData()
    ) as CaseVideData | null;
  }

  getInitialDataForReponseLibre(): ReponseLibreData | null {
    return this.gameDataInitializer.getInitialData(
      this.currentGameTypeName(),
      this.initialGameData()
    ) as ReponseLibreData | null;
  }

  getInitialDataForLiens(): LiensData | null {
    return this.gameDataInitializer.getInitialData(
      this.currentGameTypeName(),
      this.initialGameData()
    ) as LiensData | null;
  }

  getInitialDataForChronologie(): ChronologieData | null {
    return this.gameDataInitializer.getInitialData(
      this.currentGameTypeName(),
      this.initialGameData()
    ) as ChronologieData | null;
  }

  getInitialDataForQcm(): QcmData | null {
    return this.gameDataInitializer.getInitialData(
      this.currentGameTypeName(),
      this.initialGameData()
    ) as QcmData | null;
  }

  getInitialDataForVraiFaux(): VraiFauxData | null {
    return this.gameDataInitializer.getInitialData(
      this.currentGameTypeName(),
      this.initialGameData()
    ) as VraiFauxData | null;
  }

  getInitialDataForMemory(): MemoryData | null {
    return this.gameDataInitializer.getInitialData(
      this.currentGameTypeName(),
      this.initialGameData()
    ) as MemoryData | null;
  }

  getInitialDataForSimon(): SimonData | null {
    return this.gameDataInitializer.getInitialData(
      this.currentGameTypeName(),
      this.initialGameData()
    ) as SimonData | null;
  }

  onCancel(): void {
    // Vérifier si le formulaire a été modifié
    const hasChanges = this.hasFormChanges();
    
    if (hasChanges) {
      const confirmed = confirm('Vous avez des modifications non sauvegardées. Êtes-vous sûr de vouloir fermer ?');
      if (!confirmed) {
        return;
      }
    }
    
    this.isProcessing.set(false);
    this.cancel.emit();
  }

  /**
   * Vérifie si le formulaire a été modifié par rapport aux valeurs initiales
   */
  private hasFormChanges(): boolean {
    // Vérifier si les champs globaux ont changé
    const currentGlobalFields = this.globalFieldsData();
    const initialGlobalFields = {
      instructions: this.game.instructions || null,
      question: this.game.question || null,
      aides: this.game.aides || null,
      aideImageUrl: this.game.aide_image_url || null,
      aideVideoUrl: this.game.aide_video_url || null,
    };
    
    const globalFieldsChanged = 
      currentGlobalFields?.instructions !== initialGlobalFields.instructions ||
      currentGlobalFields?.question !== initialGlobalFields.question ||
      JSON.stringify(currentGlobalFields?.aides || []) !== JSON.stringify(initialGlobalFields.aides || []) ||
      currentGlobalFields?.aideImageUrl !== initialGlobalFields.aideImageUrl ||
      currentGlobalFields?.aideVideoUrl !== initialGlobalFields.aideVideoUrl ||
      currentGlobalFields?.aideImageFile !== null; // Si un nouveau fichier a été sélectionné

    // Vérifier si les données spécifiques du jeu ont changé
    const currentGameData = this.gameSpecificData();
    const initialGameData = this.initialGameData();
    const gameDataChanged = JSON.stringify(currentGameData) !== JSON.stringify(initialGameData);

    // Vérifier si les sélections du formulaire ont changé par rapport aux valeurs initiales
    const formValue = this.duplicateForm.value;
    const initialSchoolId = this.currentAssignment?.school_id || '';
    const initialLevel = this.currentAssignment?.school_level || '';
    const initialSubjectId = this.game.subject_id || this.currentAssignment?.subject_id || '';
    const initialCategoryId = this.game.subject_category_id || '';

    const formChanged = 
      formValue.schoolId !== initialSchoolId ||
      formValue.level !== initialLevel ||
      formValue.subjectId !== initialSubjectId ||
      formValue.subjectCategoryId !== initialCategoryId;

    return globalFieldsChanged || gameDataChanged || formChanged;
  }

  getSchoolLevelLabel = getSchoolLevelLabel;
}

