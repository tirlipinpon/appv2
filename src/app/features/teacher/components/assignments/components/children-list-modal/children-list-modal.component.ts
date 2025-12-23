import { Component, Input, Output, EventEmitter, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Infrastructure } from '../../../../components/infrastructure/infrastructure';
import type { Child } from '../../../../../child/types/child';
import { getSchoolLevelLabel } from '../../../../utils/school-levels.util';

@Component({
  selector: 'app-children-list-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './children-list-modal.component.html',
  styleUrl: './children-list-modal.component.scss'
})
export class ChildrenListModalComponent {
  @Input() categoryId: string | null = null;
  @Input() categoryName: string = '';
  @Input() schoolId: string | null = null;
  @Input() schoolLevel: string | null = null;
  @Output() close = new EventEmitter<void>();

  private readonly infrastructure = inject(Infrastructure);

  readonly children = signal<Child[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly getSchoolLevelLabel = getSchoolLevelLabel;

  // Effect pour charger les enfants quand les inputs changent
  private readonly loadChildrenEffect = effect(() => {
    const categoryId = this.categoryId;
    if (categoryId) {
      this.loadChildren();
    }
  });

  loadChildren(): void {
    if (!this.categoryId) return;

    this.loading.set(true);
    this.error.set(null);

    this.infrastructure.getChildrenByCategory(
      this.categoryId,
      this.schoolId,
      this.schoolLevel
    ).subscribe({
      next: ({ children, error }) => {
        this.loading.set(false);
        if (error) {
          this.error.set(error.message || 'Erreur lors du chargement des enfants');
          return;
        }
        this.children.set(children || []);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.message || 'Erreur lors du chargement des enfants');
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.onClose();
    }
  }

  calculateAge(birthdate: string): number {
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }
}

