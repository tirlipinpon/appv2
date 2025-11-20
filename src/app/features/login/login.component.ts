import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../shared/services/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  loginForm: FormGroup = this.fb.group({
    email: ['tony-ster@hotmail.com', [Validators.required, Validators.email]],
    password: ['tony-ster@hotmail.com', [Validators.required, Validators.minLength(6)]],
  });
  forgotPasswordForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });
  errorMessage: string | null = null;
  successMessage: string | null = null;
  isLoading = false;
  addRoleAfterLogin: string | null = null;
  isForgotPasswordMode = false;

  ngOnInit() {
    // Vérifier les query params pour ajouter un rôle après connexion
    this.route.queryParams.subscribe(params => {
      if (params['addRole']) {
        this.addRoleAfterLogin = params['addRole'];
      }
      if (params['email']) {
        this.loginForm.patchValue({ email: params['email'] });
        this.forgotPasswordForm.patchValue({ email: params['email'] });
      }
      if (params['message']) {
        this.successMessage = params['message'];
      }
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid && !this.isLocalhost) {
      return;
    }

    if (this.isForgotPasswordMode && !this.isLocalhost) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;

    const { email, password } = this.loginForm.value;
    const { session, error } = await this.authService.signIn(email, password);

    this.isLoading = false;

    if (error) {
      this.errorMessage = error.message || 'Une erreur est survenue lors de la connexion';
      return;
    }

    if (session) {
      // Si on doit ajouter un rôle après connexion
      if (this.addRoleAfterLogin) {
        console.log('🟡 [LOGIN] Adding role after login:', this.addRoleAfterLogin);
        
        // Vérifier d'abord si l'utilisateur a déjà ce rôle
        const profile = await this.authService.getProfile();
        console.log('📥 [LOGIN] Current profile:', profile);
        
        if (profile && profile.roles.includes(this.addRoleAfterLogin)) {
          console.log('⚠️ [LOGIN] Role already exists!');
          this.errorMessage = `Vous avez déjà le rôle '${this.addRoleAfterLogin}'. Connectez-vous normalement.`;
          return;
        }
        
        console.log('➕ [LOGIN] Role does not exist, adding...');
        const { profile: updatedProfile, error: roleError } = await this.authService.addRoleToProfile(this.addRoleAfterLogin);
        
        console.log('📥 [LOGIN] addRoleToProfile result:', { updatedProfile, roleError });
        
        if (roleError) {
          console.error('❌ [LOGIN] Error adding role:', roleError);
          this.errorMessage = roleError.message || 'Erreur lors de l\'ajout du rôle';
          return;
        }
        console.log('✅ [LOGIN] Role added successfully!');
        this.successMessage = `Le rôle '${this.addRoleAfterLogin}' a été ajouté à votre profil avec succès !`;
      }

      // Récupérer le profil
      const profile = await this.authService.getProfile();
      
      if (profile) {
        // Si plusieurs rôles, rediriger vers le sélecteur de rôle
        if (this.authService.hasMultipleRoles()) {
          this.router.navigate(['/select-role']);
        } else if (profile.roles.length === 1) {
          // Un seul rôle, définir automatiquement et rediriger
          this.authService.setActiveRole(profile.roles[0]);
          this.router.navigate(['/dashboard']);
        } else {
          // Pas de rôle, rediriger vers le sélecteur
          this.router.navigate(['/select-role']);
        }
      } else {
        this.router.navigate(['/dashboard']);
      }
    }
  }

  toggleForgotPassword() {
    this.isForgotPasswordMode = !this.isForgotPasswordMode;
    this.errorMessage = null;
    this.successMessage = null;
    this.isLoading = false;
  }

  async onForgotPasswordSubmit() {
    if (this.forgotPasswordForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;

    const { email } = this.forgotPasswordForm.value;
    const { error } = await this.authService.requestPasswordReset(email);

    this.isLoading = false;

    if (error) {
      this.errorMessage = error.message || 'Une erreur est survenue lors de la demande de réinitialisation';
      return;
    }

    this.successMessage =
      'Un email de réinitialisation vous a été envoyé. Veuillez suivre les instructions reçues pour choisir un nouveau mot de passe.';
    this.forgotPasswordForm.markAsPristine();
  }
}
