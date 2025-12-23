import { Component, Input, Output, EventEmitter, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import type { SubjectCategory } from '../../../../types/subject';
import type { Subject } from '../../../../types/subject';
import { Infrastructure } from '../../../infrastructure/infrastructure';

export interface TransferCategoryData {
  newSubjectId: string;
}

@Component({
  selector: 'app-transfer-category-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './transfer-category-dialog.component.html',
  styleUrls: ['./transfer-category-dialog.component.scss']
})
export class TransferCategoryDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly infrastructure = inject(Infrastructure);

  @Input({ required: true }) category!: SubjectCategory;
  @Input() currentSubjectId?: string;
  @Output() confirmTransfer = new EventEmitter<TransferCategoryData>();
  @Output() cancelTransfer = new EventEmitter<void>();

  transferForm: FormGroup;
  readonly subjects = signal<Subject[]>([]);
  readonly isLoading = signal<boolean>(false);

  constructor() {
    this.transferForm = this.fb.group({
      subjectId: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadSubjects();
  }

  private loadSubjects(): void {
    this.isLoading.set(true);
    
    this.infrastructure.getSubjects().subscribe({
      next: ({ subjects, error }) => {
        this.isLoading.set(false);
        if (error) {
          console.error('[TransferCategoryDialog] Erreur lors du chargement des matières:', error);
          this.subjects.set([]);
          return;
        }
        // Exclure la matière actuelle de la liste
        const filtered = (subjects || []).filter(s => s.id !== this.currentSubjectId);
        this.subjects.set(filtered);
      },
      error: (error) => {
        this.isLoading.set(false);
        console.error('[TransferCategoryDialog] Erreur lors du chargement des matières:', error);
        this.subjects.set([]);
      }
    });
  }

  onConfirm(): void {
    if (this.transferForm.valid) {
      const formValue = this.transferForm.value;
      this.confirmTransfer.emit({
        newSubjectId: formValue.subjectId
      });
    }
  }

  onCancel(): void {
    this.cancelTransfer.emit();
  }
}

