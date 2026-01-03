import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmationDialogService } from '../../services/confirmation-dialog/confirmation-dialog.service';

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss'
})
export class ConfirmationDialogComponent {
  private readonly confirmationService = inject(ConfirmationDialogService);

  readonly isOpen = this.confirmationService.isOpen;
  readonly options = this.confirmationService.options;
  
  readonly title = computed(() => this.options()?.title || 'Confirmation');
  readonly message = computed(() => this.options()?.message || 'Êtes-vous sûr de vouloir effectuer cette action ?');
  readonly confirmText = computed(() => this.options()?.confirmText || 'Confirmer');
  readonly cancelText = computed(() => this.options()?.cancelText || 'Annuler');
  readonly type = computed(() => this.options()?.type || 'warning');
  readonly showCancelButton = computed(() => !this.confirmationService.isAlertMode());

  confirm(): void {
    this.confirmationService.onConfirm();
  }

  cancel(): void {
    this.confirmationService.onCancel();
  }

  close(): void {
    this.confirmationService.close();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('dialog-backdrop')) {
      this.close();
    }
  }
}
