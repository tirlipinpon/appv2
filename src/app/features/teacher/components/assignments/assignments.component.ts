import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TeacherAssignmentStore } from '../../store/assignments.store';
import { Application } from '../../components/application/application';
import { TeacherService } from '../../services/teacher/teacher.service';
import { ErrorSnackbarService } from '../../../../services/snackbar/error-snackbar.service';
import { SchoolLevelSelectComponent } from '../../../../shared/components/school-level-select/school-level-select.component';
import { Infrastructure } from '../infrastructure/infrastructure';
import type { TeacherAssignment } from '../../types/teacher-assignment';

@Component({
  selector: 'app-assignments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SchoolLevelSelectComponent],
  templateUrl: './assignments.component.html',
  styleUrl: './assignments.component.scss'
})
export class AssignmentsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly application = inject(Application);
  private readonly infrastructure = inject(Infrastructure);
  private readonly teacherService = inject(TeacherService);
  private readonly errorSnackbarService = inject(ErrorSnackbarService);
  readonly store = inject(TeacherAssignmentStore);

  // Signals UI
  readonly showAssignmentForm = signal(false);
  readonly showCreateSchool = signal(false);
  readonly showCreateSubject = signal(false);
  readonly creatingSchool = signal(false);
  readonly creatingSubject = signal(false);
  readonly teacherId = signal<string | null>(null);
  readonly currentSchoolId = signal<string | null>(null);

  // Forms
  assignmentForm!: FormGroup;
  schoolForm!: FormGroup;
  subjectForm!: FormGroup;

  // Computed
  readonly schools = computed(() => this.store.schools());
  readonly subjects = computed(() => this.store.subjects());
  readonly assignments = computed(() => this.store.assignments());
  readonly hasAssignments = computed(() => this.store.hasAssignments());
  readonly isLoading = computed(() => this.store.isLoading());

  // Affichage "affectées / non affectées" pour l'école + niveau sélectionnés
  readonly selectedSchoolId = computed<string | null>(() => this.assignmentForm ? (this.assignmentForm.get('school_id')?.value || null) : null);
  readonly selectedSchoolLevel = computed<string | null>(() => this.assignmentForm ? (this.assignmentForm.get('school_level')?.value || null) : null);

  readonly assignmentsForSelection = computed(() => {
    const sid = this.selectedSchoolId();
    const lvl = this.selectedSchoolLevel();
    if (!sid || !lvl) return [];
    return this.assignments().filter(a => a.school_id === sid && a.school_level === lvl);
  });

  readonly assignedSubjectIdsForSelection = computed<Set<string>>(() => {
    const set = new Set<string>();
    this.assignmentsForSelection().forEach(a => { if (a.subject_id) set.add(a.subject_id); });
    return set;
  });

  readonly unassignedSubjectsForSelection = computed(() => {
    const assignedIds = this.assignedSubjectIdsForSelection();
    return this.subjects().filter(s => !assignedIds.has(s.id));
  });

  constructor() {
    effect(() => {
      const tid = this.teacherId();
      if (tid) this.application.loadAssignments(tid);
    });
  }

  ngOnInit(): void {
    this.initializeForms();
    this.loadInitialData();
    this.loadTeacherId();
    const initSchoolId = this.assignmentForm.get('school_id')?.value || null;
    this.currentSchoolId.set(initSchoolId);
    // S'assurer que la liste des matières est vide au démarrage
    this.store.clearSubjects();
  }

  private loadTeacherId(): void {
    this.teacherService.getTeacherProfile().subscribe({
      next: (teacher) => {
        if (teacher) this.teacherId.set(teacher.id);
        else this.errorSnackbarService.showError('Profil professeur non trouvé. Veuillez d\'abord créer votre profil.');
      },
      error: () => this.errorSnackbarService.showError('Erreur lors du chargement du profil professeur'),
    });
  }

  private initializeForms(): void {
    this.assignmentForm = this.fb.group({
      school_id: ['', Validators.required],
      school_level: ['', Validators.required],
      subject_id: ['', Validators.required],
    });
    this.assignmentForm.get('school_level')?.valueChanges.subscribe((val) => {
      console.log('[AssignmentsComponent] school_level changed', val);
      // Réinitialiser la matière quand on change le niveau
      this.assignmentForm.patchValue({ subject_id: '' });
      this.tryLoadSubjectsForSelection();
    });
    this.assignmentForm.get('school_id')?.valueChanges.subscribe((val) => {
      console.log('[AssignmentsComponent] school_id changed', val);
      if (val) {
        // Réinitialiser le niveau et la matière quand on change d'école
        this.assignmentForm.patchValue({ 
          school_level: '',
          subject_id: '' 
        });
        // Vider la liste des matières
        this.store.clearSubjects();
      } else {
        this.store.clearSubjects();
      }
      this.tryLoadSubjectsForSelection();
    });
    this.schoolForm = this.fb.group({
      name: ['', Validators.required],
      address: [''],
      city: [''],
      country: [''],
    });
    this.subjectForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      type: ['scolaire', Validators.required],
    });
  }

  private loadInitialData(): void {
    this.application.loadSchools();
    // Ne pas charger toutes les matières ici pour éviter d’écraser la liste filtrée
  }

  onSchoolChange(schoolId: string): void {
    console.log('[AssignmentsComponent] onSchoolChange', { schoolId });
    if (schoolId) {
      this.currentSchoolId.set(schoolId || null);
    } else {
      this.currentSchoolId.set(null);
    }
    // Le listener valueChanges s'occupe du reste
  }

  private tryLoadSubjectsForSelection(): void {
    const schoolId = this.assignmentForm.get('school_id')?.value;
    const schoolLevel = this.assignmentForm.get('school_level')?.value;
    console.log('[AssignmentsComponent] tryLoadSubjectsForSelection', { schoolId, schoolLevel });
    
    if (schoolId && schoolLevel) {
      console.log('[AssignmentsComponent] loadSubjectsForSchoolLevel → call', { schoolId, schoolLevel });
      this.application.loadSubjectsForSchoolLevel(schoolId, schoolLevel);
    } else {
      // Si pas d'école ou niveau, vider la liste des matières
      this.store.clearSubjects();
    }
  }

  onCreateSchool(): void {
    if (!this.schoolForm.valid) return;
    this.creatingSchool.set(true);
    const formValue = this.schoolForm.value;
    this.application.createSchool({
      name: formValue.name,
      address: formValue.address || null,
      city: formValue.city || null,
      country: formValue.country || null,
      metadata: null,
    });
    this.creatingSchool.set(false);
    this.showCreateSchool.set(false);
    this.schoolForm.reset();
  }

  onCreateSubject(): void {
    if (!this.subjectForm.valid) return;
    this.creatingSubject.set(true);
    const formValue = this.subjectForm.value;
    const schoolId: string | null = this.assignmentForm.get('school_id')?.value || null;
    const schoolLevel: string | null = this.assignmentForm.get('school_level')?.value || null;

    // Créer la matière puis, si possible, créer le lien École+Niveau
    this.infrastructure.createSubject({
      name: formValue.name,
      description: formValue.description || null,
      type: formValue.type,
      default_age_range: null,
      metadata: null,
    }).subscribe(({ subject, error }) => {
      if (error) {
        this.errorSnackbarService.showError(error.message || 'Erreur lors de la création de la matière');
        this.creatingSubject.set(false);
        return;
      }
      if (subject && schoolId && schoolLevel) {
        this.infrastructure.addSubjectLink({
          subject_id: subject.id,
          school_id: schoolId,
          school_level: schoolLevel,
          required: true,
        }).subscribe(({ error: linkError }) => {
          if (linkError) {
            this.errorSnackbarService.showError(linkError.message || 'Erreur lors de l\'association matière ↔ école/niveau');
          }
          // Attendre un peu pour s'assurer que le lien est bien créé avant de recharger
          setTimeout(() => {
            // Recharger la liste filtrée
            this.tryLoadSubjectsForSelection();
            this.creatingSubject.set(false);
            this.showCreateSubject.set(false);
            this.subjectForm.reset();
          }, 300);
        });
      } else {
        // Pas d'école/niveau sélectionnés: ajouter la matière au store directement si elle est de type 'extra' ou 'optionnelle'
        if (subject && (formValue.type === 'extra' || formValue.type === 'optionnelle')) {
          // Les matières extra/optionnelle sont globales, elles apparaîtront dans la liste
          // Recharger la liste filtrée pour les inclure
          setTimeout(() => {
            this.tryLoadSubjectsForSelection();
          }, 300);
        }
        this.creatingSubject.set(false);
        this.showCreateSubject.set(false);
        this.subjectForm.reset();
      }
    });
  }

  onSubmitAssignment(): void {
    if (!(this.assignmentForm.valid && this.teacherId())) return;
    const formValue = this.assignmentForm.value;
    const assignmentData = {
      teacher_id: this.teacherId()!,
      school_id: formValue.school_id || null,
      school_level: formValue.school_level || null,
      subject_id: formValue.subject_id,
    };
    console.log('[AssignmentsComponent] onSubmitAssignment payload', assignmentData);

    // Empêcher les doublons (même école + niveau + matière) pour ce professeur
    const exists = this.assignments().some(a =>
      a.teacher_id === assignmentData.teacher_id &&
      a.school_id === assignmentData.school_id &&
      a.school_level === assignmentData.school_level &&
      a.subject_id === assignmentData.subject_id
    );
    if (exists) {
      console.warn('[AssignmentsComponent] duplicate assignment detected', assignmentData);
      this.errorSnackbarService.showError('Cette affectation existe déjà (école + niveau + matière).');
      return;
    }

    const isAllowedSubject = this.subjects().some(s => s.id === assignmentData.subject_id);
    if (!isAllowedSubject) {
      console.warn('[AssignmentsComponent] subject not allowed for selection', {
        selectedSubjectId: assignmentData.subject_id,
        availableSubjectIds: this.subjects().map(s => s.id),
      });
      this.errorSnackbarService.showError('La matière sélectionnée n\'est pas disponible pour ce niveau dans cette école.');
      return;
    }
    this.application.createAssignment(assignmentData);
    this.assignmentForm.reset();
    this.showAssignmentForm.set(false);
    if (this.teacherId()) this.application.loadAssignments(this.teacherId()!);
  }

  onDeleteAssignment(assignmentId: string): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette affectation ?')) return;
    this.application.deleteAssignment(assignmentId);
  }

  getSchoolName(schoolId: string, assignment?: TeacherAssignment | { school?: { name?: string } }): string {
    // Utiliser la jointure si présente dans l'assignment
    if (assignment && 'school' in assignment && assignment.school && assignment.school.name) {
      return assignment.school.name;
    }
    // Sinon, chercher dans le store
    const school = this.schools().find(s => s.id === schoolId);
    return school ? school.name : 'École inconnue';
  }

  getSubjectName(subjectId: string): string {
    const subject = this.subjects().find(s => s.id === subjectId);
    return subject ? subject.name : 'Matière inconnue';
  }

  getAssignmentSubjectName(assignment: { subject?: { name?: string }; subject_id?: string } | null | undefined): string {
    const joinedName = assignment && assignment.subject && assignment.subject.name;
    if (joinedName && typeof joinedName === 'string') return joinedName;
    return assignment && assignment.subject_id ? this.getSubjectName(assignment.subject_id) : 'Matière inconnue';
  }
}

