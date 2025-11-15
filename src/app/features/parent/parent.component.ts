import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ParentStore } from './store/index';
import { Application } from './components/application/application';
import type { Parent } from './types/parent';

@Component({
  selector: 'app-parent',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './parent.component.html',
  styleUrl: './parent.component.scss',
})
export class ParentComponent implements OnInit {
  private readonly application = inject(Application);
  private readonly fb = inject(FormBuilder);
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

  constructor() {
    // Écouter les changements du parent dans le store pour remplir le formulaire
    effect(() => {
      const parent = this.parent();
      if (parent && this.parentForm) {
        this.populateForm(parent);
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
      this.application.updateParentProfile({
        fullname: formValue.fullname || null,
        phone: formValue.phone || null,
        address: formValue.address || null,
        city: formValue.city || null,
        country: formValue.country || null,
        avatar_url: formValue.avatar_url || null,
      });

      // Afficher le message de succès
      this.showSuccess.set(true);
      setTimeout(() => {
        this.showSuccess.set(false);
      }, 3000);
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

