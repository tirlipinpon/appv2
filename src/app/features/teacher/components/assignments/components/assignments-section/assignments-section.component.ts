import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TeacherAssignmentStore } from '../../../../store/assignments.store';
import { TeacherStore } from '../../../../store/index';
import { GamesStatsDisplayComponent } from '../../../../../../shared/components/games-stats-display/games-stats-display.component';
import { GamesStatsService } from '../../../../../../shared/services/games-stats/games-stats.service';
import { TransferAssignmentDialogComponent, TransferAssignmentData, TeacherAssignmentWithJoins } from '../transfer-assignment-dialog/transfer-assignment-dialog.component';
import { ChildrenListModalComponent } from '../children-list-modal/children-list-modal.component';
import { getSchoolLevelLabel, SCHOOL_LEVELS } from '../../../../utils/school-levels.util';
import type { TeacherAssignment } from '../../../../types/teacher-assignment';
import type { SubjectCategory } from '../../../../types/subject';
import type { Game } from '../../../../types/game';
import { Infrastructure } from '../../../../components/infrastructure/infrastructure';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-assignments-section',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTooltipModule,
    GamesStatsDisplayComponent,
    TransferAssignmentDialogComponent,
    ChildrenListModalComponent
  ],
  templateUrl: './assignments-section.component.html',
  styleUrl: './assignments-section.component.scss'
})
export class AssignmentsSectionComponent {
  readonly teacherAssignmentStore = inject(TeacherAssignmentStore);
  readonly teacherStore = inject(TeacherStore);
  private readonly infrastructure = inject(Infrastructure);
  private readonly gamesStatsService = inject(GamesStatsService);

  // Signal pour stocker le nombre d'enfants par affectation
  readonly studentCounts = signal<Map<string, number>>(new Map());

  // Signals pour les sous-catégories, jeux et comptes d'enfants par affectation
  readonly expandedAssignments = signal<Set<string>>(new Set());
  readonly categoriesByAssignment = signal<Map<string, SubjectCategory[]>>(new Map());
  readonly gamesByCategory = signal<Map<string, Game[]>>(new Map());
  readonly childrenCountByCategory = signal<Map<string, number>>(new Map());
  readonly loadingCategories = signal<Map<string, boolean>>(new Map());
  readonly subjectsWithCategories = signal<Set<string>>(new Set()); // IDs des matières qui ont des catégories

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

  // Filtre par école
  readonly selectedSchoolId = signal<string | null>(null); // null = toutes les écoles

  // Filtre par niveau
  readonly selectedLevel = signal<string | null>(null); // null = tous les niveaux

  // Liste des écoles uniques depuis les affectations
  readonly uniqueSchools = computed(() => {
    const assignments = this.teacherAssignments();
    const schools = this.teacherAssignmentStore.schools();
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

  // Affectations filtrées par école et niveau
  readonly filteredAssignments = computed(() => {
    const assignments = this.teacherAssignments();
    const schoolId = this.selectedSchoolId();
    const level = this.selectedLevel();

    let filtered = assignments;

    if (schoolId) {
      filtered = filtered.filter(a => a.school_id === schoolId);
    }

    if (level) {
      filtered = filtered.filter(a => a.school_level === level);
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
    if (assignments.length === 0) {
      this.studentCounts.set(new Map());
      return;
    }

    // Charger tous les comptes en parallèle
    const countObservables = assignments
      .filter(a => a.subject_id)
      .map(assignment => 
        this.infrastructure.countStudentsBySubject(
          assignment.subject_id!,
          assignment.school_id,
          assignment.school_level
        ).pipe(
          map(({ count, error }) => ({
            assignmentId: assignment.id,
            count: error ? 0 : count
          }))
        )
      );

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
      this.gamesStatsService.loadStatsForSubjects(subjectIds);
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

  // Effect pour vérifier quelles matières ont des catégories
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

    // Charger les catégories pour chaque matière pour vérifier leur existence
    const categoryObservables = subjectIds.map(subjectId =>
      this.infrastructure.getCategoriesBySubject(subjectId).pipe(
        map(({ categories, error }) => ({
          subjectId,
          hasCategories: !error && categories && categories.length > 0
        }))
      )
    );

    forkJoin(categoryObservables).subscribe(results => {
      const subjectsWithCats = new Set<string>();
      results.forEach(({ subjectId, hasCategories }) => {
        if (hasCategories) {
          subjectsWithCats.add(subjectId);
        }
      });
      this.subjectsWithCategories.set(subjectsWithCats);
    });
  });

  // Méthode pour obtenir le nombre d'enfants d'une affectation
  // Inclut les enfants inscrits directement à la matière + ceux inscrits via les sous-catégories
  getStudentCount(assignmentId: string): number {
    const directCount = this.studentCounts().get(assignmentId) || 0;
    
    // Si les catégories sont chargées, ajouter les enfants des sous-catégories
    const categories = this.getCategoriesForAssignment(assignmentId);
    if (categories.length > 0) {
      // Récupérer tous les enfants uniques des sous-catégories
      // Note: on utilise un Set pour éviter les doublons si un enfant est inscrit à plusieurs sous-catégories
      const categoryChildrenCounts = categories.map(cat => 
        this.getChildrenCountForCategory(cat.id)
      );
      const totalCategoryChildren = categoryChildrenCounts.reduce((sum, count) => sum + count, 0);
      
      // Retourner le maximum entre le nombre direct et le nombre via catégories
      // car un enfant peut être inscrit directement ET via une catégorie
      // Pour éviter les doublons, on prend le max (approximation)
      // Une meilleure solution serait de récupérer les IDs uniques, mais cela nécessiterait plus de requêtes
      return Math.max(directCount, totalCategoryChildren);
    }
    
    return directCount;
  }

  // Méthodes utilitaires
  getSchoolName(schoolId: string): string {
    const schools = this.teacherAssignmentStore.schools();
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

  readonly getSchoolLevelLabel = getSchoolLevelLabel;

  // Méthode pour supprimer une affectation
  onDeleteAssignment(assignmentId: string): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette affectation ?')) return;
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
  private loadCategoriesForAssignment(
    assignmentId: string,
    subjectId: string,
    schoolId: string | null,
    schoolLevel: string | null
  ): void {
    const loading = new Map(this.loadingCategories());
    loading.set(assignmentId, true);
    this.loadingCategories.set(loading);

    this.infrastructure.getCategoriesBySubject(subjectId).subscribe(({ categories, error }) => {
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
        const gameObservables = categories.map(category =>
          this.infrastructure.getGamesBySubject(subjectId, category.id).pipe(
            map(({ games, error: gamesError }) => ({
              categoryId: category.id,
              games: gamesError ? [] : (games || []),
            }))
          )
        );

        const countObservables = categories.map(category =>
          this.infrastructure.countChildrenByCategory(category.id, schoolId, schoolLevel).pipe(
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
    this.showChildrenModal.set(true);
  }

  // Fermer le modal des enfants
  closeChildrenModal(): void {
    this.showChildrenModal.set(false);
    this.selectedCategoryForChildren.set(null);
  }
}

