import { Component, OnInit, OnDestroy, inject, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, NavigationEnd, Router } from '@angular/router';
import { AuthService, Profile } from '../../services/auth/auth.service';
import { ParentStore } from '../parent/store/index';
import { ChildStore } from '../child/store/index';
import { TeacherStore } from '../teacher/store/index';
import { TeacherAssignmentStore } from '../teacher/store/assignments.store';
import { Child } from '../child/types/child';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
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

  // Computed signals pour les enfants
  readonly children = computed(() => this.childStore.children());
  readonly activeChildren = computed(() => this.children().filter(c => c.is_active));
  readonly inactiveChildren = computed(() => this.children().filter(c => !c.is_active));
  readonly hasChildren = computed(() => this.childStore.hasChildren());
  readonly hasActiveChildren = computed(() => this.activeChildren().length > 0);
  readonly hasInactiveChildren = computed(() => this.inactiveChildren().length > 0);
  readonly childrenCount = computed(() => this.activeChildren().length);

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

  async ngOnInit() {
    this.profile = await this.authService.getProfile();
    this.activeRole = this.authService.getActiveRole();
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

  async logout() {
    await this.authService.signOut();
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
}
