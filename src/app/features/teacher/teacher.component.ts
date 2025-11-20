import { Component, inject, signal, computed, OnInit, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { AssignmentsComponent } from './components/assignments/assignments.component';
import { TeacherStore } from './store/index';
import { Application } from './components/application/application';
import { ErrorSnackbarService } from '../../shared/services/snackbar/error-snackbar.service';
import type { Teacher } from './types/teacher';

@Component({
  selector: 'app-teacher',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AssignmentsComponent],
  templateUrl: './teacher.component.html',
  styleUrl: './teacher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherComponent implements OnInit {
  private readonly application = inject(Application);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly errorSnackbarService = inject(ErrorSnackbarService);
  readonly store = inject(TeacherStore);

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
  readonly activeTab = signal<'profile' | 'assignments'>('profile');

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
    const dataTab = this.route.snapshot.data?.['tab'];
    if (dataTab === 'assignments') {
      this.activeTab.set('assignments');
    }
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab');
      this.activeTab.set(tab === 'assignments' ? 'assignments' : 'profile');
    });
  }

  private initializeForms(): void {
    this.teacherForm = this.fb.group({
      fullname: ['', [Validators.required]],
      bio: [''],
      phone: [''],
      avatar_url: [''],
    });
  }

  private loadTeacherData(): void {
    this.application.loadTeacherProfile();
  }


  private populateForm(teacher: Teacher): void {
    this.teacherForm.patchValue({
      fullname: teacher.fullname || '',
      bio: teacher.bio || '',
      phone: teacher.phone || '',
      avatar_url: teacher.avatar_url || '',
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

