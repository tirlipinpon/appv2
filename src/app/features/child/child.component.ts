import { Component, inject, signal, computed, OnInit, effect, OnDestroy, runInInjectionContext, Injector, EffectRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ChildStore } from './store/index';
import { Application } from './components/application/application';
import { SchoolService } from './services/school/school.service';
import { ErrorSnackbarService } from '../../shared/services/snackbar/error-snackbar.service';
import type { Child } from './types/child';
import type { School } from './types/school';
import { Subscription } from 'rxjs';
import { SchoolLevelSelectComponent } from '../../shared/components/school-level-select/school-level-select.component';

@Component({
  selector: 'app-child',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SchoolLevelSelectComponent],
  templateUrl: './child.component.html',
  styleUrl: './child.component.scss',
})
export class ChildComponent implements OnInit, OnDestroy {
  private readonly application = inject(Application);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly schoolService = inject(SchoolService);
  private readonly errorSnackbarService = inject(ErrorSnackbarService);
  private readonly injector = inject(Injector);
  readonly store = inject(ChildStore);
  

  // Signals pour contrôler l'affichage
  readonly showForm = signal(true);
  readonly showSuccess = signal(false);
  readonly showCopySelection = signal(false);
  readonly sourceChildId = signal<string | null>(null);

  // Écoles
  readonly schools = signal<School[]>([]);
  readonly showOtherSchoolInput = signal(false);
  readonly otherSchoolName = signal('');

  // Formulaire réactif
  childForm!: FormGroup;
  private schoolsSubscription?: Subscription;

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
    
    // Charger toutes les écoles
    this.loadSchools();
    
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
      birthdate: [''],
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
      
      this.childForm.patchValue({
        // Si on est en mode copie, vider le prénom pour forcer une modification
        firstname: isCopyMode ? '' : (child.firstname || ''),
        lastname: child.lastname || '',
        birthdate: child.birthdate || '',
        gender: child.gender || '',
        school_id: child.school_id || '',
        school_level: child.school_level || '',
        notes: child.notes || '',
        avatar_url: child.avatar_url || '',
      });
      
      // Si on est en mode copie, marquer le prénom comme requis et touché pour afficher l'erreur
      if (isCopyMode) {
        this.childForm.get('firstname')?.markAsTouched();
      }
    }
  }

  onSubmit(): void {
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
          const hasOtherChanges = 
            (formValue.lastname || '').trim() !== (sourceChild.lastname || '').trim() ||
            (formValue.birthdate || '') !== (sourceChild.birthdate || '') ||
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
          }).subscribe({
            next: (result) => {
              if (result.school) {
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

      this.createOrUpdateChild(finalSchoolId, formValue);
    }
  }

  private createOrUpdateChild(schoolId: string | null, formValue: { firstname: string; lastname: string; birthdate: string; gender: string; school_id: string; school_level: string; notes: string; avatar_url: string }): void {
    const profileData = {
      firstname: formValue.firstname || null,
      lastname: formValue.lastname || null,
      birthdate: formValue.birthdate || null,
      gender: formValue.gender || null,
      school_id: schoolId,
      school_level: formValue.school_level || null,
      notes: formValue.notes || null,
      avatar_url: formValue.avatar_url || null,
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
    this.schoolsSubscription?.unsubscribe();
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

  private loadSchools(): void {
    this.schoolsSubscription = this.schoolService.getSchools().subscribe({
      next: (schools) => {
        this.schools.set(schools);
      },
      error: (error) => {
        console.error('Error loading schools:', error);
      }
    });
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
}
