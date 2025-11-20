import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ParentStore } from './store/index';
import { Application } from './components/application/application';
import { ErrorSnackbarService } from '../../shared/services/snackbar/error-snackbar.service';
import type { Parent } from './types/parent';

@Component({
  selector: 'app-parent',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './parent.component.html',
  styleUrl: './parent.component.scss',
})
export class ParentComponent implements OnInit {
  private readonly application = inject(Application);
  private readonly fb = inject(FormBuilder);
  private readonly errorSnackbarService = inject(ErrorSnackbarService);
  readonly store = inject(ParentStore);

  // Signals pour contrôler l'affichage
  readonly showForm = signal(true);
  readonly showSuccess = signal(false);

  // Formulaire réactif
  parentForm!: FormGroup;

  // Computed signals
  readonly parent = computed(() => this.store.parent());
  readonly isLoading = computed(() => this.store.isLoading());
  readonly error = computed(() => this.store.error());
  readonly hasError = computed(() => this.error().length > 0);
  readonly isCreating = computed(() => !this.parent()); // Si pas de parent, on crée
  readonly buttonText = computed(() => this.isCreating() ? 'Ajouter' : 'Modifier');

  constructor() {
    // Écouter les changements du parent dans le store pour remplir le formulaire
    effect(() => {
      const parent = this.parent();
      if (parent && this.parentForm) {
        this.populateForm(parent);
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
    this.initializeForm();
    this.loadParentData();
  }

  private initializeForm(): void {
    this.parentForm = this.fb.group({
      fullname: ['', [Validators.required]],
      phone: [''],
      address: [''],
      city: [''],
      country: [''],
      avatar_url: [''],
    });
  }

  private loadParentData(): void {
    this.application.loadParentProfile();
  }

  private populateForm(parent: Parent): void {
    this.parentForm.patchValue({
      fullname: parent.fullname || '',
      phone: parent.phone || '',
      address: parent.address || '',
      city: parent.city || '',
      country: parent.country || '',
      avatar_url: parent.avatar_url || '',
    });
  }

  onSubmit(): void {
    if (this.parentForm.valid) {
      const formValue = this.parentForm.value;
      const profileData = {
        fullname: formValue.fullname || null,
        phone: formValue.phone || null,
        address: formValue.address || null,
        city: formValue.city || null,
        country: formValue.country || null,
        preferences: {},
        avatar_url: formValue.avatar_url || null,
      };

      if (this.isCreating()) {
        // Créer le profil
        this.application.createParentProfile(profileData);
      } else {
        // Mettre à jour le profil
        this.application.updateParentProfile(profileData);
      }

      // Afficher le message de succès (réactif, sans timer)
      this.showSuccess.set(true);
    }
  }

  onCancel(): void {
    // Recharger les données du parent pour annuler les modifications
    const parent = this.parent();
    if (parent) {
      this.populateForm(parent);
    }
  }
}

