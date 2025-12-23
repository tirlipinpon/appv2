import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import type { Game } from '../../../../types/game';
import type { GameType } from '../../../../types/game-type';
import type { TeacherAssignment } from '../../../../types/teacher-assignment';
import type { School } from '../../../../types/school';
import type { Subject } from '../../../../types/subject';
import type { CaseVideData, ReponseLibreData, LiensData, ChronologieData, QcmData, VraiFauxData, MemoryData } from '../../../../types/game-data';
import { GameGlobalFieldsComponent, type GameGlobalFieldsData } from '../game-global-fields/game-global-fields.component';
import { CaseVideFormComponent } from '../case-vide-form/case-vide-form.component';
import { ReponseLibreFormComponent } from '../reponse-libre-form/reponse-libre-form.component';
import { LiensFormComponent } from '../liens-form/liens-form.component';
import { ChronologieFormComponent } from '../chronologie-form/chronologie-form.component';
import { QcmFormComponent } from '../qcm-form/qcm-form.component';
import { VraiFauxFormComponent } from '../vrai-faux-form/vrai-faux-form.component';
import { MemoryFormComponent } from '../memory-form/memory-form.component';
import { SCHOOL_LEVELS, getSchoolLevelLabel } from '../../../../utils/school-levels.util';
import { normalizeGameData } from '../../../../utils/game-data-mapper';

export interface DuplicateGameData {
  schoolId: string | null;
  level: string | null;
  subjectId: string;
  gameData: {
    instructions: string | null;
    question: string | null;
    aides: string[] | null;
    metadata: Record<string, unknown> | null;
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
  ],
  templateUrl: './duplicate-game-dialog.component.html',
  styleUrls: ['./duplicate-game-dialog.component.scss'],
})
export class DuplicateGameDialogComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);

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
  readonly gameSpecificData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | null>(null);
  readonly gameSpecificValid = signal<boolean>(false);
  readonly initialGameData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | null>(null);

  readonly currentGameTypeName = computed(() => {
    if (this.gameTypes.length > 0) {
      const gameType = this.gameTypes.find(gt => gt.id === this.game.game_type_id);
      return gameType?.name || this.gameTypeName;
    }
    return this.gameTypeName;
  });

  // Computed pour les niveaux disponibles selon l'école sélectionnée
  readonly availableLevels = computed(() => {
    const schoolId = this.selectedSchoolId();
    if (!schoolId) return [];

    const assignments = this.availableAssignments.filter(a => a.school_id === schoolId && a.school_level);
    const levels = new Set(assignments.map(a => a.school_level!));

    // Trier selon l'ordre de SCHOOL_LEVELS
    return Array.from(levels).sort((a, b) => {
      const indexA = SCHOOL_LEVELS.findIndex(l => l.value === a);
      const indexB = SCHOOL_LEVELS.findIndex(l => l.value === b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  });

  // Computed pour les matières disponibles selon l'école et le niveau
  readonly availableSubjectsForSelection = computed(() => {
    const schoolId = this.selectedSchoolId();
    const level = this.selectedLevel();

    if (!schoolId || !level) return [];

    const assignments = this.availableAssignments.filter(
      a => a.school_id === schoolId && a.school_level === level
    );

    const subjectIds = new Set(assignments.map(a => a.subject_id));
    return this.availableSubjects.filter(s => subjectIds.has(s.id));
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
    });

    // Réinitialiser le niveau quand l'école change
    this.duplicateForm.get('schoolId')?.valueChanges.subscribe((value) => {
      this.selectedSchoolId.set(value || null);
      this.duplicateForm.patchValue({ level: '', subjectId: '' }, { emitEvent: false });
      this.selectedLevel.set(null);
    });

    // Réinitialiser la matière quand le niveau change
    this.duplicateForm.get('level')?.valueChanges.subscribe((value) => {
      this.selectedLevel.set(value || null);
      this.duplicateForm.patchValue({ subjectId: '' }, { emitEvent: false });
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
    });

    // Initialiser les signals pour la réactivité
    this.selectedSchoolId.set(schoolId || null);
    this.selectedLevel.set(level || null);

    // Initialiser les champs globaux
    this.globalFieldsData.set({
      instructions: this.game.instructions || null,
      question: this.game.question || null,
      aides: this.game.aides || null,
    });

    // Charger les données spécifiques depuis metadata et normaliser si nécessaire
    if (this.game.metadata) {
      const normalizedMetadata = normalizeGameData(
        this.currentGameTypeName(),
        this.game.metadata as Record<string, unknown>
      );
      const gameData = normalizedMetadata as unknown as CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData;
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

  onGameDataChange(data: CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData): void {
    this.gameSpecificData.set(data);
  }

  onGameValidityChange(valid: boolean): void {
    this.gameSpecificValid.set(valid);
  }

  onConfirm(): void {
    if (!this.isFormValid()) return;

    const formValue = this.duplicateForm.value;
    const globalFields = this.globalFieldsData();
    const gameData = this.gameSpecificData();

    this.confirm.emit({
      schoolId: formValue.schoolId || null,
      level: formValue.level || null,
      subjectId: formValue.subjectId,
      gameData: {
        instructions: globalFields?.instructions || null,
        question: globalFields?.question || null,
        aides: globalFields?.aides || null,
        metadata: gameData ? (gameData as unknown as Record<string, unknown>) : null,
      },
    });
  }

  // Méthodes pour obtenir les données initiales selon le type de jeu
  getInitialDataForCaseVide(): CaseVideData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (currentType.toLowerCase() === 'case vide' && data) {
      if (('texte' in data && 'cases_vides' in data) || 'debut_phrase' in data) {
        return data as CaseVideData;
      }
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

  getInitialDataForVraiFaux(): VraiFauxData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (currentType.toLowerCase() === 'vrai/faux' && data && 'enonces' in data) {
      return data as VraiFauxData;
    }
    return null;
  }

  getInitialDataForMemory(): MemoryData | null {
    const data = this.initialGameData();
    const currentType = this.currentGameTypeName();
    if (currentType.toLowerCase() === 'memory' && data && 'paires' in data) {
      return data as MemoryData;
    }
    return null;
  }

  onCancel(): void {
    this.cancel.emit();
  }

  getSchoolLevelLabel = getSchoolLevelLabel;
}

