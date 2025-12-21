import { Component, OnInit, OnDestroy, inject, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, NavigationEnd, Router } from '@angular/router';
import { AuthService, Profile } from '../../shared/services/auth/auth.service';
import { ParentStore } from '../parent/store/index';
import { ChildStore } from '../child/store/index';
import { TeacherStore } from '../teacher/store/index';
import { TeacherAssignmentStore } from '../teacher/store/assignments.store';
import { Child } from '../child/types/child';
import { filter, Subscription } from 'rxjs';
import { ActionLinksComponent, ActionLink } from '../../shared/components/action-links/action-links.component';
import { GamesStatsService } from '../../shared/services/games-stats/games-stats.service';
import { GamesStatsDisplayComponent } from '../../shared/components/games-stats-display/games-stats-display.component';
import { getSchoolLevelLabel, SCHOOL_LEVELS } from '../teacher/utils/school-levels.util';
import { TransferAssignmentDialogComponent, TransferAssignmentData, TeacherAssignmentWithJoins } from '../teacher/components/assignments/components/transfer-assignment-dialog/transfer-assignment-dialog.component';
import type { TeacherAssignment } from '../teacher/types/teacher-assignment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ActionLinksComponent, GamesStatsDisplayComponent, TransferAssignmentDialogComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly gamesStatsService = inject(GamesStatsService);
  readonly parentStore = inject(ParentStore);
  readonly childStore = inject(ChildStore);
  readonly teacherStore = inject(TeacherStore);
  readonly teacherAssignmentStore = inject(TeacherAssignmentStore);
  profile: Profile | null = null;
  activeRole: string | null = null;
  private routerSubscription?: Subscription;
  private lastLoadedTeacherId: string | null = null;
  private readonly activeRoleSig = signal<string | null>(null);

  // Computed signals pour le bouton parent
  readonly hasParent = computed(() => this.parentStore.hasParent());
  readonly parentButtonText = computed(() => this.hasParent() ? 'Éditer mon profil' : 'Créer mon profil');
  readonly isCreatingParent = computed(() => !this.hasParent());

  // Computed signals pour le bouton professeur
  readonly hasTeacher = computed(() => this.teacherStore.hasTeacher());
  readonly teacherButtonText = computed(() => this.hasTeacher() ? 'Éditer mon profil' : 'Créer mon profil');
  readonly teacherAssignments = computed(() => this.teacherAssignmentStore.assignments());
  readonly hasAssignments = computed(() => this.teacherAssignmentStore.hasAssignments());
  
  // Signal pour gérer l'affichage du dialog de transfert
  readonly showTransferDialog = signal<boolean>(false);
  readonly selectedAssignmentForTransfer = signal<TeacherAssignmentWithJoins | null>(null);
  
  // Filtre par école
  readonly selectedSchoolId = signal<string | null>(null); // null = toutes les écoles
  
  // Filtre par niveau
  readonly selectedLevel = signal<string | null>(null); // null = tous les niveaux
  
  // Liste des écoles uniques depuis les affectations
  readonly uniqueSchools = computed(() => {
    const assignments = this.teacherAssignments();
    const schools = this.teacherAssignmentStore.schools();
    const schoolIds = new Set(assignments.map(a => a.school_id).filter(Boolean));
    
    // Si les écoles sont chargées, les filtrer et trier
    if (schools.length > 0) {
      return schools
        .filter(school => schoolIds.has(school.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // Si les écoles ne sont pas encore chargées, créer des objets temporaires depuis les affectations
    // Cela permet d'afficher les filtres même si les écoles ne sont pas chargées
    const schoolMap = new Map<string, { id: string; name: string }>();
    assignments.forEach(assignment => {
      if (assignment.school_id) {
        // Vérifier si l'objet school existe (via jointure)
        const assignmentWithJoins = assignment as TeacherAssignmentWithJoins;
        if (assignmentWithJoins.school) {
          schoolMap.set(assignment.school_id, {
            id: assignment.school_id,
            name: assignmentWithJoins.school.name || `École ${assignment.school_id.substring(0, 8)}`
          });
        } else {
          // Si on a l'ID mais pas l'objet school (jointure manquante)
          // Utiliser getSchoolName si disponible, sinon un nom générique
          const schoolName = this.getSchoolName(assignment.school_id);
          schoolMap.set(assignment.school_id, {
            id: assignment.school_id,
            name: schoolName !== 'École inconnue' ? schoolName : `École ${assignment.school_id.substring(0, 8)}`
          });
        }
      }
    });
    
    return Array.from(schoolMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  });
  
  // Niveaux disponibles pour l'école sélectionnée
  readonly availableLevels = computed(() => {
    const schoolId = this.selectedSchoolId();
    if (!schoolId) return [];
    
    const assignments = this.teacherAssignments();
    const levels = new Set(
      assignments
        .filter(a => a.school_id === schoolId && a.school_level)
        .map(a => a.school_level!)
    );
    
    // Trier selon l'ordre de SCHOOL_LEVELS
    const sortedLevels = Array.from(levels).sort((a, b) => {
      const indexA = SCHOOL_LEVELS.findIndex(l => l.value === a);
      const indexB = SCHOOL_LEVELS.findIndex(l => l.value === b);
      // Si un niveau n'est pas trouvé dans SCHOOL_LEVELS, le mettre à la fin
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    
    return sortedLevels;
  });
  
  // Affichage conditionnel du filtre niveau
  readonly shouldShowLevelFilter = computed(() => {
    return this.selectedSchoolId() !== null && this.availableLevels().length > 0;
  });
  
  // Affectations filtrées par école et niveau
  readonly filteredAssignments = computed(() => {
    const assignments = this.teacherAssignments();
    const schoolId = this.selectedSchoolId();
    const level = this.selectedLevel();
    
    let filtered = assignments;
    
    if (schoolId) {
      filtered = filtered.filter(a => a.school_id === schoolId);
    }
    
    if (level) {
      filtered = filtered.filter(a => a.school_level === level);
    }
    
    return filtered;
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

  // Effect pour charger les stats de jeux quand les assignments changent
  private readonly loadGamesStatsEffect = effect(() => {
    if (this.activeRoleSig() === 'prof') {
      const assignments = this.teacherAssignments();
      if (assignments.length > 0) {
        const subjectIds = assignments.map(a => a.subject_id).filter(Boolean) as string[];
        this.gamesStatsService.loadStatsForSubjects(subjectIds);
      }
    }
  });

  // Effect pour réinitialiser le filtre niveau quand l'école change
  private readonly resetLevelOnSchoolChange = effect(() => {
    this.selectedSchoolId(); // Écouter les changements
    this.selectedLevel.set(null); // Réinitialiser
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
    
    // Écouter les navigations pour recharger les données quand on revient au dashboard
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        if (event.url === '/dashboard') {
          if (this.activeRole === 'parent') {
            this.childStore.loadChildren();
          } else if (this.activeRole === 'prof') {
            // Recharger les affectations pour avoir les dernières données
            const teacher = this.teacherStore.teacher();
            if (teacher) {
              this.teacherAssignmentStore.loadAssignments(teacher.id);
            }
          }
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

  // Utilise directement la fonction utils
  readonly getSchoolLevelLabel = getSchoolLevelLabel;

  // Méthode pour supprimer une affectation
  onDeleteAssignment(assignmentId: string): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette affectation ?')) return;
    this.teacherAssignmentStore.deleteAssignment(assignmentId);
  }

  // Méthode pour transférer une affectation
  onTransferAssignment(assignmentId: string): void {
    const assignment = this.teacherAssignments().find(a => a.id === assignmentId);
    if (!assignment) {
      console.error('Affectation non trouvée:', assignmentId);
      return;
    }
    this.selectedAssignmentForTransfer.set(assignment);
    this.showTransferDialog.set(true);
  }

  // Gérer la confirmation du transfert
  onTransferConfirm(data: TransferAssignmentData): void {
    const assignment = this.selectedAssignmentForTransfer();
    if (!assignment) return;

    const teacherId = this.getCurrentTeacherId();

    if (data.mode === 'transfer') {
      this.teacherAssignmentStore.transferAssignment({
        assignmentId: assignment.id,
        newTeacherId: data.newTeacherId
      });
    } else {
      // Passer le teacherId pour recharger après le partage
      this.teacherAssignmentStore.shareAssignment({
        assignmentId: assignment.id,
        newTeacherId: data.newTeacherId,
        teacherId: teacherId || undefined
      });
    }

    this.showTransferDialog.set(false);
    this.selectedAssignmentForTransfer.set(null);
  }

  // Gérer l'annulation du transfert
  onTransferCancel(): void {
    this.showTransferDialog.set(false);
    this.selectedAssignmentForTransfer.set(null);
  }

  // Obtenir l'ID du professeur actuel
  getCurrentTeacherId(): string | null {
    const teacher = this.teacherStore.teacher();
    return teacher?.id || null;
  }
}
