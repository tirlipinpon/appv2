import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ChildAuthService } from '../../core/auth/child-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-container">
      <h1>Connexion</h1>
      <form (ngSubmit)="onLogin()">
        <div class="form-group">
          <label for="firstname">Prénom</label>
          <input
            id="firstname"
            type="text"
            [formControl]="firstnameControl"
            placeholder="Ton prénom"
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
          />
          <div *ngIf="pinInvalid" class="error-message">
            {{ pinErrorMessage }}
          </div>
        </div>
        <button type="submit" [disabled]="!firstnameControl.valid || !pinControl.valid">
          Se connecter
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
      padding: 2rem;
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
  `]
})
export class LoginComponent {
  firstnameControl = new FormControl('', Validators.required);
  pinControl = new FormControl('', [
    Validators.required,
    Validators.pattern(/^\d{4}$/),
    Validators.minLength(4),
    Validators.maxLength(4),
  ]);

  constructor(
    private authService: ChildAuthService,
    private router: Router
  ) {}

  onLogin(): void {
    if (this.firstnameControl.valid && this.pinControl.valid) {
      this.authService.login(
        this.firstnameControl.value!,
        this.pinControl.value!
      ).then(session => {
        if (session) {
          this.router.navigate(['/dashboard']);
        }
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

