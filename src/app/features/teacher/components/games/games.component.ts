import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { GamesApplication } from './application/application';
import { GamesStore } from '../../store/games.store';
import { TeacherAssignmentStore } from '../../store/assignments.store';
import { ErrorSnackbarService } from '../../../../shared/services/snackbar/error-snackbar.service';
import { TeacherService } from '../../services/teacher/teacher.service';
import { CaseVideFormComponent } from './components/case-vide-form/case-vide-form.component';
import { ReponseLibreFormComponent } from './components/reponse-libre-form/reponse-libre-form.component';
import { LiensFormComponent } from './components/liens-form/liens-form.component';
import { ChronologieFormComponent } from './components/chronologie-form/chronologie-form.component';
import { QcmFormComponent } from './components/qcm-form/qcm-form.component';
import { VraiFauxFormComponent } from './components/vrai-faux-form/vrai-faux-form.component';
import { MemoryFormComponent } from './components/memory-form/memory-form.component';
import { AIGameGeneratorFormComponent } from './components/ai-game-generator-form/ai-game-generator-form.component';
import { AIGeneratedPreviewComponent } from './components/ai-generated-preview/ai-generated-preview.component';
import { GameGlobalFieldsComponent, type GameGlobalFieldsData } from './components/game-global-fields/game-global-fields.component';
import { GameCardComponent } from './components/game-card/game-card.component';
import type { Game, GameCreate, GameUpdate } from '../../types/game';
import type { CaseVideData, ReponseLibreData, LiensData, ChronologieData, QcmData, VraiFauxData, MemoryData } from '../../types/game-data';
import type { AIGameGenerationRequest } from '../../types/ai-game-generation';
import { normalizeGameData } from '../../utils/game-data-mapper';

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CaseVideFormComponent,
    ReponseLibreFormComponent,
    LiensFormComponent,
    ChronologieFormComponent,
    QcmFormComponent,
    VraiFauxFormComponent,
    MemoryFormComponent,
    AIGameGeneratorFormComponent,
    AIGeneratedPreviewComponent,
    GameGlobalFieldsComponent,
    GameCardComponent,
  ],
  templateUrl: './games.component.html',
  styleUrls: ['./games.component.scss'],
})
export class GamesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly application = inject(GamesApplication);
  private readonly errorSnackbar = inject(ErrorSnackbarService);
  private readonly teacherService = inject(TeacherService);
  readonly gamesStore = inject(GamesStore);
  readonly subjectsStore = inject(TeacherAssignmentStore);

  readonly subjectId = signal<string | null>(null);
  readonly editingGameId = signal<string | null>(null);
  readonly selectedGameTypeName = signal<string | null>(null);

  readonly games = computed(() => this.gamesStore.games());
  readonly gameTypes = computed(() => this.gamesStore.gameTypes());
  readonly isLoading = computed(() => this.gamesStore.isLoading());
  readonly subjects = computed(() => this.subjectsStore.subjects());

  readonly currentSubject = computed(() => {
    const id = this.subjectId();
    if (!id) return null;
    return this.subjects().find(s => s.id === id) || null;
  });

  readonly currentSubjectName = computed(() => {
    const subject = this.currentSubject();
    return subject?.name || '';
  });

  // Récupération automatique du niveau scolaire depuis school_level
  readonly schoolYearLabel = computed(() => {
    const subjectId = this.subjectId();
    if (!subjectId) return null;

    const assignments = this.subjectsStore.assignments();
    const assignment = assignments.find(a => a.subject_id === subjectId);
    
    // Utiliser school_level directement depuis l'assignment
    return assignment?.school_level || null;
  });

  // États pour la génération IA
  readonly generatedGames = computed(() => this.gamesStore.generatedGames());
  readonly isGenerating = computed(() => this.gamesStore.isGenerating());
  readonly generationProgress = computed(() => this.gamesStore.generationProgress());

  // Données des composants spécifiques
  readonly gameSpecificData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | null>(null);
  readonly gameSpecificValid = signal<boolean>(false);

  // Données initiales pour l'édition
  readonly initialGameData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | null>(null);
  readonly initialGlobalFields = signal<GameGlobalFieldsData | null>(null);

  // États des toggles pour les sections
  readonly isAIGenerationExpanded = signal<boolean>(false);
  readonly isManualCreationExpanded = signal<boolean>(false);
  readonly isGamesListExpanded = signal<boolean>(true); // Ouvert par défaut

  gameForm = this.fb.group({
    instructions: [''],
    game_type_id: ['', Validators.required],
    question: [''],
    aides: this.fb.array<FormControl<string>>([]),
  });

  get aidesArray(): FormArray<FormControl<string>> {
    return this.gameForm.get('aides') as FormArray<FormControl<string>>;
  }

  onGlobalFieldsChange(data: GameGlobalFieldsData): void {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'games.component.ts:112',message:'onGlobalFieldsChange called',data:{hasInstructions:!!data.instructions,hasQuestion:!!data.question,aidesCount:data.aides?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    this.gameForm.patchValue({
      instructions: data.instructions || '',
      question: data.question || '',
    }, { emitEvent: false });

    // Mettre à jour les aides
    this.aidesArray.clear();
    if (data.aides && data.aides.length > 0) {
      data.aides.forEach(aide => {
        this.aidesArray.push(new FormControl<string>(aide, { nonNullable: true }));
      });
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'games.component.ts:125',message:'onGlobalFieldsChange completed',data:{aidesArrayLength:this.aidesArray.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/teacher-subjects']);
      return;
    }
    
    this.subjectId.set(id);
    this.application.loadGameTypes();
    this.application.loadGamesBySubject(id);
    this.subjectsStore.loadSubjects();
    
    // Charger les assignments du professeur pour obtenir le school_level
    // IMPORTANT: Utiliser teacher.id et non user.id car teacher_assignments.teacher_id fait référence à teachers.id
    this.teacherService.getTeacherProfile().subscribe({
      next: (teacher) => {
        if (teacher?.id) {
          this.subjectsStore.loadAssignments(teacher.id);
        } else {
          console.warn('[GamesComponent] Profil professeur non trouvé, impossible de charger les assignments');
        }
      },
      error: (err) => {
        console.error('[GamesComponent] Erreur lors du chargement du profil enseignant', err);
        this.errorSnackbar.showError('Impossible de charger le profil enseignant');
      }
    });
  }

  isEditing(): boolean {
    return this.editingGameId() !== null;
  }

  getSelectedGameTypeName(): string | null {
    const gameTypeId = this.gameForm.get('game_type_id')?.value;
    if (!gameTypeId) return null;
    const gameType = this.gameTypes().find(gt => gt.id === gameTypeId);
    return gameType?.name || null;
  }

  onGameTypeChange(): void {
    const gameTypeId = this.gameForm.get('game_type_id')?.value;
    const gameType = this.gameTypes().find(gt => gt.id === gameTypeId);
    this.selectedGameTypeName.set(gameType?.name || null);
    
    // Si on change de type, réinitialiser les données spécifiques sauf si on est en mode édition
    if (!this.isEditing()) {
      this.gameSpecificData.set(null);
      this.gameSpecificValid.set(false);
      this.initialGameData.set(null);
    } else {
      // En mode édition, charger les données du jeu actuel si le type correspond
      const gameId = this.editingGameId();
      if (gameId) {
        const game = this.games().find(g => g.id === gameId);
        if (game && game.metadata && game.game_type_id === gameTypeId) {
          this.initialGameData.set(game.metadata as unknown as CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData);
        } else {
          this.initialGameData.set(null);
        }
      }
    }
  }

  onGameDataChange(data: CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData): void {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'games.component.ts:191',message:'onGameDataChange called',data:{dataType:Object.keys(data)[0]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    this.gameSpecificData.set(data);
  }

  onGameValidityChange(valid: boolean): void {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'games.component.ts:195',message:'onGameValidityChange called',data:{valid},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    this.gameSpecificValid.set(valid);
  }

  onGlobalFieldsValidityChange(): void {
    // La validité est toujours vraie pour les champs globaux (optionnels)
  }

  toggleAIGeneration(): void {
    this.isAIGenerationExpanded.update(v => !v);
  }

  toggleManualCreation(): void {
    this.isManualCreationExpanded.update(v => !v);
  }

  toggleGamesList(): void {
    this.isGamesListExpanded.update(v => !v);
  }

  create(): void {
    if (!this.gameForm.valid || !this.subjectId() || !this.gameSpecificValid()) return;
    const v = this.gameForm.value;
    const subjectId = this.subjectId()!;
    const gameData = this.gameSpecificData();
    if (!gameData) return;

    // Générer un nom automatique
    const gameTypeName = this.selectedGameTypeName() || 'Jeu';
    const questionPreview = v.question?.trim() ? v.question.trim().substring(0, 30) : '';
    const autoName = questionPreview ? `${gameTypeName} - ${questionPreview}${questionPreview.length >= 30 ? '...' : ''}` : gameTypeName;

    // Construire les aides
    const aides = this.aidesArray.value.filter((a: string) => a && a.trim());

    // Stocker les données spécifiques dans metadata
    this.application.createGame({
      subject_id: subjectId,
      game_type_id: v.game_type_id!,
      name: autoName,
      instructions: v.instructions || null,
      question: v.question?.trim() || null,
      reponses: null, // On utilise metadata pour les données spécifiques
      aides: aides.length > 0 ? aides : null,
      metadata: gameData as unknown as Record<string, unknown>,
    });

    this.resetForm();
  }

  startEdit(game: Game): void {
    this.editingGameId.set(game.id);
    this.gameForm.patchValue({
      game_type_id: game.game_type_id || '',
    });

    // Charger les champs globaux
    this.initialGlobalFields.set({
      instructions: game.instructions || null,
      question: game.question || null,
      aides: game.aides || null,
    });

    // Charger les données spécifiques depuis metadata et normaliser si nécessaire
    if (game.metadata) {
      const normalizedMetadata = normalizeGameData(
        this.getGameTypeName(game.game_type_id),
        game.metadata as Record<string, unknown>
      );
      this.initialGameData.set(normalizedMetadata as unknown as CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData);
    }

    const gameType = this.gameTypes().find(gt => gt.id === game.game_type_id);
    this.selectedGameTypeName.set(gameType?.name || null);
  }

  cancelEdit(): void {
    this.editingGameId.set(null);
    this.resetForm();
  }

  private resetForm(): void {
    this.gameForm.reset();
    this.aidesArray.clear();
    this.gameForm.patchValue({ game_type_id: '' });
    this.selectedGameTypeName.set(null);
    this.gameSpecificData.set(null);
    this.gameSpecificValid.set(false);
    this.initialGameData.set(null);
    this.initialGlobalFields.set(null);
  }

  update(): void {
    const gameId = this.editingGameId();
    if (!gameId || !this.gameForm.valid || !this.gameSpecificValid()) return;
    const v = this.gameForm.value;
    const gameData = this.gameSpecificData();
    if (!gameData) return;

    // Générer un nom automatique
    const gameTypeName = this.selectedGameTypeName() || 'Jeu';
    const questionPreview = v.question?.trim() ? v.question.trim().substring(0, 30) : '';
    const autoName = questionPreview ? `${gameTypeName} - ${questionPreview}${questionPreview.length >= 30 ? '...' : ''}` : gameTypeName;

    // Construire les aides
    const aides = this.aidesArray.value.filter((a: string) => a && a.trim());

    this.application.updateGame(gameId, {
      name: autoName,
      instructions: v.instructions || null,
      question: v.question?.trim() || null,
      reponses: null,
      aides: aides.length > 0 ? aides : null,
      metadata: gameData as unknown as Record<string, unknown>,
      game_type_id: v.game_type_id!,
    });

    this.cancelEdit();
  }

  updateGameFromCard(gameId: string, updates: GameUpdate): void {
    this.application.updateGame(gameId, updates);
  }

  delete(gameId: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce jeu ?')) {
      this.application.deleteGame(gameId);
    }
  }

  getGameTypeName(gameTypeId: string): string {
    const gameType = this.gameTypes().find(gt => gt.id === gameTypeId);
    return gameType?.name || 'Type inconnu';
  }

  getInitialDataForCaseVide(): CaseVideData | null {
    const data = this.initialGameData();
    const currentType = this.selectedGameTypeName();
    if (currentType === 'case vide' && data && 'debut_phrase' in data) {
      return data as CaseVideData;
    }
    return null;
  }

  getInitialDataForReponseLibre(): ReponseLibreData | null {
    const data = this.initialGameData();
    const currentType = this.selectedGameTypeName();
    if (currentType === 'reponse libre' && data && 'reponse_valide' in data && !('debut_phrase' in data)) {
      return data as ReponseLibreData;
    }
    return null;
  }

  getInitialDataForLiens(): LiensData | null {
    const data = this.initialGameData();
    const currentType = this.selectedGameTypeName();
    if (currentType === 'liens' && data && 'mots' in data && 'reponses' in data && 'liens' in data) {
      return data as LiensData;
    }
    return null;
  }

  getInitialDataForChronologie(): ChronologieData | null {
    const data = this.initialGameData();
    const currentType = this.selectedGameTypeName();
    if (currentType === 'chronologie' && data && 'mots' in data && 'ordre_correct' in data && !('reponses' in data)) {
      return data as ChronologieData;
    }
    return null;
  }

  getInitialDataForQcm(): QcmData | null {
    const data = this.initialGameData();
    const currentType = this.selectedGameTypeName();
    if (currentType === 'qcm' && data && 'propositions' in data && 'reponses_valides' in data) {
      return data as QcmData;
    }
    return null;
  }

  getInitialDataForVraiFaux(): VraiFauxData | null {
    const data = this.initialGameData();
    const currentType = this.selectedGameTypeName();
    if (currentType?.toLowerCase() === 'vrai/faux' && data && 'enonces' in data) {
      return data as VraiFauxData;
    }
    return null;
  }

  getInitialDataForMemory(): MemoryData | null {
    const data = this.initialGameData();
    const currentType = this.selectedGameTypeName();
    if (currentType?.toLowerCase() === 'memory' && data && 'paires' in data) {
      return data as MemoryData;
    }
    return null;
  }

  // Méthodes pour la génération IA
  onGenerateGamesWithAI(request: AIGameGenerationRequest): void {
    this.application.generateGamesWithAI(request);
  }

  onEditGeneratedGame(tempId: string): void {
    this.application.toggleEditGeneratedGame(tempId);
  }

  onRemoveGeneratedGame(tempId: string): void {
    this.application.removeGeneratedGame(tempId);
  }

  onUpdateGeneratedGame(event: { tempId: string; updates: Partial<GameCreate> }): void {
    this.application.updateGeneratedGame(event.tempId, event.updates);
  }

  onSaveAllGeneratedGames(): void {
    if (confirm(`Êtes-vous sûr de vouloir sauvegarder tous les jeux générés (${this.generatedGames().length}) ?`)) {
      this.application.validateGeneratedGames();
    }
  }

  onCancelAllGeneratedGames(): void {
    if (confirm('Êtes-vous sûr de vouloir annuler la génération ? Tous les jeux générés seront perdus.')) {
      this.application.cancelGeneration();
    }
  }
}
