import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService, ServiceError } from '../../../../shared/services/auth/auth.service';
import { passwordMatchValidator } from '../../utils/password-match.validator';

type SignupRole = 'parent' | 'prof';

interface RoleConfig {
  readonly roleKey: SignupRole;
  readonly title: string;
  readonly roleLabel: string;
}

const ROLE_CONFIG: Record<SignupRole, RoleConfig> = {
  parent: {
    roleKey: 'parent',
    title: 'Inscription Parent',
    roleLabel: 'parent',
  },
  prof: {
    roleKey: 'prof',
    title: 'Inscription Professeur',
    roleLabel: 'prof',
  },
};

@Component({
  selector: 'app-signup-role',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './signup-role.component.html',
  styleUrl: './signup-role.component.scss',
})
export class SignupRoleComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly role: SignupRole;
  readonly config: RoleConfig;

  signupForm: FormGroup;
  errorMessage: string | null = null;
  isLoading = false;
  showEmailExistsDialog = false;

  constructor() {
    const roleFromRoute = this.route.snapshot.data['role'] as SignupRole | undefined;
    if (!roleFromRoute || !(roleFromRoute in ROLE_CONFIG)) {
      this.role = 'parent';
      this.config = ROLE_CONFIG.parent;
      void this.router.navigate(['/signup']);
    } else {
      this.role = roleFromRoute;
      this.config = ROLE_CONFIG[roleFromRoute];
    }

    this.signupForm = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordMatchValidator },
    );
  }

  get dialogMessage(): string {
    return `Ce compte existe déjà. Souhaitez-vous ajouter le rôle '${this.config.roleLabel}' à votre profil existant ?`;
  }

  get alreadyHasRoleMessage(): string {
    return `Vous avez déjà le rôle ${this.config.roleLabel}. Connectez-vous avec votre compte existant.`;
  }

  async onSubmit() {
    // #region agent log
    console.log('🔍 [DEBUG-SIGNUP] onSubmit START', { formValid: this.signupForm.valid, formInvalid: this.signupForm.invalid });
    // #endregion

    if (this.signupForm.invalid) {
      // #region agent log
      console.log('🔍 [DEBUG-SIGNUP] Form invalid, returning');
      // #endregion
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.showEmailExistsDialog = false;

    const { email, password } = this.signupForm.getRawValue();
    console.log(`🔵 [SIGNUP-${this.config.roleKey.toUpperCase()}] onSubmit() - Starting signup:`, { email });

    const { user, error } = await this.authService.signUp(email, password, [this.config.roleKey]);

    // #region agent log
    console.log('🔍 [DEBUG-SIGNUP] signUp completed', { hasUser: !!user, hasError: !!error, userId: user?.id });
    // #endregion

    console.log(`📥 [SIGNUP-${this.config.roleKey.toUpperCase()}] signUp result:`, {
      hasUser: !!user,
      hasError: !!error,
      error: error
        ? {
            message: error.message,
            code: this.extractErrorCode(error),
          }
        : null,
    });

    this.isLoading = false;

    if (error) {
      this.handleSignupError(error);
      return;
    }

    if (user) {
      // Vérifier si l'utilisateur est déjà connecté (session créée automatiquement en développement)
      const currentUser = this.authService.getCurrentUser();
      // #region agent log
      console.log('🔍 [DEBUG-SIGNUP] Checking currentUser after signup', { hasCurrentUser: !!currentUser, currentUserId: currentUser?.id, userId: user.id });
      // #endregion

      if (currentUser) {
        // Si déjà connecté, rediriger vers le sélecteur de rôle ou dashboard
        const profile = await this.authService.getProfile();
        // #region agent log
        console.log('🔍 [DEBUG-SIGNUP] Profile loaded before navigation', { hasProfile: !!profile, rolesCount: profile?.roles?.length || 0, roles: profile?.roles });
        // #endregion

        if (profile && profile.roles && profile.roles.length > 0) {
          if (profile.roles.length === 1) {
            this.authService.setActiveRole(profile.roles[0]);
            // #region agent log
            console.log('🔍 [DEBUG-SIGNUP] BEFORE navigate to dashboard', { target: '/dashboard' });
            // #endregion
            const navResult = await this.router.navigate(['/dashboard']);
            // #region agent log
            console.log('🔍 [DEBUG-SIGNUP] AFTER navigate to dashboard', { navResult, currentUrl: this.router.url, success: navResult });
            // #endregion
          } else {
            // #region agent log
            console.log('🔍 [DEBUG-SIGNUP] BEFORE navigate to select-role', { target: '/select-role' });
            // #endregion
            const navResult = await this.router.navigate(['/select-role']);
            // #region agent log
            console.log('🔍 [DEBUG-SIGNUP] AFTER navigate to select-role', { navResult, currentUrl: this.router.url, success: navResult });
            // #endregion
          }
        } else {
          // Pas encore de profil, rediriger vers login pour confirmation
          // #region agent log
          console.log('🔍 [DEBUG-SIGNUP] BEFORE navigate to login (no profile)', { target: '/login' });
          // #endregion
          const navResult = await this.router.navigate(['/login'], {
            queryParams: {
              message: 'Veuillez vérifier votre email pour confirmer votre compte',
            },
          });
          // #region agent log
          console.log('🔍 [DEBUG-SIGNUP] AFTER navigate to login (no profile)', { navResult, currentUrl: this.router.url, success: navResult });
          // #endregion
        }
      } else {
        // Pas encore de session, rediriger vers login
        // #region agent log
        console.log('🔍 [DEBUG-SIGNUP] BEFORE navigate to login (no session)', { target: '/login' });
        // #endregion
        const navResult = await this.router.navigate(['/login'], {
          queryParams: {
            message: 'Veuillez vérifier votre email pour confirmer votre compte',
          },
        });
        // #region agent log
        console.log('🔍 [DEBUG-SIGNUP] AFTER navigate to login (no session)', { navResult, currentUrl: this.router.url, success: navResult });
        // #endregion
      }
    }
  }

  async addRoleAndLogin() {
    this.isLoading = true;
    this.showEmailExistsDialog = false;

    this.router.navigate(['/login'], {
      queryParams: {
        email: this.signupForm.get('email')?.value,
        addRole: this.config.roleKey,
      },
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

  private handleSignupError(error: ServiceError) {
    const errorCode = this.extractErrorCode(error);
    const message = error.message ?? '';

    const isAlreadyRegistered =
      message.includes('already registered') ||
      message.includes('User already registered') ||
      message.includes('already exists') ||
      errorCode === 'already_registered';

    const hasRoleAlready = errorCode === 'role_already_exists';

    if (hasRoleAlready) {
      this.errorMessage = this.alreadyHasRoleMessage;
    } else if (isAlreadyRegistered) {
      this.showEmailExistsDialog = true;
    } else {
      this.errorMessage = error.message || "Une erreur est survenue lors de l'inscription";
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


