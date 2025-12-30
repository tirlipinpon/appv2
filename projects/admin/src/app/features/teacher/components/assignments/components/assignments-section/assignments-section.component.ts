import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TeacherAssignmentStore } from '../../../../store/assignments.store';
import { TeacherStore } from '../../../../store/index';
import { GamesStatsDisplayComponent, GamesStatsService } from '../../../../../../shared';
import { TransferAssignmentDialogComponent, TransferAssignmentData, TeacherAssignmentWithJoins } from '../transfer-assignment-dialog/transfer-assignment-dialog.component';
import { ChildrenListModalComponent } from '../children-list-modal/children-list-modal.component';
import { TeacherInfoModalComponent } from '../teacher-info-modal/teacher-info-modal.component';
import { getSchoolLevelLabel, SCHOOL_LEVELS } from '../../../../utils/school-levels.util';
import type { TeacherAssignment } from '../../../../types/teacher-assignment';
import type { SubjectCategory } from '../../../../types/subject';
import type { Game } from '../../../../types/game';
import { Infrastructure } from '../../../../components/infrastructure/infrastructure';
import { CategoriesCacheService, SchoolsStore } from '../../../../../../shared';
import { forkJoin, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import type { PostgrestError } from '@supabase/supabase-js';

@Component({
  selector: 'app-assignments-section',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTooltipModule,
    GamesStatsDisplayComponent,
    TransferAssignmentDialogComponent,
    ChildrenListModalComponent,
    TeacherInfoModalComponent,
  ],
  templateUrl: './assignments-section.component.html',
  styleUrl: './assignments-section.component.scss'
})
export class AssignmentsSectionComponent {
  readonly teacherAssignmentStore = inject(TeacherAssignmentStore);
  readonly teacherStore = inject(TeacherStore);
  private readonly infrastructure = inject(Infrastructure);
  private readonly gamesStatsService = inject(GamesStatsService);
  private readonly categoriesCacheService = inject(CategoriesCacheService);
  private readonly schoolsStore = inject(SchoolsStore);

  // Signal pour stocker le nombre d'enfants par affectation
  readonly studentCounts = signal<Map<string, number>>(new Map());

  // Signals pour les sous-catégories, jeux et comptes d'enfants par affectation
  readonly expandedAssignments = signal<Set<string>>(new Set());
  readonly categoriesByAssignment = signal<Map<string, SubjectCategory[]>>(new Map());
  readonly gamesByCategory = signal<Map<string, Game[]>>(new Map());
  readonly childrenCountByCategory = signal<Map<string, number>>(new Map());
  readonly loadingCategories = signal<Map<string, boolean>>(new Map());
  readonly subjectsWithCategories = signal<Set<string>>(new Set()); // IDs des matières qui ont des catégories

  // Signal pour stocker les autres professeurs par matière (excluant le professeur actuel)
  readonly otherTeachersBySubject = signal<Map<string, { id: string; fullname: string | null }[]>>(new Map());

  // Signals pour les affectations
  readonly teacherAssignments = computed(() => this.teacherAssignmentStore.assignments());
  readonly hasAssignments = computed(() => this.teacherAssignmentStore.hasAssignments());
  readonly hasError = computed(() => this.teacherAssignmentStore.hasError());
  readonly error = computed(() => this.teacherAssignmentStore.error());

  // Signal pour gérer l'affichage du dialog de transfert
  readonly showTransferDialog = signal<boolean>(false);
  readonly selectedAssignmentForTransfer = signal<TeacherAssignmentWithJoins | null>(null);

  // Signal pour gérer l'affichage du modal des enfants
  readonly showChildrenModal = signal<boolean>(false);
  readonly selectedCategoryForChildren = signal<{ id: string; name: string; schoolId: string | null; schoolLevel: string | null } | null>(null);
  readonly selectedSubjectForChildren = signal<{ id: string; name: string; schoolId: string | null; schoolLevel: string | null } | null>(null);

  // Signal pour gérer l'affichage du modal du professeur
  readonly showTeacherModal = signal<boolean>(false);
  readonly selectedTeacher = signal<{ id: string; fullname: string | null; subjectId: string | null; subjectName: string | null; schoolId: string | null; schoolLevel: string | null } | null>(null);


  // Filtre par école
  readonly selectedSchoolId = signal<string | null>(null); // null = toutes les écoles

