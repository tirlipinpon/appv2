import { Component, OnInit, inject, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService, Profile } from '../../shared/services/auth/auth.service';
import { ParentStore } from '../parent/store/index';
import { ChildrenStore } from '../../shared/store/children.store';
import { TeacherStore } from '../teacher/store/index';
import { TeacherAssignmentStore } from '../teacher/store/assignments.store';
import { Child } from '../child/types/child';
import { ActionLinksComponent, ActionLink } from '../../shared/components/action-links/action-links.component';
import { AssignmentsSectionComponent } from '../teacher/components/assignments/components/assignments-section/assignments-section.component';
import { AppInitializationService } from '../../shared/services/initialization/app-initialization.service';
import { ParentSubjectService } from '../child/services/subject/parent-subject.service';
import { forkJoin, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ActionLinksComponent, AssignmentsSectionComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly appInitializationService = inject(AppInitializationService);
  private readonly parentSubjectService = inject(ParentSubjectService);
  readonly parentStore = inject(ParentStore);
  readonly childStore = inject(ChildrenStore);
  readonly teacherStore = inject(TeacherStore);
  readonly teacherAssignmentStore = inject(TeacherAssignmentStore);
  profile: Profile | null = null;
  activeRole: string | null = null;
  private lastLoadedTeacherId: string | null = null;
  private readonly activeRoleSig = signal<string | null>(null);

  // Signal pour stocker les statistiques de matières par enfant
  private readonly childStatsSig = signal<Map<string, { subjectsCount: number; categoriesCount: number }>>(new Map());

  // Computed signals pour le bouton parent
  readonly hasParent = computed(() => this.parentStore.hasParent());
  readonly parentButtonText = computed(() => this.hasParent() ? 'Éditer mon profil' : 'Créer mon profil');
  readonly isCreatingParent = computed(() => !this.hasParent());

  // Computed signals pour le bouton professeur
  readonly hasTeacher = computed(() => this.teacherStore.hasTeacher());
  readonly teacherButtonText = computed(() => this.hasTeacher() ? 'Éditer mon profil' : 'Créer mon profil');

  // Computed signals pour les enfants
  readonly children = computed(() => this.childStore.children());
  readonly activeChildren = computed(() => this.children().filter(c => c.is_active));
  readonly inactiveChildren = computed(() => this.children().filter(c => !c.is_active));
  readonly hasChildren = computed(() => this.childStore.hasChildren());
  readonly hasActiveChildren = computed(() => this.activeChildren().length > 0);
  readonly hasInactiveChildren = computed(() => this.inactiveChildren().length > 0);
  readonly childrenCount = computed(() => this.activeChildren().length);

  // Computed signals pour les actions
  readonly parentActions = computed<ActionLink[]>(() => {
    return [
      {
        label: this.parentButtonText(),
        route: '/parent-profile',
        variant: this.isCreatingParent() ? 'add' : 'edit'
      },
      {
        label: 'Ajouter un enfant',
        route: '/child-profile',
        icon: '➕',
        variant: 'add'
      }
    ];
  });

  readonly teacherActions = computed<ActionLink[]>(() => {
    return [
      {
        label: this.teacherButtonText(),
        route: '/teacher-profile',
        variant: this.hasTeacher() ? 'edit' : 'add'
      },
      {
        label: 'Ajouter une affectation',
        route: '/teacher-assignments',
        queryParams: { add: 'true' },
        icon: '➕',
        variant: 'add'
      }
    ];
  });

  // Effect créé en contexte d'injection (champ de classe), pas dans ngOnInit
  private readonly loadAssignmentsEffect = effect(() => {
    if (this.activeRoleSig() === 'prof') {
      const teacher = this.teacherStore.teacher();
      if (teacher && this.lastLoadedTeacherId !== teacher.id) {
        this.lastLoadedTeacherId = teacher.id;
        this.teacherAssignmentStore.loadAssignments(teacher.id);
      }
    }
  });

  // Effect pour charger les statistiques de matières pour chaque enfant actif
  private lastLoadedChildrenIds: string[] = [];
  private readonly loadChildStatsEffect = effect(() => {
    if (this.activeRoleSig() === 'parent') {
      const activeChildren = this.activeChildren();
      if (activeChildren.length > 0) {
        // Vérifier si les enfants ont changé pour éviter les rechargements inutiles
        const currentIds = activeChildren.map(c => c.id).sort().join(',');
        const lastIds = this.lastLoadedChildrenIds.sort().join(',');
        
        if (currentIds !== lastIds) {
          this.lastLoadedChildrenIds = activeChildren.map(c => c.id);
          this.loadChildrenStats(activeChildren);
        }
      }
    }
  });

  // Méthode pour charger les statistiques de tous les enfants
  private loadChildrenStats(children: Child[]): void {
    const statsMap = new Map<string, { subjectsCount: number; categoriesCount: number }>();
    
    // Initialiser toutes les entrées avec 0 pour éviter les erreurs d'affichage
    children.forEach(child => {
      statsMap.set(child.id, { subjectsCount: 0, categoriesCount: 0 });
    });
    
    this.childStatsSig.set(statsMap);

    // Charger les stats pour chaque enfant en parallèle
    children.forEach(child => {
      forkJoin({
        enrollments: this.parentSubjectService.getEnrollments(child.id),
        categoryEnrollments: this.parentSubjectService.getCategoryEnrollments(child.id),
        availableSubjects: this.parentSubjectService.getAvailableSubjectsForChild(child)
      }).pipe(
        // Charger les catégories pour les matières sélectionnées ET disponibles
        switchMap(({ enrollments, categoryEnrollments, availableSubjects }) => {
          // Obtenir les IDs des matières disponibles
          const availableSubjectIds = new Set((availableSubjects.subjects || []).map(s => s.id));
          
          // Filtrer les enrollments pour ne garder que ceux qui sont :
          // 1. Sélectionnés (selected=true)
          // 2. Disponibles (présents dans availableSubjects)
          // C'est la même logique que selectedSubjects dans child-subjects.component.ts
          const selectedAndAvailableSubjectIds = enrollments.enrollments
            ?.filter(e => e.selected === true && availableSubjectIds.has(e.subject_id))
            .map(e => e.subject_id) || [];
          
          if (selectedAndAvailableSubjectIds.length === 0) {
            // Pas de matières sélectionnées ET disponibles, retourner avec Map vide pour les catégories
            return of({
              enrollments: { enrollments: enrollments.enrollments || [], error: enrollments.error },
              categoryEnrollments: { enrollments: categoryEnrollments.enrollments || [], error: categoryEnrollments.error },
              categoriesBySubject: new Map<string, Array<{ id: string; subject_id: string }>>(),
              selectedAndAvailableSubjectIds: []
            });
          }
          
          // Charger les catégories pour les matières sélectionnées ET disponibles
          return this.parentSubjectService.getSubjectCategoriesBatch(selectedAndAvailableSubjectIds).pipe(
            map((categoriesResult) => ({
              enrollments: { enrollments: enrollments.enrollments || [], error: enrollments.error },
              categoryEnrollments: { enrollments: categoryEnrollments.enrollments || [], error: categoryEnrollments.error },
              categoriesBySubject: categoriesResult.categoriesBySubject,
              selectedAndAvailableSubjectIds
            }))
          );
        })
      ).subscribe({
        next: ({ enrollments, categoryEnrollments, categoriesBySubject, selectedAndAvailableSubjectIds }) => {
          // Compter uniquement les matières qui sont sélectionnées ET disponibles
          // (même logique que selectedSubjects dans child-subjects.component.ts)
          const subjectsCount = selectedAndAvailableSubjectIds.length;
          
          // Obtenir tous les IDs de catégories pour les matières sélectionnées ET disponibles
          const validCategoryIds = new Set<string>();
          categoriesBySubject.forEach((categories) => {
            categories.forEach(category => {
              validCategoryIds.add(category.id);
            });
          });
          
          // Compter uniquement les catégories qui :
          // 1. Sont sélectionnées (selected=true)
          // 2. Appartiennent aux matières sélectionnées ET disponibles
          const categoriesCount = categoryEnrollments.enrollments?.filter(e => 
            e.selected === true && validCategoryIds.has(e.subject_category_id)
          ).length || 0;
          
          const currentStats = this.childStatsSig();
          currentStats.set(child.id, { subjectsCount, categoriesCount });
          this.childStatsSig.set(new Map(currentStats));
        },
        error: (err) => {
          console.error(`Error loading stats for child ${child.id}:`, err);
          // En cas d'erreur, garder 0 comme valeur par défaut
        }
      });
    });
  }

  // Méthode helper pour obtenir les statistiques d'un enfant
  getChildStats(childId: string): { subjectsCount: number; categoriesCount: number } {
    return this.childStatsSig().get(childId) || { subjectsCount: 0, categoriesCount: 0 };
  }

  // NOTE: Le chargement des stats de jeux est géré par AssignmentsSectionComponent
  // pour éviter les doublons de requêtes réseau

  async ngOnInit() {
    this.profile = await this.authService.getProfile();
    this.activeRole = this.authService.getActiveRole();
    
    // Si aucun rôle actif mais que le profil a des rôles, essayer de restaurer
    if (!this.activeRole && this.profile) {
      if (this.profile.roles.length === 1) {
        // Un seul rôle, le définir automatiquement
        this.authService.setActiveRole(this.profile.roles[0]);
        this.activeRole = this.profile.roles[0];
      } else if (this.profile.roles.length > 1) {
        // Plusieurs rôles, essayer de restaurer le dernier rôle sélectionné
        const user = this.authService.getCurrentUser();
        if (user) {
          try {
            const savedRole = localStorage.getItem(`activeRole_${user.id}`);
            if (savedRole && this.profile.roles.includes(savedRole)) {
              this.authService.setActiveRole(savedRole);
              this.activeRole = savedRole;
            } else {
              // Pas de rôle sauvegardé, rediriger vers le sélecteur
              this.router.navigate(['/select-role']);
              return;
            }
          } catch {
            // En cas d'erreur, rediriger vers le sélecteur
            this.router.navigate(['/select-role']);
            return;
          }
        } else {
          this.router.navigate(['/select-role']);
          return;
        }
      } else {
        // Pas de rôle, rediriger vers le sélecteur
        this.router.navigate(['/select-role']);
        return;
      }
    }
    
    this.activeRoleSig.set(this.activeRole);
    
    // Utiliser AppInitializationService pour charger les données
    // Cela évite les appels répétés si déjà initialisé
    if (this.activeRole) {
      if (!this.appInitializationService.isInitialized(this.activeRole)) {
        this.appInitializationService.initializeForRole(this.activeRole);
      }
      
      // Pour le rôle parent, vérifier le statut après chargement
      if (this.activeRole === 'parent') {
        this.parentStore.checkParentStatus();
      }
      
      // Pour le rôle prof, charger les affectations après que le teacher soit chargé
      // (géré par l'effect ci-dessous)
    }
  }



  trackByChildId(index: number, child: Child): string {
    return child.id;
  }

  setChildActiveStatus(childId: string, isActive: boolean, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!isActive && !confirm('Êtes-vous sûr de vouloir désactiver cet enfant ? Vous pourrez le réactiver plus tard.')) {
      return;
    }
    this.childStore.setActiveStatus({ childId, isActive });
  }

}
