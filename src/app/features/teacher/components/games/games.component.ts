import { Component, inject, OnInit, OnDestroy, signal, computed, effect, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
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
import { SimonFormComponent } from './components/simon-form/simon-form.component';
import { ImageInteractiveFormComponent } from './components/image-interactive-form/image-interactive-form.component';
import { AIGameGeneratorFormComponent } from './components/ai-game-generator-form/ai-game-generator-form.component';
import { AIGeneratedPreviewComponent } from './components/ai-generated-preview/ai-generated-preview.component';
import { GameGlobalFieldsComponent, type GameGlobalFieldsData } from './components/game-global-fields/game-global-fields.component';
import { GameCardComponent } from './components/game-card/game-card.component';
import { DuplicateGameDialogComponent } from './components/duplicate-game-dialog/duplicate-game-dialog.component';
import type { Game, GameCreate, GameUpdate } from '../../types/game';
import type { CaseVideData, ReponseLibreData, LiensData, ChronologieData, QcmData, VraiFauxData, MemoryData, SimonData, ImageInteractiveData } from '../../types/game-data';
import type { AIGameGenerationRequest } from '../../types/ai-game-generation';
import type { TeacherAssignment } from '../../types/teacher-assignment';
import type { Subject } from '../../types/subject';
import type { SubjectCategory } from '../../types/subject';
import { Infrastructure } from '../infrastructure/infrastructure';
import { normalizeGameData } from '../../utils/game-data-mapper';
import { SCHOOL_LEVELS } from '../../utils/school-levels.util';
import type { DuplicateGameData } from './components/duplicate-game-dialog/duplicate-game-dialog.component';

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
    SimonFormComponent,
    ImageInteractiveFormComponent,
    AIGameGeneratorFormComponent,
    AIGeneratedPreviewComponent,
    GameGlobalFieldsComponent,
    GameCardComponent,
    DuplicateGameDialogComponent,
  ],
  templateUrl: './games.component.html',
  styleUrls: ['./games.component.scss'],
})
export class GamesComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly application = inject(GamesApplication);
  private readonly errorSnackbar = inject(ErrorSnackbarService);
  private readonly teacherService = inject(TeacherService);
  private readonly infra = inject(Infrastructure);
  readonly gamesStore = inject(GamesStore);
  readonly subjectsStore = inject(TeacherAssignmentStore);

  readonly subjectId = signal<string | null>(null);
  readonly editingGameId = signal<string | null>(null);
  readonly selectedGameTypeName = signal<string | null>(null);
  readonly categories = signal<SubjectCategory[]>([]);
  readonly selectedCategoryId = signal<string | null>(null);
  readonly isCategoryContext = computed(() => {
    // Si on a un categoryId dans les query params, on est en mode "gestion d'une sous-catégorie spécifique"
    return this.route.snapshot.queryParamMap.get('categoryId') !== null;
  });
  
  // Signals pour la duplication
  readonly duplicateDialogOpen = signal<boolean>(false);
  readonly gameToDuplicate = signal<Game | null>(null);
  readonly currentAssignment = signal<TeacherAssignment | null>(null);

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

  // Computed pour les écoles disponibles depuis les assignments du professeur
  readonly availableSchoolsForTeacher = computed(() => {
    const assignments = this.subjectsStore.assignments();
    const schools = this.subjectsStore.schools();
    const schoolIds = new Set(assignments.map(a => a.school_id).filter(Boolean));
    
    return schools
      .filter(school => schoolIds.has(school.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  // Fonction pour obtenir les niveaux disponibles selon l'école sélectionnée
  getAvailableLevelsForSchool(schoolId: string | null): string[] {
    if (!schoolId) return [];
    
    const assignments = this.subjectsStore.assignments();
    const filtered = assignments.filter(a => a.school_id === schoolId && a.school_level);
    const levels = new Set(filtered.map(a => a.school_level!));
    
    // Trier selon l'ordre de SCHOOL_LEVELS
    return Array.from(levels).sort((a, b) => {
      const indexA = SCHOOL_LEVELS.findIndex(l => l.value === a);
      const indexB = SCHOOL_LEVELS.findIndex(l => l.value === b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }

  // Fonction pour obtenir les matières disponibles selon l'école et le niveau
  getAvailableSubjectsForSchoolAndLevel(schoolId: string | null, level: string | null): Subject[] {
    if (!schoolId || !level) return [];
    
    const assignments = this.subjectsStore.assignments();
    const subjects = this.subjectsStore.subjects();
    const filtered = assignments.filter(
      a => a.school_id === schoolId && a.school_level === level
    );
    const subjectIds = new Set(filtered.map(a => a.subject_id));
    
    return subjects
      .filter(subject => subjectIds.has(subject.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

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
  readonly gameSpecificData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | null>(null);
  readonly gameSpecificValid = signal<boolean>(false);

  // Données initiales pour l'édition
  readonly initialGameData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | null>(null);
  readonly initialGlobalFields = signal<GameGlobalFieldsData | null>(null);

  // États des toggles pour les sections
  readonly isAIGenerationExpanded = signal<boolean>(false);
  readonly isManualCreationExpanded = signal<boolean>(false);
  readonly isGamesListExpanded = signal<boolean>(false); // Fermé par défaut

  // Référence au composant formulaire de génération IA
  @ViewChild(AIGameGeneratorFormComponent) aiGeneratorForm?: AIGameGeneratorFormComponent;
  
  // Track si on vient de sauvegarder pour réinitialiser le formulaire
  private previousGeneratedGamesLength = 0;
  private routerSubscription?: Subscription;

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
  }

  constructor() {
    // Effect pour détecter quand les jeux générés sont sauvegardés (array devient vide après avoir été rempli)
    effect(() => {
      const currentLength = this.generatedGames().length;
      
      // Si on passe de non-vide à vide, cela signifie que la sauvegarde vient de se terminer
      if (this.previousGeneratedGamesLength > 0 && currentLength === 0) {
        // Réinitialiser le formulaire de génération IA
        if (this.aiGeneratorForm) {
          this.aiGeneratorForm.resetForm();
        }
      }
      
      // Mettre à jour la longueur précédente
      this.previousGeneratedGamesLength = currentLength;
    });
  }

  navigateToSubject(event: Event): void {
    event.preventDefault();
    const id = this.subjectId();
    if (id) {
      this.router.navigate(['/teacher-subjects', id]);
    } else {
      this.router.navigate(['/teacher-subjects']);
    }
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/teacher-subjects']);
      return;
    }
    
    this.subjectId.set(id);
    this.application.loadGameTypes();
    this.subjectsStore.loadSubjects();
    this.loadCategories(id);
    
    // Lire le paramètre categoryId depuis les query params
    const categoryId = this.route.snapshot.queryParamMap.get('categoryId');
    if (categoryId) {
      this.selectedCategoryId.set(categoryId);
      // Charger les jeux de la sous-catégorie
      this.application.loadGamesBySubject(id, categoryId);
    } else {
      // Charger les jeux de la matière
      this.application.loadGamesBySubject(id);
    }
    
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

    // Écouter les changements de query params pour recharger les jeux
    this.route.queryParamMap.subscribe(params => {
      const categoryId = params.get('categoryId');
      const currentSubjectId = this.subjectId();
      if (currentSubjectId) {
        if (categoryId) {
          this.selectedCategoryId.set(categoryId);
          this.application.loadGamesBySubject(currentSubjectId, categoryId);
        } else {
          this.selectedCategoryId.set(null);
          this.application.loadGamesBySubject(currentSubjectId);
        }
      }
    });

    // Écouter les navigations pour recharger les jeux quand on revient sur la page
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        // Si on revient sur la page des jeux, recharger les jeux
        if (event.url.includes('/teacher-subjects/') && event.url.includes('/games')) {
          const currentSubjectId = this.subjectId();
          const categoryId = this.route.snapshot.queryParamMap.get('categoryId');
          if (currentSubjectId) {
            if (categoryId) {
              this.application.loadGamesBySubject(currentSubjectId, categoryId);
            } else {
              this.application.loadGamesBySubject(currentSubjectId);
            }
          }
        }
      });
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  ngAfterViewInit(): void {
    // Initialiser la longueur précédente après la vue initialisée
    this.previousGeneratedGamesLength = this.generatedGames().length;
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
          const normalizedMetadata = normalizeGameData(
            this.getGameTypeName(game.game_type_id),
            game.metadata as Record<string, unknown>
          );
          this.initialGameData.set(normalizedMetadata as unknown as CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData);
        } else {
          this.initialGameData.set(null);
        }
      }
    }
  }

  onGameDataChange(data: CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData): void {
    this.gameSpecificData.set(data);
  }

  onGameValidityChange(valid: boolean): void {
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
    // Si on est en mode "gestion d'une sous-catégorie spécifique", utiliser le categoryId des query params
    const categoryId = this.isCategoryContext() 
      ? (this.route.snapshot.queryParamMap.get('categoryId') || this.selectedCategoryId())
      : this.selectedCategoryId();
    this.application.createGame({
      subject_id: categoryId ? null : subjectId,
      subject_category_id: categoryId || null,
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
    
    // Définir le type de jeu AVANT de charger les données pour que selectedGameTypeName soit disponible
    const gameType = this.gameTypes().find(gt => gt.id === game.game_type_id);
    this.selectedGameTypeName.set(gameType?.name || null);
    
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
      this.initialGameData.set(normalizedMetadata as unknown as CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData);
    }
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
    this.selectedCategoryId.set(null);
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
    const message = `⚠️ ATTENTION : Cette action est IRRÉVERSIBLE !

Êtes-vous sûr de vouloir supprimer ce jeu ?`;

    if (confirm(message)) {
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
    if (currentType === 'case vide' && data) {
      // Accepter le nouveau format (texte + cases_vides) ou l'ancien format (debut_phrase)
      if (('texte' in data && 'cases_vides' in data) || 'debut_phrase' in data) {
        return data as CaseVideData;
      }
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

  getInitialDataForSimon(): SimonData | null {
    const data = this.initialGameData();
    const currentType = this.selectedGameTypeName();
    if (currentType?.toLowerCase() === 'simon' && data) {
      // Vérifier que les propriétés requises existent
      if ('nombre_elements' in data && 'type_elements' in data) {
        return data as SimonData;
      }
    }
    return null;
  }

  getInitialDataForImageInteractive(): ImageInteractiveData | null {
    const data = this.initialGameData();
    const currentType = this.selectedGameTypeName();
    
    console.log('[GamesComponent] getInitialDataForImageInteractive - Type:', currentType, 'Data:', data);
    
    // Vérifier que le type correspond (peut être "click" ou "Click")
    if (currentType && currentType.toLowerCase() === 'click' && data) {
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
        console.log('[GamesComponent] Données ImageInteractive valides, retour:', data);
        return data as ImageInteractiveData;
      } else {
        console.warn('[GamesComponent] Données ImageInteractive invalides - propriétés manquantes ou types incorrects');
      }
    } else {
      console.log('[GamesComponent] Type ne correspond pas ou pas de données - Type:', currentType, 'Has data:', !!data);
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

  // Méthodes pour la duplication
  openDuplicateDialog(game: Game): void {
    // Si le jeu est lié à une sous-catégorie, récupérer le subject_id depuis la sous-catégorie
    let subjectId = game.subject_id;
    
    if (!subjectId && game.subject_category_id) {
      // Récupérer le subject_id depuis la sous-catégorie
      const categories = this.categories();
      const category = categories.find(c => c.id === game.subject_category_id);
      if (category) {
        subjectId = category.subject_id;
      }
    }
    
    // Trouver l'assignment correspondant au jeu parmi les assignments du professeur
    const assignments = this.subjectsStore.assignments();
    const assignment = subjectId 
      ? assignments.find(a => a.subject_id === subjectId)
      : null;
    
    this.gameToDuplicate.set(game);
    this.currentAssignment.set(assignment || null);
    this.duplicateDialogOpen.set(true);
  }

  onDuplicateGame(duplicateData: DuplicateGameData): void {
    const game = this.gameToDuplicate();
    if (!game) return;

    // Vérifier que le subject_id sélectionné correspond bien à un assignment du professeur
    const assignments = this.subjectsStore.assignments();
    const assignmentExists = assignments.some(
      a => a.subject_id === duplicateData.subjectId &&
           a.school_id === duplicateData.schoolId &&
           a.school_level === duplicateData.level
    );

    if (!assignmentExists) {
      this.errorSnackbar.showError('La matière sélectionnée ne correspond pas à une affectation valide.');
      return;
    }

    // Créer le nouveau jeu avec les données dupliquées
    const gameTypeName = this.getGameTypeName(game.game_type_id);
    const questionPreview = duplicateData.gameData.question?.trim() 
      ? duplicateData.gameData.question.trim().substring(0, 30) 
      : '';
    const autoName = questionPreview 
      ? `${gameTypeName} - ${questionPreview}${questionPreview.length >= 30 ? '...' : ''}` 
      : gameTypeName;

    const aides = duplicateData.gameData.aides && duplicateData.gameData.aides.length > 0
      ? duplicateData.gameData.aides.filter(a => a && a.trim())
      : null;

    // Utiliser la sous-catégorie sélectionnée dans le dialog, ou celle du contexte si en mode "gestion d'une sous-catégorie spécifique"
    const categoryId = duplicateData.subjectCategoryId 
      ? duplicateData.subjectCategoryId
      : (this.isCategoryContext() 
        ? (this.route.snapshot.queryParamMap.get('categoryId') || this.selectedCategoryId())
        : null);

    this.application.createGame({
      subject_id: categoryId ? null : duplicateData.subjectId,
      subject_category_id: categoryId || null,
      game_type_id: game.game_type_id,
      name: autoName,
      instructions: duplicateData.gameData.instructions || null,
      question: duplicateData.gameData.question?.trim() || null,
      reponses: null,
      aides: aides,
      metadata: duplicateData.gameData.metadata || null,
    });

    this.duplicateDialogOpen.set(false);
    this.gameToDuplicate.set(null);
    this.currentAssignment.set(null);
  }

  onCancelDuplicate(): void {
    this.duplicateDialogOpen.set(false);
    this.gameToDuplicate.set(null);
    this.currentAssignment.set(null);
  }

  private loadCategories(subjectId: string): void {
    this.infra.getCategoriesBySubject(subjectId).subscribe(({ categories, error }) => {
      if (error) {
        console.error('[GamesComponent] Erreur lors du chargement des sous-catégories:', error);
        return;
      }
      this.categories.set(categories || []);
      
      // Si on a un categoryId dans les query params, pré-sélectionner la sous-catégorie
      const categoryId = this.route.snapshot.queryParamMap.get('categoryId');
      if (categoryId && (categories || []).some(c => c.id === categoryId)) {
        this.selectedCategoryId.set(categoryId);
      }
    });
  }

  onCategoryChange(categoryId: string | null): void {
    this.selectedCategoryId.set(categoryId);
  }
}
