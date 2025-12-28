import { Component, Input, Output, EventEmitter, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SchoolLevelSelectComponent } from '../../../../../../shared/components/school-level-select/school-level-select.component';
import { Infrastructure } from '../../../infrastructure/infrastructure';
import { Application } from '../../../application/application';
import { ErrorSnackbarService } from '../../../../../../shared/services/snackbar/error-snackbar.service';
import { TeacherAssignmentStore } from '../../../../store/assignments.store';
import type { School } from '../../../../types/school';
import type { Subject } from '../../../../types/subject';

@Component({
  selector: 'app-add-assignment-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SchoolLevelSelectComponent],
  templateUrl: './add-assignment-dialog.component.html',
  styleUrl: './add-assignment-dialog.component.scss'
})
export class AddAssignmentDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly infrastructure = inject(Infrastructure);
  private readonly application = inject(Application);
  private readonly errorSnackbarService = inject(ErrorSnackbarService);
  private readonly store = inject(TeacherAssignmentStore);

  @Input() teacherId: string | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() assignmentCreated = new EventEmitter<void>();

  // Forms
  assignmentForm!: FormGroup;
  schoolForm!: FormGroup;
  subjectForm!: FormGroup;

  // Signals UI
  readonly showCreateSchool = signal(false);
  readonly showCreateSubject = signal(false);
  readonly creatingSchool = signal(false);
  readonly creatingSubject = signal(false);

  // Computed
  readonly schools = computed(() => this.store.schools());
  readonly subjects = computed(() => this.store.subjects());
  readonly assignments = computed(() => this.store.assignments());
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

  ngOnInit(): void {
    this.initializeForms();
    this.loadInitialData();
  }

  private initializeForms(): void {
    this.assignmentForm = this.fb.group({
      school_id: ['', Validators.required],
      school_level: ['', Validators.required],
      subject_id: ['', Validators.required],
    });
    this.assignmentForm.get('school_level')?.valueChanges.subscribe((val) => {
      // Réinitialiser la matière quand on change le niveau
      this.assignmentForm.patchValue({ subject_id: '' });
      this.tryLoadSubjectsForSelection();
    });
    this.assignmentForm.get('school_id')?.valueChanges.subscribe((val) => {
      if (val) {
        // Réinitialiser le niveau et la matière quand on change d'école
        this.assignmentForm.patchValue({ 
          school_level: '',
          subject_id: '' 
        });
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
  }

  onSchoolChange(schoolId: string): void {
    // Le listener valueChanges s'occupe du reste
  }

  private tryLoadSubjectsForSelection(): void {
    const schoolId = this.assignmentForm.get('school_id')?.value;
    const schoolLevel = this.assignmentForm.get('school_level')?.value;
    
    if (schoolId && schoolLevel) {
      this.application.loadSubjectsForSchoolLevel(schoolId, schoolLevel);
    } else {
      this.store.clearSubjects();
    }
  }

  onCreateSchool(): void {
    if (!this.schoolForm.valid) return;
    this.creatingSchool.set(true);
    const formValue = this.schoolForm.value;
    this.infrastructure.createSchool({
      name: formValue.name,
      address: formValue.address || null,
      city: formValue.city || null,
      country: formValue.country || null,
      metadata: null,
    }).subscribe(({ school, error }) => {
      this.creatingSchool.set(false);
      if (error) {
        this.errorSnackbarService.showError(error.message || 'Erreur lors de la création de l\'école');
        return;
      }
      if (school) {
        this.assignmentForm.patchValue({ school_id: school.id });
        this.application.loadSchools();
      }
      this.showCreateSchool.set(false);
      this.schoolForm.reset();
    });
  }

  onCreateSubject(): void {
    if (!this.subjectForm.valid) return;
    this.creatingSubject.set(true);
    const formValue = this.subjectForm.value;
    const schoolId: string | null = this.assignmentForm.get('school_id')?.value || null;
    const schoolLevel: string | null = this.assignmentForm.get('school_level')?.value || null;

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
          this.tryLoadSubjectsForSelection();
          if (subject) {
            this.assignmentForm.patchValue({ subject_id: subject.id });
          }
          this.creatingSubject.set(false);
          this.showCreateSubject.set(false);
          this.subjectForm.reset();
        });
      } else {
        if (subject && (formValue.type === 'extra' || formValue.type === 'optionnelle')) {
          this.tryLoadSubjectsForSelection();
          this.assignmentForm.patchValue({ subject_id: subject.id });
        } else if (subject) {
          this.assignmentForm.patchValue({ subject_id: subject.id });
        }
        this.creatingSubject.set(false);
        this.showCreateSubject.set(false);
        this.subjectForm.reset();
      }
    });
  }

  onSubmitAssignment(): void {
    if (!(this.assignmentForm.valid && this.teacherId)) return;
    const formValue = this.assignmentForm.value;
    const assignmentData = {
      teacher_id: this.teacherId!,
      school_id: formValue.school_id || null,
      school_level: formValue.school_level || null,
      subject_id: formValue.subject_id,
    };

    // Empêcher les doublons
    const exists = this.assignments().some(a =>
      a.teacher_id === assignmentData.teacher_id &&
      a.school_id === assignmentData.school_id &&
      a.school_level === assignmentData.school_level &&
      a.subject_id === assignmentData.subject_id
    );
    if (exists) {
      this.errorSnackbarService.showError('Cette affectation existe déjà (école + niveau + matière).');
      return;
    }

    const isAllowedSubject = this.subjects().some(s => s.id === assignmentData.subject_id);
    if (!isAllowedSubject) {
      this.errorSnackbarService.showError('La matière sélectionnée n\'est pas disponible pour ce niveau dans cette école.');
      return;
    }
    
    this.application.createAssignment(assignmentData);
    this.assignmentForm.reset();
    this.assignmentCreated.emit();
    this.close.emit();
    if (this.teacherId) this.application.loadAssignments(this.teacherId);
  }

  onCancel(): void {
    this.close.emit();
  }

  getSchoolName(schoolId: string): string {
    const school = this.schools().find(s => s.id === schoolId);
    return school ? school.name : 'École inconnue';
  }

  getAssignmentSubjectName(assignment: { subject?: { name?: string }; subject_id?: string } | null | undefined): string {
    const joinedName = assignment && assignment.subject && assignment.subject.name;
    if (joinedName && typeof joinedName === 'string') return joinedName;
    const subject = assignment && assignment.subject_id ? this.subjects().find(s => s.id === assignment.subject_id) : null;
    return subject ? subject.name : 'Matière inconnue';
  }
}

