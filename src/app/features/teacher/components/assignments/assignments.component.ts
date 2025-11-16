import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TeacherAssignmentStore } from '../../store/assignments.store';
import { Application } from '../../components/application/application';
import { TeacherService } from '../../services/teacher/teacher.service';
import { ErrorSnackbarService } from '../../../../services/snackbar/error-snackbar.service';
import { SchoolLevelSelectComponent } from '../../../../shared/components/school-level-select/school-level-select.component';

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
      this.tryLoadSubjectsForSelection();
    });
    this.assignmentForm.get('school_id')?.valueChanges.subscribe((val) => {
      console.log('[AssignmentsComponent] school_id changed', val);
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
      this.assignmentForm.patchValue({ school_level: '' });
    }
    this.tryLoadSubjectsForSelection();
  }

  private tryLoadSubjectsForSelection(): void {
    const schoolId = this.assignmentForm.get('school_id')?.value;
    const schoolLevel = this.assignmentForm.get('school_level')?.value;
    console.log('[AssignmentsComponent] tryLoadSubjectsForSelection', { schoolId, schoolLevel });
    if (schoolId && schoolLevel) {
      console.log('[AssignmentsComponent] loadSubjectsForSchoolLevel → call', { schoolId, schoolLevel });
      this.application.loadSubjectsForSchoolLevel(schoolId, schoolLevel);
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
    this.application.createSubject({
      name: formValue.name,
      description: formValue.description || null,
      type: formValue.type,
      default_age_range: null,
      metadata: null,
    });
    this.creatingSubject.set(false);
    this.showCreateSubject.set(false);
    this.subjectForm.reset();
    // Recharger la liste des matières selon l'école+niveau sélectionnés
    this.tryLoadSubjectsForSelection();
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

  getSchoolName(schoolId: string): string {
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

