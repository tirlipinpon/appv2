import { Component, inject, OnInit, OnDestroy, signal, computed, effect, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription, Observable } from 'rxjs';
import { GamesApplication } from './application/application';
import { GamesStore } from '../../store/games.store';
import { TeacherAssignmentStore } from '../../store/assignments.store';
import { ErrorSnackbarService, ConfirmationDialogService } from '../../../../shared';
import { GamesStatsDisplayComponent, GamesStatsService } from '@shared';
import { GameTypeStyleService } from '../../../../shared/services/game-type-style/game-type-style.service';
import { TeacherService } from '../../services/teacher/teacher.service';
import { CaseVideFormComponent } from './components/case-vide-form/case-vide-form.component';
import { ReponseLibreFormComponent } from './components/reponse-libre-form/reponse-libre-form.component';
import { LiensFormComponent } from './components/liens-form/liens-form.component';
import { ChronologieFormComponent } from './components/chronologie-form/chronologie-form.component';
import { QcmFormComponent } from './components/qcm-form/qcm-form.component';
import { VraiFauxFormComponent } from './components/vrai-faux-form/vrai-faux-form.component';
import { MemoryFormComponent } from './components/memory-form/memory-form.component';
import { SimonFormComponent } from './components/simon-form/simon-form.component';
import { ImageInteractiveFormComponent, type ImageInteractiveDataWithFile } from './components/image-interactive-form/image-interactive-form.component';
import { PuzzleFormComponent, type PuzzleDataWithFile } from './components/puzzle-form/puzzle-form.component';
import { AIGameGeneratorFormComponent } from './components/ai-game-generator-form/ai-game-generator-form.component';
import { AIGeneratedPreviewComponent } from './components/ai-generated-preview/ai-generated-preview.component';
import { GameGlobalFieldsComponent, type GameGlobalFieldsData } from './components/game-global-fields/game-global-fields.component';
import { GameCardComponent } from './components/game-card/game-card.component';
import { DuplicateGameDialogComponent } from './components/duplicate-game-dialog/duplicate-game-dialog.component';
import type { Game, GameCreate, GameUpdate } from '../../types/game';
import type { CaseVideData, ReponseLibreData, LiensData, ChronologieData, QcmData, VraiFauxData, MemoryData, SimonData, ImageInteractiveData, PuzzleData } from '@shared/games';
import type { AIGameGenerationRequest } from '../../types/ai-game-generation';
import type { TeacherAssignment } from '../../types/teacher-assignment';
import type { Subject } from '../../types/subject';
import type { SubjectCategory } from '../../types/subject';
import type { School } from '../../types/school';
import { Infrastructure } from '../infrastructure/infrastructure';
import { normalizeGameData } from '../../utils/game-data-mapper';
import { SCHOOL_LEVELS } from '../../utils/school-levels.util';
import type { DuplicateGameData } from './components/duplicate-game-dialog/duplicate-game-dialog.component';
import { ImageUploadService } from './services/image-upload/image-upload.service';
import { AideMediaUploadService } from './services/aide-media/aide-media-upload.service';
import { GameDataInitializerService } from '../../services/game-data-initializer/game-data-initializer.service';
import { GameCreationService } from '../../services/game-creation/game-creation.service';
import { AssignmentFilterService } from '../../services/assignment-filter/assignment-filter.service';
import { tap } from 'rxjs/operators';
import { normalizeGameTypeName, isGameType, isGameTypeOneOf } from '../../utils/game-type.util';

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
    PuzzleFormComponent,
    AIGameGeneratorFormComponent,
    AIGeneratedPreviewComponent,
    GameGlobalFieldsComponent,
    GameCardComponent,
    DuplicateGameDialogComponent,
    GamesStatsDisplayComponent,
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
  private readonly confirmationDialog = inject(ConfirmationDialogService);
  private readonly teacherService = inject(TeacherService);
  private readonly infra = inject(Infrastructure);
  private readonly imageUploadService = inject(ImageUploadService);
  private readonly gameDataInitializer = inject(GameDataInitializerService);
  private readonly gameCreationService = inject(GameCreationService);
  private readonly assignmentFilter = inject(AssignmentFilterService);
  private readonly aideMediaUploadService = inject(AideMediaUploadService);
  readonly gamesStore = inject(GamesStore);
  readonly subjectsStore = inject(TeacherAssignmentStore);
  private readonly gamesStatsService = inject(GamesStatsService);
  private readonly infrastructure = inject(Infrastructure);
  private readonly gameTypeStyleService = inject(GameTypeStyleService);

  readonly subjectId = signal<string | null>(null);
  readonly editingGameId = signal<string | null>(null);
  readonly selectedGameTypeName = signal<string | null>(null);
  readonly categories = signal<SubjectCategory[]>([]);
  readonly selectedCategoryId = signal<string | null>(null);
  readonly isCategoryContext = computed(() => {
    // Si on a un categoryId dans les query params, on est en mode "gestion d'une sous-catégorie spécifique"
    const urlParams = new URLSearchParams(window.location.search);
    const categoryIdFromUrl = urlParams.get('categoryId');
    const categoryIdFromSnapshot = this.route.snapshot.queryParamMap.get('categoryId');
    return categoryIdFromUrl !== null || categoryIdFromSnapshot !== null;
  });
  
  // Signals pour la duplication
  readonly duplicateDialogOpen = signal<boolean>(false);
  readonly gameToDuplicate = signal<Game | null>(null);
  readonly currentAssignment = signal<TeacherAssignment | null>(null);
  private isDuplicating = false;
  private isCreating = false;

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
  // Inclut aussi l'école du jeu actuel si elle existe
  readonly availableSchoolsForTeacher = computed(() => {
    const assignments = this.subjectsStore.assignments();
    const schools = this.subjectsStore.schools();
    const currentAssignment = this.currentAssignment();
    
    // Récupérer les IDs d'écoles depuis les assignments (filtrer les null)
    const schoolIds = new Set<string>(
      assignments
        .map(a => a.school_id)
        .filter((id): id is string => id !== null && id !== undefined)
    );
    
    // Ajouter l'école du jeu actuel si elle existe
    if (currentAssignment?.school_id) {
      schoolIds.add(currentAssignment.school_id);
    }
    
    // Créer un Map pour faciliter la recherche
    const schoolsMap = new Map(schools.map(s => [s.id, s]));
    
    // Filtrer et trier les écoles chargées
    const loadedSchools = schools
      .filter(school => schoolIds.has(school.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Ajouter les écoles non encore chargées avec des noms temporaires
    const missingSchoolIds = Array.from(schoolIds).filter(id => !schoolsMap.has(id));
    const missingSchools: School[] = missingSchoolIds.map(id => ({
      id,
      name: `École ${id.substring(0, 8)}...`,
      address: null,
      city: null,
      country: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    return [...loadedSchools, ...missingSchools].sort((a, b) => a.name.localeCompare(b.name));
  });

  // Fonction pour obtenir les niveaux disponibles selon l'école sélectionnée
  getAvailableLevelsForSchool(schoolId: string | null): string[] {
    return this.assignmentFilter.getAvailableLevelsForSchool(
      this.subjectsStore.assignments(),
      schoolId
    );
  }

  // Fonction pour obtenir les matières disponibles selon l'école et le niveau
  getAvailableSubjectsForSchoolAndLevel(schoolId: string | null, level: string | null): Subject[] {
    return this.assignmentFilter.getAvailableSubjectsForSchoolAndLevel(
      this.subjectsStore.assignments(),
      this.subjectsStore.subjects(),
      schoolId,
      level
    );
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
  readonly gameSpecificData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | PuzzleData | null>(null);
  readonly gameSpecificValid = signal<boolean>(false);

  // Données initiales pour l'édition
  readonly initialGameData = signal<CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | PuzzleData | null>(null);
  
  // Données spécifiques pour le jeu image-interactive avec le fichier File (pour l'upload lors de la création)
  private imageInteractiveDataWithFile = signal<ImageInteractiveDataWithFile | null>(null);
  // Données spécifiques pour le jeu puzzle avec le fichier File (pour l'upload lors de la création)
  private puzzleDataWithFile = signal<PuzzleDataWithFile | null>(null);
  readonly initialGlobalFields = signal<GameGlobalFieldsData | null>(null);
  private globalFieldsData = signal<GameGlobalFieldsData | null>(null);
  
  // Computed signals pour les données initiales (évite les appels répétés inutiles)
  readonly initialDataForImageInteractive = computed(() => {
    const data = this.initialGameData();
    const currentType = this.selectedGameTypeName();
    
    // Vérifier que le type correspond (peut être "click" ou "Click")
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
  });

  readonly initialDataForPuzzle = computed(() => {
    const data = this.initialGameData();
    const currentType = this.selectedGameTypeName();
    
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
  });

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
    this.globalFieldsData.set(data);
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

    // Effect pour charger les écoles quand le dialogue de duplication s'ouvre
    effect(() => {
      const isOpen = this.duplicateDialogOpen();
      const schools = this.subjectsStore.schools();
      const assignments = this.subjectsStore.assignments();
      
      if (isOpen && schools.length === 0 && assignments.length > 0) {
        // Charger les écoles si elles ne sont pas déjà chargées et qu'on a des assignments
        this.subjectsStore.loadSchools();
      }
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
      // Charger les stats pour la catégorie
      this.gamesStatsService.loadStatsForCategory(
        categoryId,
        () => this.infrastructure.getGamesStatsByCategory(categoryId)
      );
    } else {
      // Charger les jeux de la matière
      this.application.loadGamesBySubject(id);
      // Charger les stats pour la matière
      this.gamesStatsService.loadStatsForSubject(
        id,
        () => this.infrastructure.getGamesStatsBySubject(id, undefined, true),
        null
      );
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
          // Charger les stats pour la catégorie
          this.gamesStatsService.loadStatsForCategory(
            categoryId,
            () => this.infrastructure.getGamesStatsByCategory(categoryId)
          );
        } else {
          this.selectedCategoryId.set(null);
          this.application.loadGamesBySubject(currentSubjectId);
          // Charger les stats pour la matière
          this.gamesStatsService.loadStatsForSubject(
            currentSubjectId,
            () => this.infrastructure.getGamesStatsBySubject(currentSubjectId, undefined, true),
            null
          );
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
              // Charger les stats pour la catégorie
              this.gamesStatsService.loadStatsForCategory(
                categoryId,
                () => this.infrastructure.getGamesStatsByCategory(categoryId)
              );
            } else {
              this.application.loadGamesBySubject(currentSubjectId);
              // Charger les stats pour la matière
              this.gamesStatsService.loadStatsForSubject(
                currentSubjectId,
                () => this.infrastructure.getGamesStatsBySubject(currentSubjectId, undefined, true),
                null
              );
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

  // Exposer les fonctions utilitaires pour le template
  readonly normalizeGameTypeName = normalizeGameTypeName;
  readonly isGameType = isGameType;
  readonly isGameTypeOneOf = isGameTypeOneOf;

  /**
   * Récupère le style (icône et couleur) pour le type de jeu sélectionné
   */
  getSelectedGameTypeStyle() {
    const typeName = this.selectedGameTypeName();
    if (!typeName) return { icon: '', colorCode: '#666' };
    return this.gameTypeStyleService.getGameTypeStyleSync(typeName);
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
          this.initialGameData.set(normalizedMetadata as unknown as CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | PuzzleData);
        } else {
          this.initialGameData.set(null);
        }
      }
    }
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
    if (!this.gameForm.valid || !this.subjectId() || !this.gameSpecificValid() || this.isCreating) {
      return;
    }
    
    this.isCreating = true;
    
    const v = this.gameForm.value;
    const subjectId = this.subjectId()!;
    const gameData = this.gameSpecificData();
    if (!gameData) {
      this.isCreating = false;
      return;
    }

    const gameTypeId = (v['game_type_id'] as string) || '';
    const gameTypeName = this.selectedGameTypeName();
    
    // Récupérer categoryId : vérifier l'URL directement, puis query params, puis signal, puis select
    const urlParams = new URLSearchParams(window.location.search);
    const categoryIdFromUrl = urlParams.get('categoryId');
    const queryParamCategoryId = this.route.snapshot.queryParamMap.get('categoryId');
    const selectElement = document.getElementById('category_id') as HTMLSelectElement | null;
    const categoryIdFromSelect = selectElement?.value?.trim() || null;
    
    // Normaliser : convertir les chaînes vides en null
    const normalizedFromUrl = categoryIdFromUrl && categoryIdFromUrl.trim() ? categoryIdFromUrl.trim() : null;
    const normalizedQueryParam = queryParamCategoryId && queryParamCategoryId.trim() ? queryParamCategoryId.trim() : null;
    const normalizedSelected = this.selectedCategoryId() && this.selectedCategoryId()!.trim() ? this.selectedCategoryId()!.trim() : null;
    const normalizedFromSelect = categoryIdFromSelect && categoryIdFromSelect.trim() ? categoryIdFromSelect.trim() : null;
    
    // Priorité : URL directe > query params > signal > select
    const categoryId = normalizedFromUrl || normalizedQueryParam || normalizedSelected || normalizedFromSelect;

    this.gameCreationService.createGameWithImage({
      gameTypeId,
      gameTypeName,
      subjectId,
      categoryId: categoryId || null,
      instructions: (v['instructions'] as string | undefined) || null,
      question: (typeof v['question'] === 'string' ? v['question'].trim() : null) || null,
      aides: this.aidesArray.value.filter((a: string) => a && a.trim()),
      aideImageFile: this.globalFieldsData()?.aideImageFile || null,
      aideImageUrl: this.globalFieldsData()?.aideImageUrl || null,
      aideVideoUrl: this.globalFieldsData()?.aideVideoUrl || null,
      gameData,
      imageDataWithFile: this.imageInteractiveDataWithFile(),
      puzzleDataWithFile: this.puzzleDataWithFile(),
    }).subscribe({
      next: () => {
        this.isCreating = false;
        this.resetForm();
      },
      error: (error) => {
        console.error('Erreur création:', error);
        this.errorSnackbar.showError('Erreur lors de la création du jeu');
        this.isCreating = false;
      }
    });
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
      aideImageUrl: game.aide_image_url || null,
      aideVideoUrl: game.aide_video_url || null,
    });

    // Charger les données spécifiques depuis metadata et normaliser si nécessaire
    if (game.metadata) {
      const normalizedMetadata = normalizeGameData(
        this.getGameTypeName(game.game_type_id),
        game.metadata as Record<string, unknown>
      );
      this.initialGameData.set(normalizedMetadata as unknown as CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | PuzzleData);
    }
  }

  cancelEdit(): void {
    this.editingGameId.set(null);
    this.resetForm();
  }

  private resetForm(): void {
    this.isCreating = false;
    this.gameForm.reset();
    this.aidesArray.clear();
    this.gameForm.patchValue({ game_type_id: '' });
    this.selectedGameTypeName.set(null);
    this.gameSpecificData.set(null);
    this.gameSpecificValid.set(false);
    this.initialGameData.set(null);
    this.initialGlobalFields.set(null);
    this.globalFieldsData.set(null);
    this.selectedCategoryId.set(null);
    this.imageInteractiveDataWithFile.set(null);
    this.puzzleDataWithFile.set(null); // Réinitialiser les données avec fichier
  }

  update(): void {
    const gameId = this.editingGameId();
    if (!gameId || !this.gameForm.valid || !this.gameSpecificValid()) return;
    const v = this.gameForm.value;
    const gameData = this.gameSpecificData();
    if (!gameData) return;

    // Générer un nom automatique
    const gameTypeName = this.selectedGameTypeName() || 'Jeu';
    const questionValue = typeof v['question'] === 'string' ? v['question'].trim() : '';
    const questionPreview = questionValue ? questionValue.substring(0, 30) : '';
    const autoName = questionPreview ? `${gameTypeName} - ${questionPreview}${questionPreview.length >= 30 ? '...' : ''}` : gameTypeName;

    // Construire les aides
    const aides = this.aidesArray.value.filter((a: string) => a && a.trim());

    const globalFields = this.globalFieldsData();
    const updateData: GameUpdate = {
      name: autoName,
      instructions: (v['instructions'] as string | undefined) || null,
      question: questionValue || null,
      reponses: null,
      aides: aides.length > 0 ? aides : null,
      aide_video_url: globalFields?.aideVideoUrl?.trim() || null,
      metadata: gameData as unknown as Record<string, unknown>,
      game_type_id: (v['game_type_id'] as string) || '',
    };

    // Si une nouvelle image d'aide est uploadée, l'uploader d'abord
    if (globalFields?.aideImageFile) {
      const game = this.games().find(g => g.id === gameId);
      const oldImageUrl = game?.aide_image_url;

      // Supprimer l'ancienne image si elle existe
      if (oldImageUrl) {
        this.aideMediaUploadService.deleteAideImage(oldImageUrl).subscribe();
      }

      // Uploader la nouvelle image
      this.aideMediaUploadService.uploadAideImage(globalFields.aideImageFile, gameId).subscribe({
        next: (result) => {
          if (result.error) {
            this.errorSnackbar.showError(`Erreur lors de l'upload de l'image d'aide: ${result.error}`);
          } else {
            updateData.aide_image_url = result.url;
          }
          this.application.updateGame(gameId, updateData);
          this.cancelEdit();
        },
        error: (error) => {
          console.error('Erreur upload image d\'aide:', error);
          this.errorSnackbar.showError('Erreur lors de l\'upload de l\'image d\'aide');
          // Mettre à jour quand même le reste
          this.application.updateGame(gameId, updateData);
          this.cancelEdit();
        }
      });
    } else {
      // Si l'image a été supprimée (aideImageUrl est null mais il y avait une image avant)
      const game = this.games().find(g => g.id === gameId);
      if (game?.aide_image_url && !globalFields?.aideImageUrl) {
        this.aideMediaUploadService.deleteAideImage(game.aide_image_url).subscribe();
        updateData.aide_image_url = null;
      } else if (globalFields?.aideImageUrl) {
        // Conserver l'URL existante
        updateData.aide_image_url = globalFields.aideImageUrl;
      }

      this.application.updateGame(gameId, updateData);
      this.cancelEdit();
    }
  }

  updateGameFromCard(gameId: string, updates: GameUpdate): void {
    this.application.updateGame(gameId, updates);
  }

  async delete(gameId: string): Promise<void> {
    const confirmed = await this.confirmationDialog.confirm({
      title: 'Confirmation de suppression',
      message: `⚠️ ATTENTION : Cette action est IRRÉVERSIBLE !

Êtes-vous sûr de vouloir supprimer ce jeu ?`,
      type: 'danger',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
    });

    if (confirmed) {
      // Supprimer l'image d'aide si elle existe
      const game = this.games().find(g => g.id === gameId);
      if (game?.aide_image_url) {
        this.aideMediaUploadService.deleteAideImage(game.aide_image_url).subscribe({
          error: (error) => {
            console.error('Erreur lors de la suppression de l\'image d\'aide:', error);
            // Continuer quand même la suppression du jeu
          }
        });
      }
      this.application.deleteGame(gameId);
    }
  }

  getGameTypeName(gameTypeId: string): string {
    const gameType = this.gameTypes().find(gt => gt.id === gameTypeId);
    return gameType?.name || 'Type inconnu';
  }

  getInitialDataForCaseVide(): CaseVideData | null {
    return this.gameDataInitializer.getInitialData(
      this.selectedGameTypeName(),
      this.initialGameData()
    ) as CaseVideData | null;
  }

  getInitialDataForReponseLibre(): ReponseLibreData | null {
    return this.gameDataInitializer.getInitialData(
      this.selectedGameTypeName(),
      this.initialGameData()
    ) as ReponseLibreData | null;
  }

  getInitialDataForLiens(): LiensData | null {
    return this.gameDataInitializer.getInitialData(
      this.selectedGameTypeName(),
      this.initialGameData()
    ) as LiensData | null;
  }

  getInitialDataForChronologie(): ChronologieData | null {
    return this.gameDataInitializer.getInitialData(
      this.selectedGameTypeName(),
      this.initialGameData()
    ) as ChronologieData | null;
  }

  getInitialDataForQcm(): QcmData | null {
    return this.gameDataInitializer.getInitialData(
      this.selectedGameTypeName(),
      this.initialGameData()
    ) as QcmData | null;
  }

  getInitialDataForVraiFaux(): VraiFauxData | null {
    return this.gameDataInitializer.getInitialData(
      this.selectedGameTypeName(),
      this.initialGameData()
    ) as VraiFauxData | null;
  }

  getInitialDataForMemory(): MemoryData | null {
    return this.gameDataInitializer.getInitialData(
      this.selectedGameTypeName(),
      this.initialGameData()
    ) as MemoryData | null;
  }

  getInitialDataForSimon(): SimonData | null {
    return this.gameDataInitializer.getInitialData(
      this.selectedGameTypeName(),
      this.initialGameData()
    ) as SimonData | null;
  }

  getInitialDataForImageInteractive(): ImageInteractiveData | null {
    // Utiliser le computed signal pour éviter les appels répétés inutiles
    return this.initialDataForImageInteractive();
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

  async onSaveAllGeneratedGames(): Promise<void> {
    const confirmed = await this.confirmationDialog.confirm({
      message: `Êtes-vous sûr de vouloir sauvegarder tous les jeux générés (${this.generatedGames().length}) ?`,
      type: 'info',
    });

    if (confirmed) {
      this.application.validateGeneratedGames();
    }
  }

  async onCancelAllGeneratedGames(): Promise<void> {
    const confirmed = await this.confirmationDialog.confirm({
      message: 'Êtes-vous sûr de vouloir annuler la génération ? Tous les jeux générés seront perdus.',
      type: 'warning',
    });

    if (confirmed) {
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
    // Si plusieurs assignments existent pour cette matière, prendre le premier
    const assignments = this.subjectsStore.assignments();
    const assignment = subjectId 
      ? assignments.find(a => a.subject_id === subjectId)
      : null;
    
    // Charger les écoles si elles ne sont pas déjà chargées
    if (this.subjectsStore.schools().length === 0) {
      this.subjectsStore.loadSchools();
    }
    
    this.gameToDuplicate.set(game);
    this.currentAssignment.set(assignment || null);
    this.duplicateDialogOpen.set(true);
  }

  onDuplicateGame(duplicateData: DuplicateGameData): void {
    if (this.isDuplicating) return;
    
    const game = this.gameToDuplicate();
    if (!game) return;

    this.isDuplicating = true;

    // Vérifier que le subject_id sélectionné correspond bien à un assignment du professeur
    const assignments = this.subjectsStore.assignments();
    const assignmentExists = assignments.some(
      a => a.subject_id === duplicateData.subjectId &&
           a.school_id === duplicateData.schoolId &&
           a.school_level === duplicateData.level
    );

    if (!assignmentExists) {
      this.errorSnackbar.showError('La matière sélectionnée ne correspond pas à une affectation valide.');
      this.isDuplicating = false;
      return;
    }

    const gameTypeName = this.getGameTypeName(game.game_type_id);
    // Utiliser directement la catégorie sélectionnée dans le formulaire de duplication
    // Si null, cela signifie que l'utilisateur veut dupliquer vers la matière principale (sans sous-catégorie)
    const categoryId = duplicateData.subjectCategoryId || null;

    const metadata = duplicateData.gameData.metadata || null;
    const imageUrl = metadata && typeof metadata === 'object' && 'image_url' in metadata
      ? (metadata as unknown as ImageInteractiveData).image_url
      : null;

    this.gameCreationService.duplicateGameWithImage({
      gameTypeId: game.game_type_id,
      gameTypeName,
      subjectId: duplicateData.subjectId,
      categoryId: categoryId || null,
      instructions: duplicateData.gameData.instructions || null,
      question: duplicateData.gameData.question || null,
      aides: duplicateData.gameData.aides || null,
      metadata,
      sourceImageUrl: imageUrl || null,
    }).subscribe({
      next: () => {
        this.isDuplicating = false;
        this.duplicateDialogOpen.set(false);
        this.gameToDuplicate.set(null);
        this.currentAssignment.set(null);
        
        // Recharger les jeux pour la destination de la duplication
        // Si une catégorie est spécifiée, charger les jeux de la catégorie, sinon charger les jeux de la matière principale
        if (categoryId) {
          this.application.loadGamesBySubject(duplicateData.subjectId, categoryId);
        } else {
          this.application.loadGamesBySubject(duplicateData.subjectId);
        }
      },
      error: (error) => {
        console.error('Erreur duplication:', error);
        this.errorSnackbar.showError('Erreur lors de la duplication du jeu');
        this.isDuplicating = false;
      }
    });
  }

  onCancelDuplicate(): void {
    this.isDuplicating = false;
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
    // Normaliser : convertir les chaînes vides en null
    const normalized = categoryId && categoryId.trim() ? categoryId.trim() : null;
    this.selectedCategoryId.set(normalized);
  }
}
