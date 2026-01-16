import { Component, inject, signal, computed, OnInit, effect, OnDestroy, runInInjectionContext, Injector, EffectRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ChildStore } from './store/index';
import { Application } from './components/application/application';
import { ErrorSnackbarService, SchoolLevelSelectComponent, SchoolsStore, SmartWordSearchComponent } from '../../shared';
import { SchoolService } from '../../features/teacher/services/school/school.service';
import type { Child } from './types/child';
import type { School } from './types/school';
import { firstValueFrom } from 'rxjs';
import { AvatarPinGeneratorComponent } from './components/avatar-pin-generator/avatar-pin-generator.component';

@Component({
  selector: 'app-child',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SchoolLevelSelectComponent, AvatarPinGeneratorComponent, SmartWordSearchComponent],
  templateUrl: './child.component.html',
  styleUrl: './child.component.scss',
})
export class ChildComponent implements OnInit, OnDestroy {
  private readonly application = inject(Application);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly schoolsStore = inject(SchoolsStore);
  private readonly schoolService = inject(SchoolService);
  private readonly errorSnackbarService = inject(ErrorSnackbarService);
  private readonly injector = inject(Injector);
  readonly store = inject(ChildStore);
  

  // Signals pour contrôler l'affichage
  readonly showForm = signal(true);
  readonly showSuccess = signal(false);
  readonly showCopySelection = signal(false);
  readonly sourceChildId = signal<string | null>(null);

  // Écoles - utiliser le store
  readonly schools = computed(() => this.schoolsStore.schools());
  readonly showOtherSchoolInput = signal(false);
  readonly otherSchoolName = signal('');

  // Avatar et PIN
  readonly avatarSeed = signal<string | null>(null);
  readonly avatarStyle = signal<'fun-emoji' | 'bottts'>('fun-emoji');
  readonly loginPin = signal<string | null>(null);
  readonly avatarPinValid = signal(false);

  // Formulaire réactif
  childForm!: FormGroup;

  // Computed signals
  readonly selectedChild = computed(() => this.store.selectedChild());
  readonly children = computed(() => this.store.children());
  readonly isLoading = computed(() => this.store.isLoading());
  readonly error = computed(() => this.store.error());
  readonly hasError = computed(() => this.error().length > 0);
  readonly currentChildId = computed(() => this.route.snapshot.paramMap.get('id'));
  readonly isCreating = computed(() => {
    // On crée si on n'a pas d'ID dans la route
    // (avoir un selectedChild ne signifie pas qu'on édite, ça peut être pour copier)
    return this.currentChildId() === null;
  });
  readonly buttonText = computed(() => this.isCreating() ? 'Ajouter' : 'Modifier');

