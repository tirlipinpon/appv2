import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef, MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Composant personnalisé pour afficher une snackbar d'erreur avec un bouton de fermeture
 */
@Component({
  selector: 'app-error-snackbar',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="error-snackbar">
      <mat-icon class="error-icon">error</mat-icon>
      <span class="error-message">{{ data.message }}</span>
      <button mat-icon-button (click)="dismiss()" class="close-button" aria-label="Fermer">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .error-snackbar {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      font-size: 14px;
    }

    .error-icon {
      color: #ff6b6b;
    }

    .error-message {
      flex: 1;
    }

    .close-button {
      color: white;
    }

    .close-button:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  `]
})
export class ErrorSnackbarComponent {
  constructor(
    private snackBarRef: MatSnackBarRef<ErrorSnackbarComponent>,
    @Inject(MAT_SNACK_BAR_DATA) public data: { message: string }
  ) {}

  dismiss(): void {
    this.snackBarRef.dismiss();
  }
}

@Injectable({
  providedIn: 'root',
})
export class ErrorSnackbarService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly snackBarRefs: MatSnackBarRef<ErrorSnackbarComponent>[] = [];

  /**
   * Affiche un message d'erreur dans une snackbar
   * @param message Le message d'erreur à afficher
   * @param duration La durée d'affichage en ms (par défaut: 0 = indéfini jusqu'à fermeture manuelle)
   */
  showError(message: string, duration: number = 0): MatSnackBarRef<ErrorSnackbarComponent> {
    const config: MatSnackBarConfig = {
      duration: duration || undefined, // Si duration est 0, undefined = pas de fermeture automatique
      panelClass: ['error-snackbar-panel'],
      horizontalPosition: 'end',
      verticalPosition: 'top',
      data: { message }
    };

    const snackBarRef = this.snackBar.openFromComponent(ErrorSnackbarComponent, config);

    // Gérer la fermeture
    snackBarRef.afterDismissed().subscribe(() => {
      const index = this.snackBarRefs.indexOf(snackBarRef);
      if (index > -1) {
        this.snackBarRefs.splice(index, 1);
      }
    });

    this.snackBarRefs.push(snackBarRef);
    return snackBarRef;
  }

  /**
   * Affiche plusieurs messages d'erreur dans des snackbars séparées
   * @param messages Les messages d'erreur à afficher
   */
  showErrors(messages: string[]): void {
    messages.forEach((message, index) => {
      // Petit délai pour empiler les snackbars verticalement
      setTimeout(() => {
        this.showError(message);
      }, index * 50);
    });
  }

  /**
   * Ferme toutes les snackbars d'erreur actives
   */
  dismissAll(): void {
    this.snackBarRefs.forEach(ref => ref.dismiss());
    this.snackBarRefs.length = 0;
  }
}

