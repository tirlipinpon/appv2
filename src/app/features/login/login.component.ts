import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { getAuthService } from '../../shared/services/auth/auth-service.factory';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = getAuthService();
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

  async ngOnInit() {
    // Vérifier si l'utilisateur est déjà connecté
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      // L'utilisateur est déjà connecté, vérifier le profil
      const profile = await this.authService.getProfile();
      if (profile) {
        // Si plusieurs rôles, essayer de restaurer le dernier rôle sélectionné
        if (this.authService.hasMultipleRoles()) {
          const user = this.authService.getCurrentUser();
          if (user) {
            try {
              const savedRole = localStorage.getItem(`activeRole_${user.id}`);
              if (savedRole && profile.roles.includes(savedRole)) {
                // Rôle sauvegardé trouvé, le restaurer et rediriger
                this.authService.setActiveRole(savedRole);
                const returnUrl = this.route.snapshot.queryParams['returnUrl'];
                if (returnUrl) {
                  this.router.navigateByUrl(returnUrl);
                } else {
                  this.router.navigate(['/dashboard']);
                }
              } else {
                // Pas de rôle sauvegardé, rediriger vers le sélecteur
                const returnUrl = this.route.snapshot.queryParams['returnUrl'];
                if (returnUrl) {
                  this.router.navigate(['/select-role'], { queryParams: { returnUrl } });
                } else {
                  this.router.navigate(['/select-role']);
                }
              }
            } catch (error) {
              // En cas d'erreur, rediriger vers le sélecteur
              this.router.navigate(['/select-role']);
            }
          } else {
            this.router.navigate(['/select-role']);
          }
        } else if (profile.roles.length === 1) {
          // Un seul rôle, définir automatiquement et rediriger
          this.authService.setActiveRole(profile.roles[0]);
          const returnUrl = this.route.snapshot.queryParams['returnUrl'];
          if (returnUrl) {
            this.router.navigateByUrl(returnUrl);
          } else {
            this.router.navigate(['/dashboard']);
          }
        } else {
          // Pas de rôle, rediriger vers le sélecteur
          this.router.navigate(['/select-role']);
        }
        return;
      }
    }

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
    console.log('🔵 [LOGIN] onSubmit() - START', {
      formValid: this.loginForm.valid,
      formInvalid: this.loginForm.invalid,
      isLocalhost: this.isLocalhost,
      isForgotPasswordMode: this.isForgotPasswordMode,
      formErrors: this.loginForm.errors,
      emailErrors: this.loginForm.get('email')?.errors,
      passwordErrors: this.loginForm.get('password')?.errors
    });

    if (this.loginForm.invalid && !this.isLocalhost) {
      console.log('❌ [LOGIN] Form is invalid and not localhost, returning');
      return;
    }

    if (this.isForgotPasswordMode && !this.isLocalhost) {
      console.log('❌ [LOGIN] Forgot password mode and not localhost, returning');
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;

    const { email, password } = this.loginForm.value;
    console.log('🔵 [LOGIN] Calling signIn with:', { email, hasPassword: !!password });
    const { session, error } = await this.authService.signIn(email, password);
    console.log('📥 [LOGIN] signIn result:', { hasSession: !!session, hasError: !!error, error });

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
      
      // #region agent log
      console.log('🔍 [DEBUG-LOGIN] Profile loaded before navigation', { hasProfile: !!profile, rolesCount: profile?.roles?.length || 0, roles: profile?.roles, hasMultipleRoles: this.authService.hasMultipleRoles() });
      // #endregion

      if (profile) {
        // Si plusieurs rôles, toujours rediriger vers le sélecteur pour laisser l'utilisateur choisir
        // Le rôle sauvegardé sera restauré automatiquement par le dashboard ou le role-selector si nécessaire
        if (this.authService.hasMultipleRoles()) {
          // #region agent log
          console.log('🔍 [DEBUG-LOGIN] BEFORE navigate to select-role (multiple)', { target: '/select-role' });
          // #endregion
          const navResult = await this.router.navigate(['/select-role']);
          // #region agent log
          console.log('🔍 [DEBUG-LOGIN] AFTER navigate to select-role (multiple)', { navResult, currentUrl: this.router.url, success: navResult });
          // #endregion
        } else if (profile.roles && profile.roles.length === 1) {
          // Un seul rôle, définir automatiquement et rediriger
          this.authService.setActiveRole(profile.roles[0]);
          // #region agent log
          console.log('🔍 [DEBUG-LOGIN] BEFORE navigate to dashboard (single role)', { target: '/dashboard', role: profile.roles[0] });
          // #endregion
          const navResult = await this.router.navigate(['/dashboard']);
          // #region agent log
          console.log('🔍 [DEBUG-LOGIN] AFTER navigate to dashboard (single role)', { navResult, currentUrl: this.router.url, success: navResult });
          // #endregion
        } else if (profile.roles && profile.roles.length > 0) {
          // Plusieurs rôles ou aucun rôle spécifique, rediriger vers le sélecteur
          // #region agent log
          console.log('🔍 [DEBUG-LOGIN] BEFORE navigate to select-role (roles>0)', { target: '/select-role' });
          // #endregion
          const navResult = await this.router.navigate(['/select-role']);
          // #region agent log
          console.log('🔍 [DEBUG-LOGIN] AFTER navigate to select-role (roles>0)', { navResult, currentUrl: this.router.url, success: navResult });
          // #endregion
        } else {
          // Pas de rôle, rediriger vers le sélecteur
          // #region agent log
          console.log('🔍 [DEBUG-LOGIN] BEFORE navigate to select-role (no roles)', { target: '/select-role' });
          // #endregion
          const navResult = await this.router.navigate(['/select-role']);
          // #region agent log
          console.log('🔍 [DEBUG-LOGIN] AFTER navigate to select-role (no roles)', { navResult, currentUrl: this.router.url, success: navResult });
          // #endregion
        }
      } else {
        // #region agent log
        console.log('🔍 [DEBUG-LOGIN] BEFORE navigate to dashboard (no profile)', { target: '/dashboard' });
        // #endregion
        const navResult = await this.router.navigate(['/dashboard']);
        // #region agent log
        console.log('🔍 [DEBUG-LOGIN] AFTER navigate to dashboard (no profile)', { navResult, currentUrl: this.router.url, success: navResult });
        // #endregion
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
