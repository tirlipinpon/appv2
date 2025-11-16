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
    this.application.loadSubjects();
  }

  onSchoolChange(schoolId: string): void {
    if (schoolId) {
      this.currentSchoolId.set(schoolId || null);
    } else {
      this.currentSchoolId.set(null);
      this.assignmentForm.patchValue({ school_level: '' });
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
    this.application.loadSubjects();
  }

  onSubmitAssignment(): void {
    if (!(this.assignmentForm.valid && this.teacherId())) return;
    const formValue = this.assignmentForm.value;
    const isUuid = (v: unknown) =>
      typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    const assignmentData = {
      teacher_id: this.teacherId()!,
      school_id: formValue.school_id || null,
      school_level: formValue.school_level || null,
      subject_id: formValue.subject_id,
    };
    this.application.createAssignment(assignmentData);
    this.assignmentForm.reset();
    this.showAssignmentForm.set(false);
    if (this.teacherId()) this.application.loadAssignments(this.teacherId()!);
  }

  onDeleteAssignment(assignmentId: string): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette affectation ?')) return;
    this.application.deleteAssignment(assignmentId);
    if (this.teacherId()) this.application.loadAssignments(this.teacherId()!);
  }

  getSchoolName(schoolId: string): string {
    const school = this.schools().find(s => s.id === schoolId);
    return school ? school.name : 'École inconnue';
  }

  getSubjectName(subjectId: string): string {
    const subject = this.subjects().find(s => s.id === subjectId);
    return subject ? subject.name : 'Matière inconnue';
  }
}

