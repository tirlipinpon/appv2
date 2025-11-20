import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import type { Child } from '../../types/child';

/**
 * Service de gestion du formulaire enfant
 * Principe SRP : Gère uniquement la logique du formulaire
 */
@Injectable({
  providedIn: 'root',
})
export class ChildFormService {
  private readonly fb = inject(FormBuilder);

  createForm(): FormGroup {
    return this.fb.group({
      firstname: ['', [Validators.required]],
      lastname: ['', [Validators.required]],
      birthdate: [''],
      gender: [''],
      school_id: [''],
      school_level: [''],
      notes: [''],
      avatar_url: [''],
    });
  }

  populateForm(form: FormGroup, child: Child, isCopyMode: boolean = false): void {
    form.patchValue({
      firstname: isCopyMode ? '' : (child.firstname || ''),
      lastname: child.lastname || '',
      birthdate: child.birthdate || '',
      gender: child.gender || '',
      school_id: child.school_id || '',
      school_level: child.school_level || '',
      notes: child.notes || '',
      avatar_url: child.avatar_url || '',
    });
    
    if (isCopyMode) {
      form.get('firstname')?.markAsTouched();
    }
  }

  resetForm(form: FormGroup): void {
    form.reset();
  }

  isFormValid(form: FormGroup): boolean {
    return form.valid;
  }

  getFormData(form: FormGroup): Partial<Child> {
    const formValue = form.value;
    return {
      firstname: formValue.firstname || null,
      lastname: formValue.lastname || null,
      birthdate: formValue.birthdate || null,
      gender: formValue.gender || null,
      school_id: formValue.school_id || null,
      school_level: formValue.school_level || null,
      notes: formValue.notes || null,
      avatar_url: formValue.avatar_url || null,
    };
  }
}
