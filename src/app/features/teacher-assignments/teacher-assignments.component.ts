import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TeacherAssignmentStore } from './store/index';
import { Application } from './components/application/application';
import { TeacherService } from '../teacher/services/teacher/teacher.service';
import { ErrorSnackbarService } from '../../services/snackbar/error-snackbar.service';
import type { SchoolYear } from './types/school';
import { SchoolYearSelectComponent } from '../../shared/components/school-year-select/school-year-select.component';

@Component({
  selector: 'app-teacher-assignments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SchoolYearSelectComponent],
  templateUrl: './teacher-assignments.component.html',
  styleUrl: './teacher-assignments.component.scss'
})
export class TeacherAssignmentsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly application = inject(Application);
  private readonly teacherService = inject(TeacherService);
  private readonly errorSnackbarService = inject(ErrorSnackbarService);
  readonly store = inject(TeacherAssignmentStore);

  // Signals pour contrôler l'affichage
  readonly showAssignmentForm = signal(false);
  readonly showCreateSchool = signal(false);
  readonly showCreateSubject = signal(false);
  readonly creatingSchool = signal(false);
  readonly creatingSubject = signal(false);
  readonly teacherId = signal<string | null>(null);

  // Forms
  assignmentForm!: FormGroup;
  schoolForm!: FormGroup;
  subjectForm!: FormGroup;

  readonly schoolYears = computed(() => this.store.schoolYears());

  // Computed signals
  readonly schools = computed(() => this.store.schools());
  readonly subjects = computed(() => this.store.subjects());
  readonly assignments = computed(() => this.store.assignments());
  readonly hasAssignments = computed(() => this.store.hasAssignments());
  readonly isLoading = computed(() => this.store.isLoading());

  constructor() {
    // Charger les affectations quand le teacherId est disponible
    effect(() => {
      const tid = this.teacherId();
      if (tid) {
        this.application.loadAssignments(tid);
      }
    });
  }

  ngOnInit(): void {
    this.initializeForms();
    this.loadInitialData();
    this.loadTeacherId();
  }

  private loadTeacherId(): void {
    // Récupérer le teacher_id depuis le service
    this.teacherService.getTeacherProfile().subscribe({
      next: (teacher) => {
        if (teacher) {
          this.teacherId.set(teacher.id);
        } else {
          this.errorSnackbarService.showError('Profil professeur non trouvé. Veuillez d\'abord créer votre profil.');
        }
      },
      error: (error) => {
        console.error('Error loading teacher profile:', error);
        this.errorSnackbarService.showError('Erreur lors du chargement du profil professeur');
      }
    });
  }

  private initializeForms(): void {
    this.assignmentForm = this.fb.group({
      school_id: ['', Validators.required],
      school_year_id: ['', Validators.required],
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

  // Gestion des affectations
  onSchoolChange(schoolId: string): void {
    if (schoolId) {
      this.loadSchoolYears(schoolId);
    } else {
      this.assignmentForm.patchValue({ school_year_id: '' });
    }
  }

  loadSchoolYears(schoolId: string): void {
    this.application.loadSchoolYears(schoolId);
  }

  onCreateSchool(): void {
    if (this.schoolForm.valid) {
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
  }

  onCreateSubject(): void {
    if (this.subjectForm.valid) {
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
      // Recharger les matières après création
      this.application.loadSubjects();
    }
  }

  onSubmitAssignment(): void {
    if (this.assignmentForm.valid && this.teacherId()) {
      const formValue = this.assignmentForm.value;
      const assignmentData = {
        teacher_id: this.teacherId()!,
        school_id: formValue.school_id || null,
        school_year_id: formValue.school_year_id || null,
        subject_id: formValue.subject_id,
      };
      
      this.application.createAssignment(assignmentData);
      this.assignmentForm.reset();
      this.showAssignmentForm.set(false);
      
      // Recharger les affectations
      if (this.teacherId()) {
        this.application.loadAssignments(this.teacherId()!);
      }
    }
  }

  onDeleteAssignment(assignmentId: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette affectation ?')) {
      this.application.deleteAssignment(assignmentId);
      // Recharger les affectations
      if (this.teacherId()) {
        this.application.loadAssignments(this.teacherId()!);
      }
    }
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

