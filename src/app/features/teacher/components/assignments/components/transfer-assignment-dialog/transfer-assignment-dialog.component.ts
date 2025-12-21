import { Component, Input, Output, EventEmitter, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import type { TeacherAssignment } from '../../../../types/teacher-assignment';
import type { Teacher } from '../../../../types/teacher';
import type { Subject } from '../../../../types/subject';
import type { School } from '../../../../types/school';
import { Infrastructure } from '../../../infrastructure/infrastructure';
import { getSchoolLevelLabel } from '../../../../utils/school-levels.util';

export interface TransferAssignmentData {
  mode: 'transfer' | 'share';
  newTeacherId: string;
}

// Type étendu pour inclure les jointures Supabase
export interface TeacherAssignmentWithJoins extends TeacherAssignment {
  subject?: Subject;
  school?: School;
}

@Component({
  selector: 'app-transfer-assignment-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './transfer-assignment-dialog.component.html',
  styleUrls: ['./transfer-assignment-dialog.component.scss']
})
export class TransferAssignmentDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly infrastructure = inject(Infrastructure);

  @Input({ required: true }) assignment!: TeacherAssignmentWithJoins;
  @Input() currentTeacherId!: string;
  @Output() confirm = new EventEmitter<TransferAssignmentData>();
  @Output() cancel = new EventEmitter<void>();

  transferForm: FormGroup;
  readonly teachers = signal<Teacher[]>([]);
  readonly searchQuery = signal<string>('');
  readonly isLoading = signal<boolean>(false);

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
  }

  private loadTeachers(): void {
    this.isLoading.set(true);
    this.infrastructure.getAllTeachers(this.currentTeacherId).subscribe({
      next: ({ teachers, error }) => {
        this.isLoading.set(false);
        if (error) {
          console.error('Erreur lors du chargement des professeurs:', error);
          return;
        }
        this.teachers.set(teachers || []);
      },
      error: (error) => {
        this.isLoading.set(false);
        console.error('Erreur lors du chargement des professeurs:', error);
      }
    });
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
  }

  getTeacherDisplayName(teacher: Teacher): string {
    return teacher.fullname || `Professeur ${teacher.id.substring(0, 8)}`;
  }

  onConfirm(): void {
    if (this.transferForm.valid) {
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

