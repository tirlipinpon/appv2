import { Injectable, signal, computed } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly toasts = signal<Toast[]>([]);
  
  readonly toasts$ = computed(() => this.toasts());

  show(message: string, type: ToastType = 'info', duration = 5000): string {
    const id = this.generateId();
    const toast: Toast = {
      id,
      message,
      type,
      duration,
      timestamp: Date.now()
    };

    this.toasts.update(toasts => [...toasts, toast]);

    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    return id;
  }

  success(message: string, duration?: number): string {
    return this.show(message, 'success', duration);
  }

  error(message: string, duration?: number): string {
    return this.show(message, 'error', duration || 7000);
  }

  info(message: string, duration?: number): string {
    return this.show(message, 'info', duration);
  }

  warning(message: string, duration?: number): string {
    return this.show(message, 'warning', duration);
  }

  remove(id: string): void {
    this.toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  clear(): void {
    this.toasts.set([]);
  }

  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
