import { Component, OnInit, inject, signal, computed, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { TeacherAssignmentStore } from '../../store/assignments.store';
import { Application } from '../../components/application/application';
import { TeacherService } from '../../services/teacher/teacher.service';
import { ErrorSnackbarService } from '../../../../shared/services/snackbar/error-snackbar.service';
import { AssignmentsSectionComponent } from './components/assignments-section/assignments-section.component';
import { AddAssignmentDialogComponent } from './components/add-assignment-dialog/add-assignment-dialog.component';
import { AuthService } from '../../../../shared/services/auth/auth.service';
import { TeacherStore } from '../../store/index';
import type { ActionLink } from '../../../../shared/components/action-links/action-links.component';

@Component({
  selector: 'app-assignments',
  standalone: true,
  imports: [CommonModule, RouterModule, AssignmentsSectionComponent, AddAssignmentDialogComponent],
  templateUrl: './assignments.component.html',
  styleUrl: './assignments.component.scss'
})
export class AssignmentsComponent implements OnInit {
  private readonly teacherService = inject(TeacherService);
  private readonly errorSnackbarService = inject(ErrorSnackbarService);
  private readonly authService = inject(AuthService);
  private readonly application = inject(Application);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(TeacherAssignmentStore);
  readonly teacherStore = inject(TeacherStore);

  // Signals UI
  readonly showAssignmentDialog = signal(false);
  readonly teacherId = signal<string | null>(null);

  // Computed
  readonly hasAssignments = computed(() => this.store.hasAssignments());

  // Dashboard section
  activeRole: string | null = null;
  readonly hasTeacher = computed(() => this.teacherStore.hasTeacher());
  readonly teacherButtonText = computed(() => this.hasTeacher() ? 'Éditer mon profil' : 'Créer mon profil');
  
  // Méthode pour ouvrir le modal
  openAssignmentDialog(): void {
    console.log('[AssignmentsComponent] openAssignmentDialog called');
    this.showAssignmentDialog.set(true);
    console.log('[AssignmentsComponent] showAssignmentDialog set to:', this.showAssignmentDialog());
    // Forcer la détection de changement
    this.cdr.detectChanges();
  }
  
  // Utiliser un signal pour les actions au lieu d'un computed pour éviter les problèmes de référence
  // Mémoriser la fonction d'action pour éviter les recréations
  private readonly openDialogAction = () => {
    this.openAssignmentDialog();
  };
  
  readonly teacherActions = signal<ActionLink[]>([
    {
      label: 'Éditer mon profil',
      route: '/teacher-profile',
      variant: 'edit'
    },
    {
      label: 'Ajouter une affectation',
      action: this.openDialogAction,
      icon: '➕',
      variant: 'add'
    }
  ]);
  
  // Effect pour mettre à jour les actions quand hasTeacher change
  private readonly updateTeacherActions = effect(() => {
    const hasTeacher = this.hasTeacher();
    const buttonText = this.teacherButtonText();
    this.teacherActions.set([
      {
        label: buttonText,
        route: '/teacher-profile',
        variant: hasTeacher ? 'edit' : 'add'
      },
      {
        label: 'Ajouter une affectation',
        action: this.openDialogAction, // Utiliser la fonction mémorisée
        icon: '➕',
        variant: 'add'
      }
    ]);
  });


  constructor() {
    effect(() => {
      const tid = this.teacherId();
      if (tid) this.application.loadAssignments(tid);
    });

    // Écouter les demandes de confirmation
    effect(() => {
      // Accéder à pendingConfirmation via le store (propriété optionnelle du state)
      const storeState = this.store as any;
      const pendingConfirmation = storeState.pendingConfirmation?.();
      if (pendingConfirmation) {
        const confirmed = confirm(pendingConfirmation.message);
        if (confirmed) {
          // L'utilisateur a confirmé, procéder avec la création
          this.store.confirmAndCreateAssignment({
            assignmentData: pendingConfirmation.assignmentData,
            conflictingAssignmentIds: pendingConfirmation.conflictingAssignments.map((a: { id: string }) => a.id)
          });
          // Recharger les affectations après création
          if (this.teacherId()) {
            this.application.loadAssignments(this.teacherId()!);
          }
        } else {
          // L'utilisateur a annulé, effacer la demande de confirmation
          this.store.clearPendingConfirmation();
        }
      }
    });
  }

  async ngOnInit(): Promise<void> {
    // Charger le rôle actif pour la section dashboard
    this.activeRole = this.authService.getActiveRole();
    this.loadTeacherId();
    
    // Vérifier si on doit ouvrir le modal automatiquement via query param
    const addParam = this.route.snapshot.queryParamMap.get('add');
    if (addParam === 'true') {
      console.log('[AssignmentsComponent] Opening dialog from query param');
      this.showAssignmentDialog.set(true);
      this.cdr.detectChanges();
    }
    
    // Écouter les changements de query params pour réagir lors de la navigation
    this.route.queryParamMap.subscribe(params => {
      const addParam = params.get('add');
      console.log('[AssignmentsComponent] Query param changed:', addParam);
      if (addParam === 'true') {
        console.log('[AssignmentsComponent] Opening dialog from query param change');
        this.showAssignmentDialog.set(true);
        this.cdr.detectChanges();
      } else if (addParam === 'false') {
        this.showAssignmentDialog.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  private loadTeacherId(): void {
    this.teacherService.getTeacherProfile().subscribe({
      next: (teacher) => {
        if (teacher) this.teacherId.set(teacher.id);
        else this.errorSnackbarService.showError('Profil professeur non trouvé. Veuillez d\'abord créer votre profil.');
      },
      error: () => this.errorSnackbarService.showError('Erreur lors du chargement du profil professeur'),
    });
  }

  onAssignmentCreated(): void {
    // Recharger les affectations après création
    if (this.teacherId()) {
      this.application.loadAssignments(this.teacherId()!);
    }
  }

}

