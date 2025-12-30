import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss'
})
export class ToastComponent {
  private readonly toastService = inject(ToastService);
  
  readonly toasts = computed(() => this.toastService.toasts$());

  removeToast(id: string): void {
    this.toastService.remove(id);
  }

  getIcon(type: string): string {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  }
}
