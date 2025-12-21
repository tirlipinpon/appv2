import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TeacherAssignmentStore } from '../../../../store/assignments.store';
import { TeacherStore } from '../../../../store/index';
import { GamesStatsDisplayComponent } from '../../../../../../shared/components/games-stats-display/games-stats-display.component';
import { TransferAssignmentDialogComponent, TransferAssignmentData, TeacherAssignmentWithJoins } from '../transfer-assignment-dialog/transfer-assignment-dialog.component';
import { getSchoolLevelLabel, SCHOOL_LEVELS } from '../../../../utils/school-levels.util';
import type { TeacherAssignment } from '../../../../types/teacher-assignment';

@Component({
  selector: 'app-assignments-section',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    GamesStatsDisplayComponent,
    TransferAssignmentDialogComponent
  ],
  templateUrl: './assignments-section.component.html',
  styleUrl: './assignments-section.component.scss'
})
export class AssignmentsSectionComponent {
  readonly teacherAssignmentStore = inject(TeacherAssignmentStore);
  readonly teacherStore = inject(TeacherStore);

  // Signals pour les affectations
  readonly teacherAssignments = computed(() => this.teacherAssignmentStore.assignments());
  readonly hasAssignments = computed(() => this.teacherAssignmentStore.hasAssignments());
  readonly hasError = computed(() => this.teacherAssignmentStore.hasError());
  readonly error = computed(() => this.teacherAssignmentStore.error());

  // Signal pour gérer l'affichage du dialog de transfert
  readonly showTransferDialog = signal<boolean>(false);
  readonly selectedAssignmentForTransfer = signal<TeacherAssignmentWithJoins | null>(null);

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

  // Méthodes utilitaires
  getSchoolName(schoolId: string): string {
    const schools = this.teacherAssignmentStore.schools();
    const school = schools.find(s => s.id === schoolId);
    return school ? school.name : 'École inconnue';
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
}

