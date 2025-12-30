import { Component, Input, Output, EventEmitter, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Infrastructure } from '../../../../components/infrastructure/infrastructure';
import { SupabaseService, SchoolsStore } from '../../../../../../shared';
import type { Teacher } from '../../../../types/teacher';
import type { TeacherAssignment } from '../../../../types/teacher-assignment';
import { getSchoolLevelLabel } from '../../../../utils/school-levels.util';

@Component({
  selector: 'app-teacher-info-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './teacher-info-modal.component.html',
  styleUrl: './teacher-info-modal.component.scss'
})
export class TeacherInfoModalComponent {
  @Input() teacherId: string | null = null;
  @Input() teacherName: string | null = null;
  @Input() subjectId: string | null = null;
  @Input() subjectName: string | null = null;
  @Input() schoolId: string | null = null;
  @Input() schoolLevel: string | null = null;
  @Output() modalClose = new EventEmitter<void>();

  private readonly infrastructure = inject(Infrastructure);
  private readonly supabaseService = inject(SupabaseService);
  private readonly schoolsStore = inject(SchoolsStore);

  readonly teacher = signal<Teacher | null>(null);
  readonly teacherEmail = signal<string | null>(null);
  readonly assignments = signal<TeacherAssignment[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly getSchoolLevelLabel = getSchoolLevelLabel;

  // Effect pour charger les informations du professeur quand les inputs changent
  private readonly loadTeacherEffect = effect(() => {
    const teacherId = this.teacherId;
    if (teacherId) {
      this.loadTeacher();
    }
  });

  loadTeacher(): void {
    if (!this.teacherId) return;

    this.loading.set(true);
    this.error.set(null);

    // Récupérer les informations du professeur depuis Supabase
    this.supabaseService.client
      .from('teachers')
      .select('*')
      .eq('id', this.teacherId)
      .single()
      .then(async ({ data, error }) => {
        if (error) {
          this.loading.set(false);
          this.error.set(error.message || 'Erreur lors du chargement du professeur');
          return;
        }
        this.teacher.set(data as Teacher);

        // Récupérer l'email depuis la session si c'est l'utilisateur connecté
        // Pour les autres utilisateurs, l'email n'est pas accessible directement
        if (data?.profile_id) {
          try {
            const { data: sessionData } = await this.supabaseService.client.auth.getSession();
            if (sessionData?.session && sessionData.session.user?.id === data.profile_id) {
              this.teacherEmail.set(sessionData.session.user.email || null);
            }
            // Note: Pour récupérer l'email d'autres utilisateurs, il faudrait une fonction RPC
            // ou stocker l'email dans la table teachers
          } catch (err) {
            console.warn('Impossible de récupérer l\'email du professeur:', err);
          }
        }

        this.loading.set(false);

        // Charger les affectations du professeur pour cette matière si subjectId est fourni
        if (this.subjectId) {
          this.loadAssignments();
        }
      });
  }

  loadAssignments(): void {
    if (!this.teacherId || !this.subjectId) return;

    this.infrastructure.getTeacherAssignments(this.teacherId).subscribe({
      next: ({ assignments, error }) => {
        if (error) {
          console.error('Erreur lors du chargement des affectations:', error);
          return;
        }

        // Filtrer les affectations pour cette matière uniquement
        // On affiche toutes les affectations du professeur pour cette matière,
        // indépendamment de l'école ou du niveau
        const filteredAssignments = assignments.filter(a => 
          a.subject_id === this.subjectId &&
          a.deleted_at === null
        );
        this.assignments.set(filteredAssignments);
      },
      error: (err) => {
        console.error('Erreur lors du chargement des affectations:', err);
      }
    });
  }

  onClose(): void {
    this.modalClose.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.onClose();
    }
  }

  getSchoolName(schoolId: string | null): string {
    if (!schoolId) return '';
    const schools = this.schoolsStore.schools();
    const school = schools.find(s => s.id === schoolId);
    return school ? school.name : `École ${schoolId.substring(0, 8)}...`;
  }
}

