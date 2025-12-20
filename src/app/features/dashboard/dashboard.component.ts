import { Component, OnInit, OnDestroy, inject, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, NavigationEnd, Router } from '@angular/router';
import { AuthService, Profile } from '../../shared/services/auth/auth.service';
import { ParentStore } from '../parent/store/index';
import { ChildStore } from '../child/store/index';
import { TeacherStore } from '../teacher/store/index';
import { TeacherAssignmentStore } from '../teacher/store/assignments.store';
import { Child } from '../child/types/child';
import { filter, Subscription, forkJoin } from 'rxjs';
import { ActionLinksComponent, ActionLink } from '../../shared/components/action-links/action-links.component';
import { Infrastructure } from '../teacher/components/infrastructure/infrastructure';
import { getSchoolLevelLabel } from '../teacher/utils/school-levels.util';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ActionLinksComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly infrastructure = inject(Infrastructure);
  readonly parentStore = inject(ParentStore);
  readonly childStore = inject(ChildStore);
  readonly teacherStore = inject(TeacherStore);
  readonly teacherAssignmentStore = inject(TeacherAssignmentStore);
  profile: Profile | null = null;
  activeRole: string | null = null;
  private routerSubscription?: Subscription;
  private lastLoadedTeacherId: string | null = null;
  private readonly activeRoleSig = signal<string | null>(null);

  // Stats de jeux par subject_id
  readonly gamesStats = signal<Record<string, { stats: Record<string, number>; total: number }>>({});

  // Computed signals pour le bouton parent
  readonly hasParent = computed(() => this.parentStore.hasParent());
  readonly parentButtonText = computed(() => this.hasParent() ? 'Éditer mon profil' : 'Créer mon profil');
  readonly isCreatingParent = computed(() => !this.hasParent());

  // Computed signals pour le bouton professeur
  readonly hasTeacher = computed(() => this.teacherStore.hasTeacher());
  readonly teacherButtonText = computed(() => this.hasTeacher() ? 'Éditer mon profil' : 'Créer mon profil');
  readonly teacherAssignments = computed(() => this.teacherAssignmentStore.assignments());
  readonly hasAssignments = computed(() => this.teacherAssignmentStore.hasAssignments());
  
  // Filtre par école
  readonly selectedSchoolId = signal<string | null>(null); // null = toutes les écoles
  
  // Liste des écoles uniques depuis les affectations
  readonly uniqueSchools = computed(() => {
    const assignments = this.teacherAssignments();
    const schools = this.teacherAssignmentStore.schools();
    const schoolIds = new Set(assignments.map(a => a.school_id).filter(Boolean));
    
    return schools
      .filter(school => schoolIds.has(school.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  
  // Affectations filtrées par école
  readonly filteredAssignments = computed(() => {
    const assignments = this.teacherAssignments();
    const selectedId = this.selectedSchoolId();
    
    if (!selectedId) {
      return assignments;
    }
    
    return assignments.filter(a => a.school_id === selectedId);
  });
  
  // Vérifier si les affectations filtrées sont vides
  readonly hasFilteredAssignments = computed(() => this.filteredAssignments().length > 0);

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
        label: 'Mes affectations',
        route: '/teacher-assignments',
        queryParams: { tab: 'assignments' },
        icon: '📚',
        variant: 'secondary'
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

  // Effect pour charger les stats de jeux quand les assignments changent
  private readonly loadGamesStatsEffect = effect(() => {
    if (this.activeRoleSig() === 'prof') {
      const assignments = this.teacherAssignments();
      if (assignments.length > 0) {
        this.loadGamesStatsForAssignments(assignments);
      }
    }
  });

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
          } catch (error) {
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
    
    // Si le rôle actif est parent, charger le profil et vérifier le statut
    if (this.activeRole === 'parent') {
      this.parentStore.loadParentProfile();
      this.parentStore.checkParentStatus();
      this.childStore.loadChildren();
    }
    
    // Si le rôle actif est prof, charger le profil et les affectations
    if (this.activeRole === 'prof') {
      this.teacherStore.loadTeacherProfile();
      this.teacherAssignmentStore.loadSchools();
      // Ne pas charger toutes les matières globales ici pour ne pas écraser la liste filtrée
    }
    
    // Écouter les navigations pour recharger les enfants quand on revient au dashboard
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        if (event.url === '/dashboard' && this.activeRole === 'parent') {
          this.childStore.loadChildren();
        }
      });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
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
    this.childStore.setChildActiveStatus({ childId, isActive });
  }

  // Méthodes pour les professeurs
  getSchoolName(schoolId: string): string {
    // Chercher dans le store
    const schools = this.teacherAssignmentStore.schools();
    const school = schools.find(s => s.id === schoolId);
    return school ? school.name : 'École inconnue';
  }

  getSubjectName(subjectId: string): string {
    const subjects = this.teacherAssignmentStore.subjects();
    const subject = subjects.find(s => s.id === subjectId);
    return subject ? subject.name : 'Matière inconnue';
  }

  getAssignmentSubjectName(assignment: { subject?: { name?: string }; subject_id?: string } | null | undefined): string {
    // Utilise la jointure si présente, sinon le fallback via store
    const joinedName = assignment && assignment.subject && assignment.subject.name;
    if (joinedName && typeof joinedName === 'string') return joinedName;
    return assignment && assignment.subject_id ? this.getSubjectName(assignment.subject_id) : 'Matière inconnue';
  }

  // Méthodes pour les statistiques de jeux
  private loadGamesStatsForAssignments(assignments: any[]): void {
    // Créer un tableau d'observables pour charger les stats de chaque matière
    const statsObservables = assignments.map(assignment =>
      this.infrastructure.getGamesStatsBySubject(assignment.subject_id)
    );

    // Charger toutes les stats en parallèle
    forkJoin(statsObservables).subscribe({
      next: (results) => {
        const newStats: Record<string, { stats: Record<string, number>; total: number }> = {};
        
        assignments.forEach((assignment, index) => {
          const result = results[index];
          if (!result.error && result.total > 0) {
            newStats[assignment.subject_id] = {
              stats: result.stats,
              total: result.total
            };
          }
        });

        this.gamesStats.set(newStats);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des stats de jeux:', error);
      }
    });
  }

  getGamesStatsForAssignment(subjectId: string): { stats: Record<string, number>; total: number } | null {
    return this.gamesStats()[subjectId] || null;
  }

  formatGamesStats(subjectId: string): string {
    const stats = this.getGamesStatsForAssignment(subjectId);
    if (!stats || stats.total === 0) {
      return '';
    }

    // Formater : "QCM (3) • Liens (2) • Chronologie (1)"
    const formattedTypes = Object.entries(stats.stats)
      .map(([type, count]) => `${type} (${count})`)
      .join(' • ');

    return `🎮 ${stats.total} jeu${stats.total > 1 ? 'x' : ''} : ${formattedTypes}`;
  }

  // Utilise directement la fonction utils
  readonly getSchoolLevelLabel = getSchoolLevelLabel;
}
