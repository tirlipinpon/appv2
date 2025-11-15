import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ChildStore } from './store/index';
import { Application } from './components/application/application';
import type { Child } from './types/child';

@Component({
  selector: 'app-child',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './child.component.html',
  styleUrl: './child.component.scss',
})
export class ChildComponent implements OnInit {
  private readonly application = inject(Application);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(ChildStore);

  // Signals pour contrôler l'affichage
  readonly showForm = signal(true);
  readonly showSuccess = signal(false);
  readonly showCopySelection = signal(false);
  readonly sourceChildId = signal<string | null>(null);

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
      
      // Ne remplir le formulaire que si on n'est pas en train de charger
      // et que le formulaire existe
      if (child && this.childForm && !isLoading) {
        this.populateForm(child);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.initializeForm();
    
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
        // Utiliser un effet pour détecter quand les enfants sont chargés
        // Attendre que le chargement soit terminé
        const checkChildren = () => {
          if (!this.isLoading()) {
            if (this.children().length > 0) {
              // Si on a déjà des enfants, proposer de créer from scratch ou copier
              this.showCopySelection.set(true);
              this.showForm.set(false);
            } else {
              // Pas d'enfants, afficher directement le formulaire
              this.showForm.set(true);
              this.showCopySelection.set(false);
            }
          } else {
            // Si encore en chargement, réessayer après un court délai
            setTimeout(checkChildren, 100);
          }
        };
        
        // Démarrer la vérification après un court délai initial
        setTimeout(checkChildren, 200);
      }
    }
  }

  private initializeForm(): void {
    this.childForm = this.fb.group({
      firstname: ['', [Validators.required]],
      lastname: ['', [Validators.required]],
      birthdate: [''],
      gender: [''],
      school_level: [''],
      notes: [''],
      avatar_url: [''],
    });
  }

  selectCreateFromScratch(): void {
    this.showCopySelection.set(false);
    this.sourceChildId.set(null);
    this.store.setSelectedChild(null); // S'assurer qu'aucun enfant n'est sélectionné
    this.initializeForm(); // Réinitialiser le formulaire vide
    this.showForm.set(true);
  }

  selectCopyFrom(childId: string): void {
    this.showCopySelection.set(false);
    this.sourceChildId.set(childId);
    this.showForm.set(true);
    this.application.loadChildById(childId);
  }

  private populateForm(child: Child): void {
    // Ne remplir le formulaire que si on n'est pas en train de charger
    if (!this.isLoading()) {
      this.childForm.patchValue({
        firstname: child.firstname || '',
        lastname: child.lastname || '',
        birthdate: child.birthdate || '',
        gender: child.gender || '',
        school_level: child.school_level || '',
        notes: child.notes || '',
        avatar_url: child.avatar_url || '',
      });
    }
  }

  onSubmit(): void {
    if (this.childForm.valid) {
      const formValue = this.childForm.value;
      const profileData = {
        firstname: formValue.firstname || null,
        lastname: formValue.lastname || null,
        birthdate: formValue.birthdate || null,
        gender: formValue.gender || null,
        school_level: formValue.school_level || null,
        notes: formValue.notes || null,
        avatar_url: formValue.avatar_url || null,
      };

      const wasCreating = this.isCreating();
      const childId = this.route.snapshot.paramMap.get('id');

      if (wasCreating) {
        // Créer le profil
        this.application.createChildProfile(profileData);
        
        // Attendre que la création soit terminée
        let checkCount = 0;
        const maxChecks = 50; // 5 secondes max (50 * 100ms)
        const initialChildrenCount = this.store.children().length;
        
        const checkCreation = setInterval(() => {
          checkCount++;
          const currentChildren = this.store.children();
          const stillLoading = this.isLoading();
          
          // Si le chargement est terminé et qu'on a un nouvel enfant, la création est réussie
          if (!stillLoading && currentChildren.length > initialChildrenCount) {
            clearInterval(checkCreation);
            this.showSuccess.set(true);
            // Recharger la liste pour s'assurer qu'elle est à jour
            this.application.loadChildren();
            setTimeout(() => {
              this.showSuccess.set(false);
              this.router.navigate(['/dashboard']);
            }, 2000);
          } else if (checkCount >= maxChecks) {
            // Timeout de sécurité
            clearInterval(checkCreation);
            this.showSuccess.set(true);
            this.application.loadChildren();
            setTimeout(() => {
              this.showSuccess.set(false);
              this.router.navigate(['/dashboard']);
            }, 2000);
          }
        }, 100);
      } else if (childId) {
        // Mettre à jour le profil
        this.application.updateChildProfile(childId, profileData);
        
        // Afficher le message de succès
        setTimeout(() => {
          this.showSuccess.set(true);
          setTimeout(() => {
            this.showSuccess.set(false);
          }, 3000);
        }, 100);
      }
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
}

