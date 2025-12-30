import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { Subject as RxSubject } from 'rxjs';
import type { TeacherAssignment } from '../../../../types/teacher-assignment';
import type { Teacher } from '../../../../types/teacher';
import type { Subject as SubjectType } from '../../../../types/subject';
import type { School } from '../../../../types/school';
import { Infrastructure } from '../../../infrastructure/infrastructure';
import { getSchoolLevelLabel } from '../../../../utils/school-levels.util';

export interface TransferAssignmentData {
  mode: 'transfer' | 'share';
  newTeacherId: string;
}

// Type étendu pour inclure les jointures Supabase
export interface TeacherAssignmentWithJoins extends TeacherAssignment {
  subject?: SubjectType;
  school?: School;
}

@Component({
  selector: 'app-transfer-assignment-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './transfer-assignment-dialog.component.html',
  styleUrls: ['./transfer-assignment-dialog.component.scss']
})
export class TransferAssignmentDialogComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly infrastructure = inject(Infrastructure);

  @Input({ required: true }) assignment!: TeacherAssignmentWithJoins;
  @Input() currentTeacherId?: string;
  @Output() confirm = new EventEmitter<TransferAssignmentData>();
  @Output() cancel = new EventEmitter<void>();

  transferForm: FormGroup;
  readonly teachers = signal<Teacher[]>([]);
  readonly searchQuery = signal<string>('');
  readonly isLoading = signal<boolean>(false);
  readonly isValidating = signal<boolean>(false);
  readonly validationMessage = signal<string | null>(null);
  readonly canProceed = signal<boolean>(true);
  readonly sharedAssignments = signal<Array<{ 
    assignment: TeacherAssignment; 
    teacher: { id: string; fullname: string | null } 
  }>>([]);
  readonly isLoadingShared = signal<boolean>(false);
  
  private readonly validationTrigger$ = new RxSubject<void>();
  private readonly destroy$ = new RxSubject<void>();

  readonly filteredTeachers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const allTeachers = this.teachers();
    
    if (!query) {
      return allTeachers;
    }

    return allTeachers.filter(teacher => {
      const fullname = teacher.fullname?.toLowerCase() || '';
      const id = teacher.id.toLowerCase();
      return fullname.includes(query) || id.includes(query);
    });
  });

  readonly getSchoolLevelLabel = getSchoolLevelLabel;

  constructor() {
    this.transferForm = this.fb.group({
      mode: ['transfer', Validators.required],
      teacherId: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadTeachers();
    this.setupValidation();
    this.loadSharedAssignments();
  }

  private setupValidation(): void {
    // Valider quand le mode ou le professeur change
    this.validationTrigger$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
      switchMap(() => {
        const formValue = this.transferForm.value;
        const mode = formValue.mode;
        const teacherId = formValue.teacherId;
        
        if (!teacherId || !this.assignment) {
          this.canProceed.set(true);
          this.validationMessage.set(null);
          return [];
        }

        this.isValidating.set(true);
        return this.infrastructure.validateShareOrTransfer(
          this.assignment.id,
          teacherId,
          mode
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (validation) => {
        this.isValidating.set(false);
        if (validation && !validation.canProceed) {
          this.canProceed.set(false);
          this.validationMessage.set(validation.reason || 'Cette action n\'est pas possible.');
        } else {
          this.canProceed.set(true);
          this.validationMessage.set(null);
        }
      },
      error: () => {
        this.isValidating.set(false);
        this.canProceed.set(true);
        this.validationMessage.set(null);
      }
    });

    // Déclencher la validation quand le formulaire change
    this.transferForm.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.validationTrigger$.next();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.validationTrigger$.complete();
  }

  private loadTeachers(): void {
    this.isLoading.set(true);
    
    // Ne pas exclure si currentTeacherId est vide, null ou undefined
    const excludeId = this.currentTeacherId && this.currentTeacherId.trim() !== '' 
      ? this.currentTeacherId.trim() 
      : undefined;
    
    this.infrastructure.getAllTeachers(excludeId).subscribe({
      next: ({ teachers, error }) => {
        this.isLoading.set(false);
        if (error) {
          console.error('[TransferDialog] Erreur lors du chargement des professeurs:', error);
          this.teachers.set([]);
          return;
        }
        this.teachers.set(teachers || []);
      },
      error: (error) => {
        this.isLoading.set(false);
        console.error('[TransferDialog] Erreur lors du chargement des professeurs:', error);
        this.teachers.set([]);
      }
    });
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
  }

  getTeacherDisplayName(teacher: Teacher): string {
    return teacher.fullname || `Professeur ${teacher.id.substring(0, 8)}`;
  }

  private loadSharedAssignments(): void {
    if (!this.assignment?.id) return;
    
    this.isLoadingShared.set(true);
    this.infrastructure.getSharedAssignments(this.assignment.id).subscribe({
      next: ({ sharedAssignments, error }) => {
        this.isLoadingShared.set(false);
        if (error) {
          console.error('[TransferDialog] Erreur lors du chargement des affectations partagées:', error);
          this.sharedAssignments.set([]);
          return;
        }
        this.sharedAssignments.set(sharedAssignments || []);
      },
      error: (error) => {
        this.isLoadingShared.set(false);
        console.error('[TransferDialog] Erreur lors du chargement des affectations partagées:', error);
        this.sharedAssignments.set([]);
      }
    });
  }

  getSharedTeachersNames(): string {
    const shared = this.sharedAssignments();
    if (shared.length === 0) return '';
    
    const names = shared
      .map(s => s.teacher.fullname || `Professeur ${s.teacher.id.substring(0, 8)}`)
      .join(', ');
    
    return names;
  }

  hasSharedAssignments(): boolean {
    return this.sharedAssignments().length > 0;
  }

  onConfirm(): void {
    if (this.transferForm.valid && this.canProceed()) {
      const formValue = this.transferForm.value;
      this.confirm.emit({
        mode: formValue.mode,
        newTeacherId: formValue.teacherId
      });
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