  constructor() {
    // Écouter les changements de l'enfant sélectionné dans le store pour remplir le formulaire
    effect(() => {
      const child = this.selectedChild();
      const isLoading = this.isLoading();
      const isCreating = this.isCreating();
      const isCopyMode = this.sourceChildId() !== null && this.currentChildId() === null;
      
      // Ne remplir le formulaire que si on n'est pas en train de charger
      // et que le formulaire existe
      // Permettre le remplissage en mode édition OU en mode copie
      if (child && this.childForm && !isLoading && (!isCreating || isCopyMode)) {
        this.populateForm(child);
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

  // Effects pour gérer les réactions aux changements (créés conditionnellement dans ngOnInit)
  private childListEffect?: EffectRef;
  private createChildEffect?: EffectRef;
  private updateChildEffect?: EffectRef;

  async ngOnInit(): Promise<void> {
    this.initializeForm();
    
    // Charger toutes les écoles (utilise le cache si déjà initialisé)
    this.schoolsStore.loadSchools();
    
    // Charger tous les enfants
    this.application.loadChildren();
    
    // Vérifier si on a un ID dans la route (édition)
    const childId = this.route.snapshot.paramMap.get('id');
    if (childId) {
      // Charger l'enfant spécifique pour l'édition
      this.application.loadChildById(childId);
      this.showForm.set(true);
      this.showCopySelection.set(false);
    } else {
      // Vérifier s'il y a un paramètre query pour copier depuis un enfant
      const copyFrom = this.route.snapshot.queryParamMap.get('copyFrom');
      if (copyFrom) {
        this.sourceChildId.set(copyFrom);
        // Charger l'enfant source pour pré-remplir le formulaire
        this.application.loadChildById(copyFrom);
        this.showForm.set(true);
        this.showCopySelection.set(false);
      } else {
        this.store.setSelectedChild(null);
        this.sourceChildId.set(null);
        this.showForm.set(false);
        this.showCopySelection.set(false);
        // Réagir de façon réactive au chargement des enfants
        // Utiliser runInInjectionContext pour créer l'effect dans un contexte d'injection
        this.childListEffect = runInInjectionContext(this.injector, () => {
          return effect(() => {
            const loading = this.isLoading();
            const list = this.children();
            const alreadyCopying = this.sourceChildId() !== null;
            const formAlreadyShown = this.showForm();
            
            // Ne pas réafficher le menu de sélection si on est déjà en train de copier ou si le formulaire est déjà affiché
            if (!loading && !alreadyCopying && !formAlreadyShown) {
              if (list.length > 0) {
                this.showCopySelection.set(true);
                this.showForm.set(false);
              } else {
                this.showForm.set(true);
                this.showCopySelection.set(false);
              }
            }
          });
        });
      }
    }
  }

  private initializeForm(): void {
    this.childForm = this.fb.group({
      firstname: ['', [Validators.required]],
      lastname: ['', [Validators.required]],
      birthdate: ['', [this.birthdateValidator.bind(this)]],
      gender: [''],
      school_id: [''], // null ou ID d'école ou 'other'
      school_level: [''],
      notes: [''],
      avatar_url: [''],
    });

    // Écouter les changements de school_id pour afficher/masquer le champ "Autre"
    this.childForm.get('school_id')?.valueChanges.subscribe((value) => {
      this.showOtherSchoolInput.set(value === 'other');
      if (value !== 'other') {
        this.otherSchoolName.set('');
      }
    });

    // Écouter les changements de genre pour mettre à jour l'avatar
    this.childForm.get('gender')?.valueChanges.subscribe((gender) => {
      // Le composant avatar-pin-generator se mettra à jour automatiquement via l'input binding
    });
  }

  selectCreateFromScratch(): void {
    // Désactiver l'effet qui gère l'affichage du menu de sélection
    if (this.childListEffect) {
      this.childListEffect.destroy();
      this.childListEffect = undefined;
    }
    this.showCopySelection.set(false);
    this.sourceChildId.set(null);
    this.store.setSelectedChild(null); // S'assurer qu'aucun enfant n'est sélectionné
    this.avatarSeed.set(null);
    this.avatarStyle.set('fun-emoji');
    this.loginPin.set(null);
    this.initializeForm(); // Réinitialiser le formulaire vide
    this.showForm.set(true);
  }

  selectCopyFrom(childId: string): void {
    // Désactiver l'effet qui gère l'affichage du menu de sélection
    if (this.childListEffect) {
      this.childListEffect.destroy();
      this.childListEffect = undefined;
    }
    this.showCopySelection.set(false);
    this.sourceChildId.set(childId);
    this.showForm.set(true);
    this.application.loadChildById(childId);
    // Note: Le formulaire sera rempli automatiquement par l'effet quand l'enfant sera chargé
    // Mais on va vider le prénom pour forcer une modification
  }

  private populateForm(child: Child): void {
    // Ne remplir le formulaire que si on n'est pas en train de charger
    if (!this.isLoading()) {
      const isCopyMode = this.sourceChildId() !== null && this.currentChildId() === null;
      
      // Convertir la date de yyyy-mm-dd vers dd/mm/yyyy pour l'affichage
      const formattedBirthdate = child.birthdate ? this.formatDateForDisplay(child.birthdate) : '';
      
      this.childForm.patchValue({
        // Si on est en mode copie, vider le prénom pour forcer une modification
        firstname: isCopyMode ? '' : (child.firstname || ''),
        lastname: child.lastname || '',
        birthdate: formattedBirthdate,
        gender: child.gender || '',
        school_id: child.school_id || '',
        school_level: child.school_level || '',
        notes: child.notes || '',
        avatar_url: child.avatar_url || '',
      });

      // Mettre à jour les signaux pour avatar et PIN
      this.avatarSeed.set(child.avatar_seed || null);
      this.avatarStyle.set((child.avatar_style as 'fun-emoji' | 'bottts') || 'fun-emoji');
      this.loginPin.set(child.login_pin || null);
      
      // Si on est en mode copie, marquer le prénom comme requis et touché pour afficher l'erreur
      if (isCopyMode) {
        this.childForm.get('firstname')?.markAsTouched();
      }
    }
  }

  async onSubmit(): Promise<void> {
    if (this.childForm.valid) {
      const formValue = this.childForm.value;
      
      // Si on est en mode copie, vérifier qu'au moins un champ a été modifié
      const isCopyMode = this.sourceChildId() !== null && this.currentChildId() === null;
      if (isCopyMode) {
        const sourceChild = this.store.children().find(c => c.id === this.sourceChildId());
        if (sourceChild) {
          // Vérifier que le prénom est différent (obligatoire)
          const firstNameChanged = formValue.firstname && 
            formValue.firstname.trim() !== '' && 
            formValue.firstname.trim().toLowerCase() !== (sourceChild.firstname || '').trim().toLowerCase();
          
          if (!firstNameChanged) {
            this.childForm.get('firstname')?.setErrors({ 
              required: true, 
              sameAsSource: true 
            });
            this.childForm.get('firstname')?.markAsTouched();
            this.store.setError('Le prénom doit être différent de l\'enfant source.');
            return;
          }
          
          // Vérifier qu'au moins un autre champ est différent
          // Convertir la date source pour la comparaison (formValue est en dd/mm/yyyy, sourceChild est en yyyy-mm-dd)
          const sourceBirthdateFormatted = sourceChild.birthdate ? this.formatDateForDisplay(sourceChild.birthdate) : '';
          const hasOtherChanges = 
            (formValue.lastname || '').trim() !== (sourceChild.lastname || '').trim() ||
            (formValue.birthdate || '') !== sourceBirthdateFormatted ||
            (formValue.gender || '') !== (sourceChild.gender || '') ||
            (formValue.school_id || '') !== (sourceChild.school_id || '') ||
            (formValue.school_level || '') !== (sourceChild.school_level || '') ||
            (formValue.notes || '').trim() !== (sourceChild.notes || '').trim() ||
            (formValue.avatar_url || '').trim() !== (sourceChild.avatar_url || '').trim();
          
          if (!hasOtherChanges) {
            // Aucun autre champ n'a été modifié, afficher un message d'erreur
            this.store.setError('Vous devez modifier au moins un champ en plus du prénom pour créer un nouvel enfant.');
            return;
          }
        }
      }
      
      // Gérer la création d'une école "Autre" si nécessaire
      let finalSchoolId: string | null = null;
      
      if (formValue.school_id === 'other') {
        // Si "Autre" est sélectionné, créer une nouvelle école
        if (this.otherSchoolName().trim()) {
          this.schoolService.createSchool({
            name: this.otherSchoolName().trim(),
            address: null,
            city: null,
            country: null,
            metadata: null,
          }).subscribe({
            next: (result) => {
              if (result.school) {
                // Mettre à jour le store avec la nouvelle école
                this.schoolsStore.addSchoolToCache(result.school);
                finalSchoolId = result.school.id;
                this.createOrUpdateChild(finalSchoolId, formValue);
              } else {
                this.store.setError(result.error?.message || 'Erreur lors de la création de l\'école');
              }
            },
            error: () => {
              this.store.setError('Erreur lors de la création de l\'école');
            }
          });
          return; // Attendre la création de l'école
        } else {
          this.store.setError('Veuillez remplir le nom de l\'école');
          return;
        }
      } else if (formValue.school_id) {
        finalSchoolId = formValue.school_id;
      }

      // Valider l'unicité de la paire (avatar_seed, login_pin) avant de sauvegarder
      const currentAvatarSeed = this.avatarSeed();
      const currentLoginPin = this.loginPin();
      
      if (currentAvatarSeed && currentLoginPin) {
        const childId = this.currentChildId();
        try {
          const uniquenessResult = await firstValueFrom(
            this.application.checkAvatarPinUniqueness(currentAvatarSeed, currentLoginPin, childId || undefined)
          );
          
          if (!uniquenessResult.isUnique) {
            this.store.setError('Cette combinaison d\'avatar et de code PIN est déjà utilisée. Veuillez générer un nouvel avatar ou changer le code PIN.');
            return;
          }
        } catch (error) {
          console.error('Error checking avatar/pin uniqueness:', error);
          // En cas d'erreur, on continue pour ne pas bloquer l'utilisateur
        }
      }

      this.createOrUpdateChild(finalSchoolId, formValue);
    }
  }

  private createOrUpdateChild(schoolId: string | null, formValue: { firstname: string; lastname: string; birthdate: string; gender: string; school_id: string; school_level: string; notes: string; avatar_url: string }): void {
    // Convertir la date de dd/mm/yyyy vers yyyy-mm-dd pour la base de données
    const dbBirthdate = formValue.birthdate ? this.formatDateForDatabase(formValue.birthdate) : null;
    
    const profileData = {
      firstname: formValue.firstname || null,
      lastname: formValue.lastname || null,
      birthdate: dbBirthdate,
      gender: formValue.gender || null,
      school_id: schoolId,
      school_level: formValue.school_level || null,
      notes: formValue.notes || null,
      avatar_url: formValue.avatar_url || null,
      avatar_seed: this.avatarSeed() || null,
      avatar_style: this.avatarStyle() || null,
      login_pin: this.loginPin() || null,
    };

    const wasCreating = this.isCreating();
    const childId = this.route.snapshot.paramMap.get('id');

    if (wasCreating) {
      // Créer le profil et réagir via un effet à l'ajout
      const initialCount = this.store.children().length;
      
      // Détruire l'effet précédent s'il existe
      if (this.createChildEffect) {
        this.createChildEffect.destroy();
      }
      
      this.application.createChildProfile(profileData);
      
      // Créer l'effet dans un contexte d'injection
      this.createChildEffect = runInInjectionContext(this.injector, () => {
        return effect(() => {
          const loading = this.isLoading();
          const current = this.store.children().length;
          if (!loading && current > initialCount) {
            this.showSuccess.set(true);
            this.application.loadChildren();
            this.router.navigate(['/dashboard']);
            // Détruire l'effet après navigation
            if (this.createChildEffect) {
              this.createChildEffect.destroy();
              this.createChildEffect = undefined;
            }
          }
        });
      });
    } else if (childId) {
      // Mettre à jour le profil et marquer le succès de façon réactive
      
      // Détruire l'effet précédent s'il existe
      if (this.updateChildEffect) {
        this.updateChildEffect.destroy();
      }
      
      this.application.updateChildProfile(childId, profileData);
      
      // Créer l'effet dans un contexte d'injection
      this.updateChildEffect = runInInjectionContext(this.injector, () => {
        return effect(() => {
          const loading = this.isLoading();
          if (!loading) {
            this.showSuccess.set(true);
            // Détruire l'effet après affichage du succès
            if (this.updateChildEffect) {
              this.updateChildEffect.destroy();
              this.updateChildEffect = undefined;
            }
          }
        });
      });
    }
  }

  ngOnDestroy(): void {
    // Désactiver l'effet de gestion du menu de sélection
    if (this.childListEffect) {
      this.childListEffect.destroy();
      this.childListEffect = undefined;
    }
    // Désactiver les effets de création/mise à jour
    if (this.createChildEffect) {
      this.createChildEffect.destroy();
      this.createChildEffect = undefined;
    }
    if (this.updateChildEffect) {
      this.updateChildEffect.destroy();
      this.updateChildEffect = undefined;
    }
  }

  onCancel(): void {
    // Recharger les données de l'enfant pour annuler les modifications
    const child = this.selectedChild();
    if (child) {
      this.populateForm(child);
    } else {
      // Si on annule une création, retourner au dashboard
      this.router.navigate(['/dashboard']);
    }
  }

  onAvatarSeedChange(seed: string | null): void {
    this.avatarSeed.set(seed);
  }

  onAvatarStyleChange(style: 'fun-emoji' | 'bottts'): void {
    this.avatarStyle.set(style);
  }

  onLoginPinChange(pin: string | null): void {
    this.loginPin.set(pin);
  }

  onValidationChange(isValid: boolean): void {
    this.avatarPinValid.set(isValid);
  }

  /**
   * Convertit une date du format yyyy-mm-dd (base de données) vers dd/mm/yyyy (affichage)
   */
  private formatDateForDisplay(dateString: string): string {
    if (!dateString) return '';
    
    // Si la date est déjà au format dd/mm/yyyy, la retourner telle quelle
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
      return dateString;
    }
    
    // Convertir de yyyy-mm-dd vers dd/mm/yyyy
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    
    return dateString;
  }

  /**
   * Convertit une date du format dd/mm/yyyy (affichage) vers yyyy-mm-dd (base de données)
   */
  private formatDateForDatabase(dateString: string): string | null {
    if (!dateString || dateString.trim() === '') return null;
    
    // Si la date est déjà au format yyyy-mm-dd, la retourner telle quelle
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Convertir de dd/mm/yyyy vers yyyy-mm-dd
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      
      // Valider que c'est une date valide
      const date = new Date(`${year}-${month}-${day}`);
      if (isNaN(date.getTime())) {
        return null;
      }
      
      return `${year}-${month}-${day}`;
    }
    
    return null;
  }

  /**
   * Valide le format de date dd/mm/yyyy
   */
  validateDateFormat(dateString: string): boolean {
    if (!dateString || dateString.trim() === '') return true; // Vide est valide (optionnel)
    
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(dateString)) {
      return false;
    }
    
    const parts = dateString.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    // Vérifier que les valeurs sont dans des plages valides
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > 2100) return false;
    
    // Vérifier que c'est une date valide
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return false;
    }
    
