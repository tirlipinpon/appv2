import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ChildAuthService } from '../../core/auth/child-auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="login-container">
      <h1>Connexion</h1>
      <form>
        <div class="form-group">
          <label for="firstname">Prénom</label>
          <input
            id="firstname"
            type="text"
            [formControl]="firstnameControl"
            placeholder="Ton prénom"
            [disabled]="isLoading"
          />
        </div>
        <div class="form-group">
          <label for="pin">Code PIN</label>
          <input
            id="pin"
            type="password"
            [formControl]="pinControl"
            placeholder="1234"
            maxlength="4"
            [disabled]="isLoading"
          />
          @if (pinInvalid) {
            <div class="error-message">
              {{ pinErrorMessage }}
            </div>
          }
        </div>
        @if (errorMessage) {
          <div class="error-message global-error">
            {{ errorMessage }}
          </div>
        }
        <button type="submit" (click)="onLogin($event)" [disabled]="!firstnameControl.valid || !pinControl.valid || isLoading">
          @if (!isLoading) {
            <span>Se connecter</span>
          }
          @if (isLoading) {
            <span>Connexion...</span>
          }
        </button>
      </form>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1rem;
    }
    @media (min-width: 768px) {
      .login-container {
        padding: 2rem;
      }
    }
    .form-group {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
    }
    input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ccc;
      border-radius: 8px;
    }
    button {
      padding: 0.75rem 2rem;
      background-color: var(--theme-primary-color);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }
    .error-message {
      color: var(--theme-warn-color);
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
    .global-error {
      background-color: #ffebee;
      border: 1px solid var(--theme-warn-color);
      border-radius: 8px;
      padding: 0.75rem;
      margin-bottom: 1rem;
      text-align: center;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class LoginComponent {
  private readonly authService = inject(ChildAuthService);
  private readonly router = inject(Router);

  firstnameControl = new FormControl('akira', Validators.required);
  pinControl = new FormControl('1111', [
    Validators.required,
    Validators.pattern(/^\d{4}$/),
    Validators.minLength(4),
    Validators.maxLength(4),
  ]);

  errorMessage = '';
  isLoading = false;

  onLogin(event?: Event): void {
    event?.preventDefault();
    if (this.firstnameControl.valid && this.pinControl.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      
      this.authService.login(
        this.firstnameControl.value!,
        this.pinControl.value!
      ).then(session => {
        this.isLoading = false;
        if (session) {
          this.router.navigate(['/subjects']);
        }
      }).catch(error => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Erreur lors de la connexion. Vérifie ton prénom et ton code PIN.';
        console.error('Erreur de connexion:', error);
      });
    }
  }

  get pinInvalid(): boolean {
    return this.pinControl.invalid && (this.pinControl.touched || this.pinControl.dirty);
  }

  get pinErrorMessage(): string {
    if (this.pinControl.hasError('required')) {
      return 'Le code PIN est requis';
    }
    if (this.pinControl.hasError('pattern') || this.pinControl.hasError('minlength') || this.pinControl.hasError('maxlength')) {
      return 'Le code PIN doit contenir exactement 4 chiffres';
    }
    return '';
  }
}

