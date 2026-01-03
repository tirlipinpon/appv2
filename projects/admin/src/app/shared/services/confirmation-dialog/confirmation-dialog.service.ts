import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface ConfirmationDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmationDialogService {
  private readonly dialogState = signal<{
    isOpen: boolean;
    options: ConfirmationDialogOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    options: null,
    resolve: null,
  });

  readonly isOpen = signal(false);
  readonly options = signal<ConfirmationDialogOptions | null>(null);

  /**
   * Affiche un dialogue de confirmation et retourne une Promise qui se résout avec true si confirmé, false sinon
   */
  confirm(options: ConfirmationDialogOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.dialogState.set({
        isOpen: true,
        options: {
          title: options.title || 'Confirmation',
          message: options.message,
          confirmText: options.confirmText || 'Confirmer',
          cancelText: options.cancelText || 'Annuler',
          type: options.type || 'warning',
        },
        resolve,
      });
      this.isOpen.set(true);
      this.options.set(this.dialogState().options);
    });
  }

  /**
   * Affiche un dialogue d'alerte simple (comme alert())
   */
  alert(message: string, title = 'Information'): Promise<void> {
    return new Promise<void>((resolve) => {
      this.dialogState.set({
        isOpen: true,
        options: {
          title,
          message,
          confirmText: 'OK',
          cancelText: '',
          type: 'info',
        },
        resolve: () => resolve(),
      });
      this.isOpen.set(true);
      this.options.set(this.dialogState().options);
    });
  }

  /**
   * Confirme l'action (appelé par le composant de dialogue)
   */
  onConfirm(): void {
    const state = this.dialogState();
    if (state.resolve) {
      state.resolve(true);
    }
    this.close();
  }

  /**
   * Annule l'action (appelé par le composant de dialogue)
   */
  onCancel(): void {
    const state = this.dialogState();
    if (state.resolve) {
      state.resolve(false);
    }
    this.close();
  }

  /**
   * Ferme le dialogue
   */
  close(): void {
    this.dialogState.set({
      isOpen: false,
      options: null,
      resolve: null,
    });
    this.isOpen.set(false);
    this.options.set(null);
  }

  /**
   * Vérifie si le dialogue est en mode "alerte" (pas de bouton annuler)
   */
  isAlertMode(): boolean {
    const opts = this.options();
    return opts?.cancelText === '' || opts?.cancelText === undefined;
  }
}