    return true;
  }

  /**
   * Validateur personnalisé pour le champ birthdate
   */
  private birthdateValidator(control: any): { [key: string]: any } | null {
    const value = control.value;
    if (!value || value.trim() === '') {
      return null; // Vide est valide (optionnel)
    }
    
    if (!this.validateDateFormat(value)) {
      return { invalidFormat: true };
    }
    
    return null;
  }

  /**
   * Gère le formatage automatique de la date pendant la saisie
   */
  onBirthdateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); // Supprimer tout sauf les chiffres
    
    // Limiter à 8 chiffres (ddmmyyyy)
    if (value.length > 8) {
      value = value.substring(0, 8);
    }
    
    // Formater avec des slashes
    let formatted = value;
    if (value.length > 2) {
      formatted = value.substring(0, 2) + '/' + value.substring(2);
    }
    if (value.length > 4) {
      formatted = value.substring(0, 2) + '/' + value.substring(2, 4) + '/' + value.substring(4);
    }
    
    // Mettre à jour la valeur dans le formulaire
    const control = this.childForm.get('birthdate');
    if (control) {
      control.setValue(formatted, { emitEvent: false });
      
      // Valider le format
      if (formatted && !this.validateDateFormat(formatted)) {
        control.setErrors({ invalidFormat: true });
      } else {
        control.setErrors(null);
      }
    }
  }

  /**
   * Handler appelé quand des mots sont liés à l'enfant
   */
  onWordsLinked(wordIds: string[]): void {
    // Optionnel: Afficher un message de succès ou rafraîchir les données
    console.log('Mots liés avec succès:', wordIds);
    // Vous pouvez ajouter ici une notification de succès si nécessaire
  }
}
