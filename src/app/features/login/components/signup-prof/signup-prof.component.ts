import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, ServiceError } from '../../../../services/auth/auth.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  
  if (!password || !confirmPassword) {
    return null;
  }
  
  return password.value === confirmPassword.value ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-signup-prof',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './signup-prof.component.html',
  styleUrl: './signup-prof.component.scss'
})
export class SignupProfComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  signupForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordMatchValidator });
  errorMessage: string | null = null;
  isLoading = false;
  showEmailExistsDialog = false;

  async onSubmit() {
    if (this.signupForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.showEmailExistsDialog = false;

    const { email, password } = this.signupForm.getRawValue();
    console.log('🔵 [SIGNUP-PROF] onSubmit() - Starting signup:', { email });
    
    const { user, error } = await this.authService.signUp(email, password, ['prof']);

    console.log('📥 [SIGNUP-PROF] signUp result:', { 
      hasUser: !!user, 
      hasError: !!error,
      error: error ? {
        message: error.message,
        code: this.extractErrorCode(error)
      } : null
    });

    this.isLoading = false;

    if (error) {
      // Vérifier si l'erreur est "email déjà existant" ou "rôle déjà existant"
      const errorCode = this.extractErrorCode(error);
      const message = error.message ?? '';
      const isAlreadyRegistered = message.includes('already registered') || 
                                  message.includes('User already registered') ||
                                  message.includes('already exists') ||
                                  errorCode === 'already_registered';
      
      const hasRoleAlready = errorCode === 'role_already_exists';
      
      if (hasRoleAlready) {
        // L'utilisateur a déjà ce rôle
        this.errorMessage = error.message || 'Vous avez déjà le rôle prof. Connectez-vous avec votre compte existant.';
      } else if (isAlreadyRegistered) {
        // Vérifier si l'utilisateur a déjà le rôle 'prof'
        // On ne peut pas vérifier sans être connecté, donc on propose toujours d'ajouter le rôle
        // Le login vérifiera si le rôle existe déjà
        this.showEmailExistsDialog = true;
      } else {
        this.errorMessage = error.message || 'Une erreur est survenue lors de l\'inscription';
      }
      return;
    }

    if (user) {
      // Vérifier si l'utilisateur est déjà confirmé (session existe)
      // Si pas de session, c'est une nouvelle inscription en attente de confirmation
      // Inscription réussie, afficher message de confirmation d'email
      this.router.navigate(['/login'], { 
        queryParams: { 
          message: 'Veuillez vérifier votre email pour confirmer votre compte' 
        } 
      });
    }
  }

  async addRoleAndLogin() {
    this.isLoading = true;
    this.showEmailExistsDialog = false;

    // Rediriger vers login
    this.router.navigate(['/login'], {
      queryParams: {
        email: this.signupForm.get('email')?.value,
        addRole: 'prof'
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  closeDialog() {
    this.showEmailExistsDialog = false;
  }

  onOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.closeDialog();
    }
  }

  onDialogKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.stopPropagation();
    }
  }

  private extractErrorCode(error: ServiceError | null): string | undefined {
    if (!error) {
      return undefined;
    }

    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }

    return undefined;
  }
}
