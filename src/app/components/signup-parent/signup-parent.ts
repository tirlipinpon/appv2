import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  
  if (!password || !confirmPassword) {
    return null;
  }
  
  return password.value === confirmPassword.value ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-signup-parent',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './signup-parent.html',
  styleUrl: './signup-parent.scss'
})
export class SignupParentComponent {
  signupForm: FormGroup;
  errorMessage: string | null = null;
  isLoading = false;
  showEmailExistsDialog = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.signupForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: passwordMatchValidator });
  }

  async onSubmit() {
    if (this.signupForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.showEmailExistsDialog = false;

    const { email, password } = this.signupForm.value;
    const { user, error } = await this.authService.signUp(email, password, ['parent']);

    this.isLoading = false;

    if (error) {
      // Vérifier si l'erreur est "email déjà existant"
      if (error.message?.includes('already registered') || error.message?.includes('User already registered')) {
        this.showEmailExistsDialog = true;
      } else {
        this.errorMessage = error.message || 'Une erreur est survenue lors de l\'inscription';
      }
      return;
    }

    if (user) {
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
        addRole: 'parent'
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