  // Filtre par niveau
  readonly selectedLevel = signal<string | null>(null); // null = tous les niveaux

  // Filtre par type de matière
  readonly selectedSubjectType = signal<'scolaire' | 'extra' | 'optionnelle' | null>(null); // null = tous les types

  // Liste des écoles uniques depuis les affectations
  readonly uniqueSchools = computed(() => {
    const assignments = this.teacherAssignments();
    const schools = this.schoolsStore.schools();
    const schoolIds = new Set(assignments.map(a => a.school_id).filter(Boolean));

    // Si les écoles sont chargées, les filtrer et trier
    if (schools.length > 0) {
      return schools
        .filter(school => schoolIds.has(school.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    // Si les écoles ne sont pas encore chargées, créer des objets temporaires depuis les affectations
    const schoolMap = new Map<string, { id: string; name: string }>();
    assignments.forEach(assignment => {
      if (assignment.school_id) {
        const assignmentWithJoins = assignment as TeacherAssignmentWithJoins;
        if (assignmentWithJoins.school) {
          schoolMap.set(assignment.school_id, {
            id: assignment.school_id,
            name: assignmentWithJoins.school.name || `École ${assignment.school_id.substring(0, 8)}`
          });
        } else {
          const schoolName = this.getSchoolName(assignment.school_id);
          schoolMap.set(assignment.school_id, {
            id: assignment.school_id,
            name: schoolName !== 'École inconnue' ? schoolName : `École ${assignment.school_id.substring(0, 8)}`
          });
        }
      }
    });

    return Array.from(schoolMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  });

  // Niveaux disponibles pour l'école sélectionnée
  readonly availableLevels = computed(() => {
    const schoolId = this.selectedSchoolId();
    if (!schoolId) return [];

    const assignments = this.teacherAssignments();
    const levels = new Set(
      assignments
        .filter(a => a.school_id === schoolId && a.school_level)
        .map(a => a.school_level!)
    );

    // Trier selon l'ordre de SCHOOL_LEVELS
    const sortedLevels = Array.from(levels).sort((a, b) => {
      const indexA = SCHOOL_LEVELS.findIndex(l => l.value === a);
      const indexB = SCHOOL_LEVELS.findIndex(l => l.value === b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return sortedLevels;
  });

  // Affichage conditionnel du filtre niveau
  readonly shouldShowLevelFilter = computed(() => {
    return this.selectedSchoolId() !== null && this.availableLevels().length > 0;
  });

  // Affectations filtrées par école, niveau et type de matière
  readonly filteredAssignments = computed(() => {
    const assignments = this.teacherAssignments();
    const schoolId = this.selectedSchoolId();
    const level = this.selectedLevel();
    const subjectType = this.selectedSubjectType();

    let filtered = assignments;

    if (schoolId) {
      filtered = filtered.filter(a => a.school_id === schoolId);
    }

    if (level) {
      filtered = filtered.filter(a => a.school_level === level);
    }

    if (subjectType) {
      filtered = filtered.filter(a => {
        const assignmentType = this.getAssignmentSubjectType(a);
        return assignmentType === subjectType;
      });
    }

    return filtered;
  });

  // Vérifier si les affectations filtrées sont vides
  readonly hasFilteredAssignments = computed(() => this.filteredAssignments().length > 0);

  // Effect pour réinitialiser le filtre niveau quand l'école change
  private readonly resetLevelOnSchoolChange = effect(() => {
    this.selectedSchoolId(); // Écouter les changements
    this.selectedLevel.set(null); // Réinitialiser
  });

  // Effect pour charger le nombre d'enfants pour chaque affectation
  private readonly loadStudentCountsEffect = effect(() => {
    const assignments = this.filteredAssignments();
    const currentTeacherId = this.getCurrentTeacherId();
    
    if (assignments.length === 0) {
      this.studentCounts.set(new Map());
      return;
    }

    // Charger tous les comptes en parallèle
    const countObservables = assignments
      .filter(a => a.subject_id)
      .map(assignment => {
        return this.infrastructure.countStudentsBySubject(
          assignment.subject_id!,
          assignment.school_id,
          assignment.school_level,
          currentTeacherId
        ).pipe(
          map(({ count, error }) => {
            return {
              assignmentId: assignment.id,
              count: error ? 0 : count
            };
          })
        );
      });

    if (countObservables.length === 0) return;

    forkJoin(countObservables).subscribe(results => {
      const counts = new Map<string, number>();
      results.forEach(({ assignmentId, count }) => {
        counts.set(assignmentId, count);
      });
      this.studentCounts.set(counts);
    });
  });

  // Effect pour charger les stats de jeux pour les matières des affectations
  // On passe skipAssignmentCheck=true car on sait déjà que les assignments existent
  private readonly loadGamesStatsEffect = effect(() => {
    const assignments = this.filteredAssignments();
    if (assignments.length === 0) {
      return;
    }

    // Extraire les subject_id uniques
    const subjectIds = [...new Set(
      assignments
        .filter(a => a.subject_id)
        .map(a => a.subject_id!)
    )];

    if (subjectIds.length > 0) {
      // On sait que les assignments existent (on vient de les charger), donc skip la vérification
      this.gamesStatsService.loadStatsForSubjects(subjectIds, true);
    }
  });

  // Effect pour charger les années scolaires pour toutes les écoles des affectations
  private readonly loadSchoolYearsEffect = effect(() => {
    const assignments = this.filteredAssignments();
    if (assignments.length === 0) {
      return;
    }

    // Extraire les school_id uniques qui ont des school_year_id
    const schoolIds = [...new Set(
      assignments
        .filter(a => a.school_id && a.school_year_id)
        .map(a => a.school_id!)
    )];

    // Charger les années scolaires pour chaque école
    const currentSchoolYears = this.teacherAssignmentStore.schoolYears();
    const loadedSchoolIds = new Set(
      currentSchoolYears.map(sy => {
        // Trouver l'école de cette année scolaire depuis les affectations
        const assignment = assignments.find(a => a.school_year_id === sy.id);
        return assignment?.school_id;
      }).filter(Boolean) as string[]
    );

    schoolIds.forEach(schoolId => {
      if (!loadedSchoolIds.has(schoolId)) {
        this.teacherAssignmentStore.loadSchoolYears(schoolId);
      }
    });
  });

  // Effect pour charger les autres professeurs pour chaque matière
  private readonly loadOtherTeachersEffect = effect(() => {
    const assignments = this.filteredAssignments();
    const currentTeacherId = this.getCurrentTeacherId();
    
    if (assignments.length === 0 || !currentTeacherId) {
      this.otherTeachersBySubject.set(new Map());
      return;
    }

    // Extraire les subject_id uniques
    const subjectIds = [...new Set(
      assignments
        .filter(a => a.subject_id)
        .map(a => a.subject_id!)
    )];

    if (subjectIds.length === 0) return;

    // Charger les professeurs pour chaque matière en parallèle
    const teacherObservables = subjectIds.map(subjectId =>
      this.infrastructure.getTeachersForSubject(subjectId, currentTeacherId).pipe(
        map(({ teachers, error }) => ({
          subjectId,
          teachers: error ? [] : teachers
        }))
      )
    );

    forkJoin(teacherObservables).subscribe(results => {
      const updatedTeachers = new Map(this.otherTeachersBySubject());
      results.forEach(({ subjectId, teachers }) => {
        updatedTeachers.set(subjectId, teachers);
      });
      this.otherTeachersBySubject.set(updatedTeachers);
    });
  });

  // Effect pour vérifier quelles matières ont des catégories
  // Utilise le cache pour éviter les appels redondants
  private readonly loadCategoriesExistenceEffect = effect(() => {
    const assignments = this.filteredAssignments();
    if (assignments.length === 0) {
      this.subjectsWithCategories.set(new Set());
      return;
    }

    // Extraire les subject_id uniques
    const subjectIds = [...new Set(
      assignments
        .filter(a => a.subject_id)
        .map(a => a.subject_id!)
    )];

    if (subjectIds.length === 0) return;

    // Vérifier d'abord ce qui est déjà en cache
    const cachedIds = new Set<string>();
    const uncachedIds: string[] = [];
    
    subjectIds.forEach(subjectId => {
      const cached = this.categoriesCacheService.getCategories(subjectId);
      if (cached !== null) {
        cachedIds.add(subjectId);
      } else {
        // Vérifier si on sait qu'il n'y a pas de catégories
        if (!this.categoriesCacheService.hasCategories(subjectId)) {
          uncachedIds.push(subjectId);
        }
      }
    });

    // Charger les catégories non cachées via le service de cache
    if (uncachedIds.length > 0) {
      // Le service charge en parallèle et met en cache
      this.categoriesCacheService.loadCategoriesForSubjects(uncachedIds);
      
      // Après chargement, mettre à jour (on vérifiera dans le prochain cycle)
      // Pour l'instant, utiliser ce qui est en cache
      const subjectsWithCats = new Set<string>();
      cachedIds.forEach(subjectId => {
        const categories = this.categoriesCacheService.getCategories(subjectId);
        if (categories && categories.length > 0) {
          subjectsWithCats.add(subjectId);
        }
      });
      this.subjectsWithCategories.set(subjectsWithCats);
      
      // Programmer une mise à jour après chargement (via un petit délai)
      // Dans un vrai cas, on pourrait utiliser un signal ou observer le cache
      setTimeout(() => {
        const updatedSubjectsWithCats = new Set<string>();
        subjectIds.forEach(subjectId => {
          if (this.categoriesCacheService.hasCategories(subjectId)) {
            updatedSubjectsWithCats.add(subjectId);
          }
        });
        this.subjectsWithCategories.set(updatedSubjectsWithCats);
      }, 50);
    } else {
      // Tout est en cache, utiliser directement
      const subjectsWithCats = new Set<string>();
      subjectIds.forEach(subjectId => {
        if (this.categoriesCacheService.hasCategories(subjectId)) {
          subjectsWithCats.add(subjectId);
        }
      });
      this.subjectsWithCategories.set(subjectsWithCats);
    }
  });

  // Méthode pour obtenir le nombre d'enfants d'une affectation
  // Utilise uniquement le compte direct (enfants inscrits directement à la matière)
  // Les enfants des catégories sont affichés séparément dans les détails de chaque catégorie
  getStudentCount(assignmentId: string): number {
    return this.studentCounts().get(assignmentId) || 0;
  }

  // Méthodes utilitaires
  getSchoolName(schoolId: string): string {
    const schools = this.schoolsStore.schools();
    const school = schools.find(s => s.id === schoolId);
    return school ? school.name : 'École inconnue';
  }

  getSchoolYearLabel(schoolYearId: string | null): string {
    if (!schoolYearId) return 'Non renseignée';
    
    const schoolYears = this.teacherAssignmentStore.schoolYears();
    const schoolYear = schoolYears.find(sy => sy.id === schoolYearId);
    return schoolYear ? schoolYear.label : 'Année inconnue';
  }

  getTotalGamesCount(subjectId: string | null | undefined): number {
    if (!subjectId) return 0;
    const stats = this.gamesStatsService.getStats(subjectId);
    return stats?.total || 0;
  }

  getSubjectName(subjectId: string): string {
    const subjects = this.teacherAssignmentStore.subjects();
    const subject = subjects.find(s => s.id === subjectId);
    return subject ? subject.name : 'Matière inconnue';
  }

  getAssignmentSubjectName(assignment: { subject?: { name?: string }; subject_id?: string } | null | undefined): string {
    const joinedName = assignment && assignment.subject && assignment.subject.name;
    if (joinedName && typeof joinedName === 'string') return joinedName;
    return assignment && assignment.subject_id ? this.getSubjectName(assignment.subject_id) : 'Matière inconnue';
  }

  getAssignmentSubjectType(assignment: { subject?: { type?: 'scolaire' | 'extra' | 'optionnelle' }; subject_id?: string } | null | undefined): 'scolaire' | 'extra' | 'optionnelle' | null {
    // Si le subject est déjà joint, utiliser directement son type
    if (assignment && assignment.subject && assignment.subject.type) {
      return assignment.subject.type;
    }
    // Sinon, chercher dans le store
    if (assignment && assignment.subject_id) {
      const subjects = this.teacherAssignmentStore.subjects();
      const subject = subjects.find(s => s.id === assignment.subject_id);
      return subject ? subject.type : null;
    }
    return null;
  }

  getSubjectTypeLabel(type: 'scolaire' | 'extra' | 'optionnelle'): string {
    const labels = {
      'scolaire': 'Scolaire',
      'extra': 'Extra-scolaire',
      'optionnelle': 'Optionnelle'
    };
    return labels[type] || type;
  }

  // Types de matières uniques disponibles dans les affectations
  readonly availableSubjectTypes = computed(() => {
    const assignments = this.teacherAssignments();
    const types = new Set<'scolaire' | 'extra' | 'optionnelle'>();
    
    assignments.forEach(assignment => {
      const type = this.getAssignmentSubjectType(assignment);
      if (type) {
        types.add(type);
      }
    });

    // Trier selon un ordre logique : scolaire, extra, optionnelle
    const typeOrder: Record<'scolaire' | 'extra' | 'optionnelle', number> = {
      'scolaire': 1,
      'extra': 2,
      'optionnelle': 3
    };
    
    return Array.from(types).sort((a, b) => typeOrder[a] - typeOrder[b]);
  });

  readonly getSchoolLevelLabel = getSchoolLevelLabel;

  // Méthode pour supprimer une affectation
  async onDeleteAssignment(assignmentId: string): Promise<void> {
    const assignment = this.filteredAssignments().find(a => a.id === assignmentId);
    if (!assignment) {
      console.error('Affectation non trouvée:', assignmentId);
      return;
    }

    // Vérifier si l'affectation est partagée avec d'autres professeurs
    let sharedAssignments: { assignment: TeacherAssignment; teacher: { id: string; fullname: string | null } }[] = [];
    try {
      const sharedResult = await firstValueFrom(this.infrastructure.getSharedAssignments(assignmentId));
      if (!sharedResult.error && sharedResult.sharedAssignments) {
        sharedAssignments = sharedResult.sharedAssignments;
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des affectations partagées:', error);
    }

    const hasSharedAssignments = sharedAssignments.length > 0;

    // Récupérer toutes les informations nécessaires
    const studentCount = this.getStudentCount(assignmentId);
    const categories = this.getCategoriesForAssignment(assignmentId);
    const categoriesCount = categories.length;
    
    // Calculer le nombre total de jeux
    let totalGamesCount = 0;
    if (assignment.subject_id) {
      totalGamesCount = this.getTotalGamesCount(assignment.subject_id);
    }
    
    // Récupérer les informations des catégories (sans additionner pour éviter les doublons)
    const categoriesInfo: { name: string; childrenCount: number; gamesCount: number }[] = [];
    categories.forEach(category => {
      const childrenCount = this.getChildrenCountForCategory(category.id);
      const gamesCount = this.getGamesForCategory(category.id).length;
      categoriesInfo.push({
        name: category.name,
        childrenCount,
        gamesCount
      });
    });

    // Construire le message détaillé
    let message = `⚠️ SUPPRESSION D'AFFECTATION\n\n`;
    
    message += `📊 CONTENU DE L'AFFECTATION :\n\n`;
    message += `👥 Nombre total d'enfants uniques : ${studentCount}\n`;
    message += `📁 Nombre de catégories (sous-catégories) : ${categoriesCount}\n`;
    message += `🎮 Nombre total de jeux : ${totalGamesCount}\n`;
    
    // Afficher les détails des catégories si elles existent
    if (categoriesCount > 0) {
      message += `\n📋 Détails par catégorie :\n`;
      categoriesInfo.forEach((cat, index) => {
        message += `  ${index + 1}. ${cat.name} : ${cat.childrenCount} enfant(s), ${cat.gamesCount} jeu(x)\n`;
      });
      message += `\n⚠️ Note : Un enfant peut être dans plusieurs catégories, le total unique est ${studentCount}\n`;
    }
    
    message += `\n⚠️ CONSÉQUENCES DE LA SUPPRESSION :\n\n`;
    message += `• Cette affectation sera définitivement supprimée\n`;
    
    // Adapter le message selon qu'il y a des affectations partagées ou non
    if (hasSharedAssignments) {
      const otherTeachersNames = sharedAssignments
        .map(sa => sa.teacher.fullname || 'Professeur sans nom')
        .join(', ');
      message += `• Cette affectation est partagée avec ${sharedAssignments.length} autre(s) professeur(s) : ${otherTeachersNames}\n`;
      if (studentCount > 0) {
        message += `• Les ${studentCount} enfant(s) resteront associés à cette matière via les autres affectations\n`;
      }
    } else {
      if (studentCount > 0) {
        message += `• ${studentCount} enfant(s) unique(s) ne seront plus associés à cette affectation\n`;
      }
    }
    
    if (categoriesCount > 0) {
      message += `• Les ${categoriesCount} catégorie(s) et leurs ${totalGamesCount} jeu(x) resteront dans la matière mais ne seront plus accessibles via cette affectation\n`;
    }
    message += `• Cette action est irréversible\n\n`;
    message += `Êtes-vous sûr de vouloir continuer ?`;

    if (!confirm(message)) return;
    this.teacherAssignmentStore.deleteAssignment(assignmentId);
  }

  // Méthode pour transférer une affectation
  onTransferAssignment(assignmentId: string): void {
    const assignment = this.teacherAssignments().find(a => a.id === assignmentId);
    if (!assignment) {
      console.error('Affectation non trouvée:', assignmentId);
      return;
    }
    this.selectedAssignmentForTransfer.set(assignment);
    this.showTransferDialog.set(true);
  }

  // Gérer la confirmation du transfert
  onTransferConfirm(data: TransferAssignmentData): void {
    const assignment = this.selectedAssignmentForTransfer();
    if (!assignment) return;

    const teacherId = this.getCurrentTeacherId();

    if (data.mode === 'transfer') {
      this.teacherAssignmentStore.transferAssignment({
        assignmentId: assignment.id,
        newTeacherId: data.newTeacherId
      });
    } else {
      this.teacherAssignmentStore.shareAssignment({
        assignmentId: assignment.id,
        newTeacherId: data.newTeacherId,
        teacherId: teacherId || undefined
      });
    }

    this.showTransferDialog.set(false);
    this.selectedAssignmentForTransfer.set(null);
  }

  // Gérer l'annulation du transfert
  onTransferCancel(): void {
    this.showTransferDialog.set(false);
    this.selectedAssignmentForTransfer.set(null);
  }

  // Obtenir l'ID du professeur actuel
  getCurrentTeacherId(): string | null {
    const teacher = this.teacherStore.teacher();
    return teacher?.id || null;
  }

  // Méthode pour effacer les erreurs
  clearError(): void {
    this.teacherAssignmentStore.clearError();
  }

  // Toggle l'expansion d'une affectation
  toggleAssignment(assignmentId: string): void {
    const expanded = this.expandedAssignments();
    const newExpanded = new Set(expanded);
    
    if (newExpanded.has(assignmentId)) {
      newExpanded.delete(assignmentId);
    } else {
      newExpanded.add(assignmentId);
      // Charger les données si pas encore chargées
      const assignment = this.filteredAssignments().find(a => a.id === assignmentId);
      if (assignment?.subject_id && !this.categoriesByAssignment().has(assignmentId)) {
        this.loadCategoriesForAssignment(assignmentId, assignment.subject_id!, assignment.school_id, assignment.school_level);
      }
    }
    
    this.expandedAssignments.set(newExpanded);
  }

  // Vérifier si une affectation est expandée
  isAssignmentExpanded(assignmentId: string): boolean {
    return this.expandedAssignments().has(assignmentId);
  }

  // Charger les sous-catégories pour une affectation
  // Utilise le cache pour éviter les appels redondants
  private loadCategoriesForAssignment(
    assignmentId: string,
    subjectId: string,
    schoolId: string | null,
    schoolLevel: string | null
  ): void {
    const loading = new Map(this.loadingCategories());
    loading.set(assignmentId, true);
    this.loadingCategories.set(loading);

    // Utiliser le service de cache qui évite les appels redondants
    this.categoriesCacheService.loadCategory(subjectId).subscribe(({ categories, error }: { categories: SubjectCategory[]; error: PostgrestError | null }) => {
      const loadingMap = new Map(this.loadingCategories());
      loadingMap.set(assignmentId, false);
      this.loadingCategories.set(loadingMap);

      if (error) {
        console.error('[AssignmentsSection] Erreur lors du chargement des sous-catégories:', error);
        return;
      }

      // Stocker les catégories
      const categoriesMap = new Map(this.categoriesByAssignment());
      categoriesMap.set(assignmentId, categories || []);
      this.categoriesByAssignment.set(categoriesMap);

      // Charger les jeux et comptes d'enfants pour chaque catégorie
      if (categories && categories.length > 0) {
        const gameObservables = categories.map((category: SubjectCategory) =>
          this.infrastructure.getGamesBySubject(subjectId, category.id).pipe(
            map(({ games, error: gamesError }) => ({
              categoryId: category.id,
              games: gamesError ? [] : (games || []),
            }))
          )
        );

        const currentTeacherId = this.getCurrentTeacherId();
        const countObservables = categories.map((category: SubjectCategory) =>
          this.infrastructure.countChildrenByCategory(category.id, schoolId, schoolLevel, currentTeacherId).pipe(
            map(({ count, error: countError }) => ({
              categoryId: category.id,
              count: countError ? 0 : count,
            }))
          )
        );

        forkJoin([...gameObservables, ...countObservables]).subscribe(results => {
          const gamesMap = new Map(this.gamesByCategory());
          const countsMap = new Map(this.childrenCountByCategory());

          results.forEach(result => {
            if ('games' in result) {
              gamesMap.set(result.categoryId, result.games);
            } else {
              countsMap.set(result.categoryId, result.count);
            }
          });

          this.gamesByCategory.set(gamesMap);
          this.childrenCountByCategory.set(countsMap);
        });
      }
    });
  }

  // Obtenir les catégories d'une affectation
  getCategoriesForAssignment(assignmentId: string): SubjectCategory[] {
    return this.categoriesByAssignment().get(assignmentId) || [];
  }

  // Obtenir les jeux d'une catégorie
  getGamesForCategory(categoryId: string): Game[] {
    return this.gamesByCategory().get(categoryId) || [];
  }

  // Obtenir le nombre d'enfants d'une catégorie
  getChildrenCountForCategory(categoryId: string): number {
    return this.childrenCountByCategory().get(categoryId) || 0;
  }

  // Vérifier si les catégories sont en cours de chargement
  isLoadingCategories(assignmentId: string): boolean {
    return this.loadingCategories().get(assignmentId) || false;
  }

  // Vérifier si une affectation a des catégories
  hasCategories(assignment: { subject_id?: string | null }): boolean {
    if (!assignment.subject_id) return false;
    return this.subjectsWithCategories().has(assignment.subject_id);
  }

  // Ouvrir le modal des enfants pour une catégorie
  openChildrenModal(category: SubjectCategory, assignment: TeacherAssignment): void {
    this.selectedCategoryForChildren.set({
      id: category.id,
      name: category.name,
      schoolId: assignment.school_id || null,
      schoolLevel: assignment.school_level || null
    });
    this.selectedSubjectForChildren.set(null);
    this.showChildrenModal.set(true);
  }

  // Ouvrir le modal des enfants pour une affectation (sujet)
  openChildrenModalForAssignment(assignment: TeacherAssignment): void {
    if (!assignment.subject_id) return;
    
    const subjectName = this.getAssignmentSubjectName(assignment);
    this.selectedSubjectForChildren.set({
      id: assignment.subject_id,
      name: subjectName,
      schoolId: assignment.school_id || null,
      schoolLevel: assignment.school_level || null
    });
    this.selectedCategoryForChildren.set(null);
    this.showChildrenModal.set(true);
  }

  // Fermer le modal des enfants
  closeChildrenModal(): void {
    this.showChildrenModal.set(false);
    this.selectedCategoryForChildren.set(null);
    this.selectedSubjectForChildren.set(null);
  }

  // Ouvrir le modal du professeur
  openTeacherModal(teacher: { id: string; fullname: string | null }, assignment: TeacherAssignment): void {
    const subjectName = this.getAssignmentSubjectName(assignment);
    this.selectedTeacher.set({
      id: teacher.id,
      fullname: teacher.fullname,
      subjectId: assignment.subject_id || null,
      subjectName: subjectName,
      schoolId: assignment.school_id || null,
      schoolLevel: assignment.school_level || null
    });
    this.showTeacherModal.set(true);
  }

  // Fermer le modal du professeur
  closeTeacherModal(): void {
    this.showTeacherModal.set(false);
    this.selectedTeacher.set(null);
  }

  // Obtenir les autres professeurs d'une matière
  getOtherTeachersForSubject(subjectId: string | null | undefined): { id: string; fullname: string | null }[] {
    if (!subjectId) return [];
    return this.otherTeachersBySubject().get(subjectId) || [];
  }

}

