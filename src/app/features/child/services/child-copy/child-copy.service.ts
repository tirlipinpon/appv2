import { Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';
import type { Child } from '../../types/child';

/**
 * Service de gestion de la copie d'enfants
 * Principe SRP : Gère uniquement la logique de copie
 */
@Injectable({
  providedIn: 'root',
})
export class ChildCopyService {
  
  /**
   * Vérifie si le prénom a été modifié par rapport à l'enfant source
   */
  isFirstNameChanged(formValue: Partial<Child>, sourceChild: Child): boolean {
    return !!formValue.firstname && 
      formValue.firstname.trim() !== '' && 
      formValue.firstname.trim().toLowerCase() !== (sourceChild.firstname || '').trim().toLowerCase();
  }

  /**
   * Vérifie si au moins un autre champ a été modifié
   */
  hasOtherChanges(formValue: Partial<Child>, sourceChild: Child): boolean {
    return (formValue.lastname || '').trim() !== (sourceChild.lastname || '').trim() ||
      (formValue.birthdate || '') !== (sourceChild.birthdate || '') ||
      (formValue.gender || '') !== (sourceChild.gender || '') ||
      (formValue.school_id || '') !== (sourceChild.school_id || '') ||
      (formValue.school_level || '') !== (sourceChild.school_level || '') ||
      (formValue.notes || '').trim() !== (sourceChild.notes || '').trim() ||
      (formValue.avatar_url || '').trim() !== (sourceChild.avatar_url || '').trim();
  }

  /**
   * Valide la copie d'un enfant
   * @returns null si valide, sinon un message d'erreur
   */
  validateCopy(form: FormGroup, sourceChild: Child | undefined): string | null {
    if (!sourceChild) {
      return 'Enfant source introuvable';
    }

    const formValue = form.value;

    if (!this.isFirstNameChanged(formValue, sourceChild)) {
      form.get('firstname')?.setErrors({ 
        required: true, 
        sameAsSource: true 
      });
      form.get('firstname')?.markAsTouched();
      return 'Le prénom doit être différent de l\'enfant source.';
    }

    if (!this.hasOtherChanges(formValue, sourceChild)) {
      return 'Vous devez modifier au moins un champ en plus du prénom pour créer un nouvel enfant.';
    }

    return null;
  }
}
