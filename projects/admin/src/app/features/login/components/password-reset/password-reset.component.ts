import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import type { Session } from '@supabase/supabase-js';
import { AuthService, SupabaseService } from '../../../../shared';

const passwordsMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;

  if (!password || !confirmPassword) {
    return null;
  }

  return password === confirmPassword ? null : { passwordsMismatch: true };
};

@Component({
  selector: 'app-password-reset',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './password-reset.component.html',
  styleUrl: './password-reset.component.scss',
})
export class PasswordResetComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  resetForm: FormGroup = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  errorMessage: string | null = null;
  successMessage: string | null = null;
  isSubmitting = false;
  isCheckingLink = true;
  private authSubscription?: { unsubscribe: () => void };
  private redirectTimeoutId: number | null = null;

  async ngOnInit() {
    const isValid = await this.prepareRecoverySession();

    if (!isValid) {
      this.isCheckingLink = false;
      return;
    }

    this.listenForRecoveryEvents();
    this.isCheckingLink = false;
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }

    if (this.redirectTimeoutId !== null) {
      clearTimeout(this.redirectTimeoutId);
    }
  }

  async onSubmit() {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;
    this.successMessage = null;

    const password = this.resetForm.value.password;
    const { error } = await this.authService.updatePassword(password);

    this.isSubmitting = false;

    if (error) {
      this.errorMessage = error.message || 'Impossible de mettre à jour le mot de passe.';
      return;
    }

    this.successMessage = 'Votre mot de passe a été mis à jour. Vous allez être redirigé vers la page de connexion.';
    this.resetForm.reset();

    this.redirectTimeoutId = window.setTimeout(() => {
      this.router.navigate(['/login'], {
        queryParams: {
          message: 'Votre mot de passe a été mis à jour. Vous pouvez vous connecter.',
        },
        replaceUrl: true,
      });
    }, 2500);
  }

  get passwordField() {
    return this.resetForm.get('password');
  }

  get confirmPasswordField() {
    return this.resetForm.get('confirmPassword');
  }

  private async prepareRecoverySession(): Promise<boolean> {
    const typeParam = this.route.snapshot.queryParamMap.get('type');
    const fragmentParams = this.getHashParams();
    const recoveryType = typeParam || fragmentParams.get('type');

    if (recoveryType && recoveryType !== 'recovery') {
      this.errorMessage = 'Le lien de réinitialisation est invalide ou expiré.';
      return false;
    }

    const codeFromQuery = this.route.snapshot.queryParamMap.get('code');
    const codeFromFragment = fragmentParams.get('code');
    const code = codeFromQuery || codeFromFragment;

    if (code) {
      const { error } = await this.supabaseService.client.auth.exchangeCodeForSession(code);
      if (error) {
        this.errorMessage = error.message || 'Le lien de réinitialisation est invalide ou expiré.';
        return false;
      }
    }

    const session = await this.ensureSessionIsAvailable();
    if (!session) {
      this.errorMessage =
        'Nous n’avons pas pu valider votre lien de réinitialisation. Veuillez renouveler la procédure depuis la page de connexion.';
      return false;
    }

    return true;
  }

  private listenForRecoveryEvents() {
    const { data } = this.supabaseService.client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        await this.ensureSessionIsAvailable();
      }

      if (event === 'SIGNED_OUT') {
        this.errorMessage =
          'Votre session n’est plus valide. Veuillez demander un nouveau lien de réinitialisation.';
      }
    });

    this.authSubscription = data.subscription;
  }

  private getHashParams(): URLSearchParams {
    if (typeof window === 'undefined' || !window.location.hash) {
      return new URLSearchParams();
    }

    return new URLSearchParams(window.location.hash.replace(/^#/, ''));
  }

  private async ensureSessionIsAvailable(): Promise<Session | null> {
    const session = await this.authService.getSession();

    if (session) {
      return session;
    }

    // Attendre légèrement au cas où Supabase n’a pas encore fini de traiter le hash
    await new Promise(resolve => setTimeout(resolve, 300));
    return this.authService.getSession();
  }
}


