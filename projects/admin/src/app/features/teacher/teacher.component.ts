import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService, ErrorSnackbarService, SupabaseService } from '../../shared';
import { Application } from './components/application/application';
import { TeacherStore } from './store/index';
import type { Teacher } from './types/teacher';

@Component({
  selector: 'app-teacher',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './teacher.component.html',
  styleUrl: './teacher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherComponent implements OnInit {
  private readonly application = inject(Application);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly errorSnackbarService = inject(ErrorSnackbarService);
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  readonly store = inject(TeacherStore);
  
  readonly teacherEmail = signal<string | null>(null);

  // Signals pour contrôler l'affichage
  readonly showForm = signal(true);
  readonly showSuccess = signal(false);

  // Formulaires réactifs
  teacherForm!: FormGroup;

  // Computed signals
  readonly teacher = computed(() => this.store.teacher());
  readonly isLoading = computed(() => this.store.isLoading());
  readonly error = computed(() => this.store.error());
  readonly hasError = computed(() => this.error().length > 0);
  readonly isCreating = computed(() => !this.teacher()); // Si pas de teacher, on crée
  readonly buttonText = computed(() => this.isCreating() ? 'Ajouter' : 'Modifier');

  constructor() {
    // Écouter les changements du teacher dans le store pour remplir le formulaire
    effect(() => {
      const teacher = this.teacher();
      if (teacher && this.teacherForm) {
        this.populateForm(teacher);
      }
    });

    // Écouter les changements d'erreur dans le store et afficher les snackbars
    effect(() => {
      const errors = this.error();
      if (errors.length > 0) {
        // Afficher toutes les erreurs dans des snackbars séparées
        this.errorSnackbarService.showErrors(errors);
        // Réinitialiser les erreurs après affichage
        this.store.clearError();
      }
    });
  }

  ngOnInit(): void {
    this.initializeForms();
    this.loadTeacherData();
  }

  private initializeForms(): void {
    this.teacherForm = this.fb.group({
      fullname: ['', [Validators.required]],
      bio: [''],
      phone: [''],
      avatar_url: [''],
      share_email: [false],
      share_phone: [false],
    });
  }

  private async loadTeacherData(): Promise<void> {
    this.application.loadTeacherProfile();
    
    // Charger l'email de l'utilisateur connecté
    try {
      const { data: sessionData } = await this.supabaseService.client.auth.getSession();
      if (sessionData?.session && sessionData.session.user?.email) {
        this.teacherEmail.set(sessionData.session.user.email);
      }
    } catch (err) {
      console.warn('Impossible de récupérer l\'email:', err);
    }
  }


  private populateForm(teacher: Teacher): void {
    this.teacherForm.patchValue({
      fullname: teacher.fullname || '',
      bio: teacher.bio || '',
      phone: teacher.phone || '',
      avatar_url: teacher.avatar_url || '',
      share_email: teacher.share_email ?? false,
      share_phone: teacher.share_phone ?? false,
    });
  }

  onSubmit(): void {
    if (this.teacherForm.valid) {
      const formValue = this.teacherForm.value;
      const profileData = {
        fullname: formValue.fullname || null,
        bio: formValue.bio || null,
        phone: formValue.phone || null,
        avatar_url: formValue.avatar_url || null,
        share_email: formValue.share_email ?? false,
        share_phone: formValue.share_phone ?? false,
      };

      if (this.isCreating()) {
        // Créer le profil
        this.application.createTeacherProfile(profileData);
      } else {
        // Mettre à jour le profil
        this.application.updateTeacherProfile(profileData);
      }

      // Afficher le message de succès (réactif, sans timer)
      this.showSuccess.set(true);
    }
  }

  onCancel(): void {
    // Recharger les données du teacher pour annuler les modifications
    const teacher = this.teacher();
    if (teacher) {
      this.populateForm(teacher);
    }
  }


}

