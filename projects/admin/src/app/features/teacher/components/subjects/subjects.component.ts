import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Infrastructure } from '../infrastructure/infrastructure';
import { TeacherAssignmentStore } from '../../store/assignments.store';
import type { Subject } from '../../types/subject';
import type { SubjectCategory } from '../../types/subject';
import { ErrorSnackbarService, ToastService, GamesStatsService, SchoolLevelSelectComponent, ConfirmationDialogService } from '../../../../shared';
import { TransferCategoryDialogComponent, TransferCategoryData } from './components/transfer-category-dialog/transfer-category-dialog.component';
import { Application } from '../application/application';
import { TeacherService } from '../../services/teacher/teacher.service';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import type { TeacherAssignment } from '../../types/teacher-assignment';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MatTooltipModule, TransferCategoryDialogComponent, SchoolLevelSelectComponent],
  templateUrl: './subjects.component.html',
  styleUrls: ['./subjects.component.scss'],
})
export class SubjectsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly infra = inject(Infrastructure);
  private readonly errorSnackbar = inject(ErrorSnackbarService);
  private readonly confirmationDialog = inject(ConfirmationDialogService);
  private readonly toastService = inject(ToastService);
  private readonly gamesStatsService = inject(GamesStatsService);
  private readonly application = inject(Application);
  private readonly teacherService = inject(TeacherService);
  readonly store = inject(TeacherAssignmentStore);

  readonly subjectId = signal<string | null>(null);
  readonly subjects = computed(() => this.store.subjects());
  readonly schools = computed(() => this.store.schools());
  readonly assignments = computed(() => this.store.assignments());
  
  // Query params pour détecter si on vient d'une affectation
  readonly currentSchoolId = signal<string | null>(null);
  readonly currentSchoolLevel = signal<string | null>(null);
  readonly currentAssignment = computed<TeacherAssignment | null>(() => {
    const schoolId = this.currentSchoolId();
    const schoolLevel = this.currentSchoolLevel();
    const subjectId = this.subjectId();
    if (!schoolId || !schoolLevel || !subjectId) return null;
    
    return this.assignments().find(a => 
      a.school_id === schoolId && 
      a.school_level === schoolLevel && 
      a.subject_id === subjectId
    ) || null;
  });
  readonly currentSubjectName = computed(() => {
    const id = this.subjectId();
    if (!id) return '';
    const s = this.subjects().find(x => x.id === id);
    return s?.name || '';
  });

  // Effet déclaré en champ de classe (contexte d'injection garanti) pour pré-remplir le formulaire
  private readonly patchFormFromStore = effect(() => {
    const sid = this.subjectId();
    const list = this.subjects();
    
    // Remplir si on a un ID et des sujets dans le store
    if (sid && list.length > 0) {
      const subj = list.find(x => x.id === sid);
      if (subj) {
        const currentName = this.subjectForm.get('name')?.value;
        const currentDesc = this.subjectForm.get('description')?.value;
        const currentType = this.subjectForm.get('type')?.value;
        
        // Toujours remplir si le formulaire est vide ou si les valeurs sont différentes
        const shouldFill = !currentName || 
                          currentName.trim() === '' ||
                          currentName !== subj.name || 
                          currentDesc !== (subj.description || '') ||
                          currentType !== subj.type;
        
        if (shouldFill) {
          this.fillFormFromSubject(subj);
        }
      }
    }
  });

  subjectForm = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    type: ['scolaire', Validators.required],
    assignment_school_level: [''], // Champ pour modifier le niveau scolaire de l'affectation
  });

  constructor() {
  }

  linkForm = this.fb.group({
    school_id: ['', Validators.required],
    school_level: ['', Validators.required],
    required: [true],
  });

  readonly links = signal<{ id: string; school_id: string; school_level: string; required: boolean }[]>([]);

  // Gestion des sous-catégories
  readonly categories = signal<SubjectCategory[]>([]);
  readonly editingCategoryId = signal<string | null>(null);
  readonly showTransferDialog = signal<boolean>(false);
  readonly selectedCategoryForTransfer = signal<SubjectCategory | null>(null);
  
  // Stats de jeux et nombre d'enfants par catégorie
  readonly childrenCountByCategory = signal<Map<string, number>>(new Map());
  categoryForm = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    this.store.loadSchools();
    // Toujours charger tous les sujets pour s'assurer d'avoir la matière complète
    this.store.loadSubjects();
    const id = this.route.snapshot.paramMap.get('id');
    this.subjectId.set(id);

    // Préselection via query params (ex: depuis le dashboard/affectations)
    const q = this.route.snapshot.queryParamMap;
    const qpSchoolId = q.get('school_id');
    const qpSchoolLevel = q.get('school_level');
    if (qpSchoolId || qpSchoolLevel) {
      const normalizedLevel = this.normalizeLevel(qpSchoolLevel || '');
      this.currentSchoolId.set(qpSchoolId);
      this.currentSchoolLevel.set(normalizedLevel);
      this.linkForm.patchValue({
        school_id: qpSchoolId || '',
        school_level: normalizedLevel || '',
      });
      // Pré-remplir le champ de modification du niveau scolaire de l'affectation
      if (normalizedLevel) {
        this.subjectForm.patchValue({
          assignment_school_level: normalizedLevel
        });
      }
    }
    this.route.queryParamMap.subscribe(params => {
      const sId = params.get('school_id');
      const sLvl = params.get('school_level');
      if (sId || sLvl) {
        const normalized = this.normalizeLevel(sLvl || '');
        this.currentSchoolId.set(sId);
        this.currentSchoolLevel.set(normalized);
        this.linkForm.patchValue({
          school_id: sId || this.linkForm.get('school_id')?.value || '',
          school_level: normalized || this.linkForm.get('school_level')?.value || '',
        });
        // Mettre à jour le champ de modification du niveau scolaire de l'affectation
        if (normalized) {
          this.subjectForm.patchValue({
            assignment_school_level: normalized
          });
        }
      }
    });
    
    // Charger les affectations si on a un teacherId
    this.teacherService.getTeacherProfile().subscribe({
      next: (teacher) => {
        if (teacher) {
          this.application.loadAssignments(teacher.id);
        }
      }
    });

    if (id) {
      this.loadLinks(id);
      this.loadCategories(id);
      
      // Essayer de remplir depuis le store d'abord (si disponible)
      // Le formulaire est déjà initialisé à ce stade, pas besoin de setTimeout
      const s = this.subjects().find(x => x.id === id);
      if (s) {
        this.fillFormFromSubject(s);
      }

      // Toujours charger depuis l'infra pour s'assurer d'avoir les données à jour
      // et remplir le formulaire même si le store n'a pas encore les sujets
      this.infra.getSubjects().subscribe(({ subjects, error }) => {
        if (error) {
          console.error('[SubjectsComponent] Erreur lors du chargement des sujets:', error);
          return;
        }
        
        const found = (subjects || []).find(x => x.id === id);
        if (found) {
          this.fillFormFromSubject(found);
        }
      });
      
      // Écouter aussi les changements du store pour remplir le formulaire quand les données arrivent
      // (l'effect patchFormFromStore se déclenchera aussi)
    }
  }

  private normalizeLevel(level: string): string {
    const map: Record<string, string> = {
      '1ere': '1ère',
      '1ère': '1ère',
      '2eme': '2ème',
      '2ème': '2ème',
      '3eme': '3ème',
      '3ème': '3ème',
      '4eme': '4ème',
      '4ème': '4ème',
      '5eme': '5ème',
      '5ème': '5ème',
      '6eme': '6ème',
      '6ème': '6ème',
      'autre': 'autre',
    };
    const key = (level || '').toLowerCase();
    // conserver les valeurs déjà compatibles
    return map[key] || level;
  }

  create(): void {
    if (!this.subjectForm.valid) return;
    const v = this.subjectForm.value;

    const newName = (v.name || '').trim();
    if (!newName) return;

    this.infra.createSubject({
      name: newName,
      description: v.description || null,
      type: (v.type as Subject['type'])!,
      default_age_range: null,
      metadata: null,
    }).subscribe(({ subject, error }) => {
      if (!error && subject) {
        this.store.loadSubjects();
        this.router.navigate(['/teacher-subjects', subject.id]);
      }
    });
  }

  update(): void {
    const id = this.subjectId();
    if (!id || !this.subjectForm.valid) return;
    const v = this.subjectForm.value;
    const updates = {
      name: ((v.name || '').trim() || undefined) as string | undefined,
      description: (v.description || undefined) as string | undefined,
      type: v.type as Subject['type'],
    };
    this.infra.updateSubject(id, updates).subscribe(({ subject, error }) => {
      if (error) {
        this.errorSnackbar.showError(error.message || 'Erreur lors de la mise à jour de la matière');
        return;
      }
      // Succès même si 'subject' est null (aucun champ réellement changé)
      this.store.loadSubjects();
      
      // Si on vient d'une affectation et que le niveau scolaire a changé, mettre à jour l'affectation
      const assignment = this.currentAssignment();
      const newSchoolLevel = v.assignment_school_level;
      if (assignment && newSchoolLevel && assignment.school_level !== newSchoolLevel) {
        this.application.updateAssignment(assignment.id, {
          school_level: newSchoolLevel || null
        });
        // Mettre à jour le signal pour refléter le changement
        this.currentSchoolLevel.set(newSchoolLevel);
        this.toastService.success('Matière et niveau scolaire enregistrés.');
      } else {
        this.toastService.success('Matière enregistrée.');
      }
    });
  }


  addLink(): void {
    if (!(this.linkForm.valid && this.subjectId())) return;
    const v = this.linkForm.value;

    // Validation client: empêcher un doublon (même école + niveau) pour cette matière
    const existing = this.links().find(l => l.school_id === v.school_id && l.school_level === v.school_level);
    if (existing) {
      // Si le lien existe déjà: si 'required' a changé, on met à jour en remplaçant; sinon, no-op succès
      if (!!existing.required !== !!v.required) {
        this.infra.deleteSubjectLink(existing.id).subscribe(() => {
          this.infra.addSubjectLink({
            subject_id: this.subjectId()!,
            school_id: v.school_id!,
            school_level: v.school_level!,
            required: !!v.required,
          }).subscribe(() => {
            this.loadLinks(this.subjectId()!);
          });
        });
      }
      return;
    }

    this.infra.addSubjectLink({
      subject_id: this.subjectId()!,
      school_id: v.school_id!,
      school_level: v.school_level!,
      required: !!v.required,
    }).subscribe(({ error }) => {
      if (error) {
        this.errorSnackbar.showError(error.message || 'Impossible d\'ajouter le lien (école + niveau).');
        return;
      }
      this.linkForm.reset({ required: true });
      this.loadLinks(this.subjectId()!);
    });
  }

  removeLink(id: string): void {
    this.infra.deleteSubjectLink(id).subscribe(() => this.loadLinks(this.subjectId()!));
  }

  private loadLinks(subjectId: string): void {
    this.infra.getSubjectLinks(subjectId).subscribe(({ links }) => {
      const list = links || [];
      this.links.set(list);
      // Pré-remplir le formulaire avec la première association existante
      if (list.length > 0) {
        const first = list[0];
        this.linkForm.patchValue({
          school_id: first.school_id,
          school_level: first.school_level,
          required: first.required,
        });
      }
    });
  }

  getSchoolName(schoolId: string): string {
    const school = this.schools().find(s => s.id === schoolId);
    return school ? school.name : 'École inconnue';
  }

  /**
   * Méthode pour remplir le formulaire avec les données d'un sujet
   */
  private fillFormFromSubject(subject: Subject | null | undefined): void {
    if (!subject) {
      return;
    }
    
    // Vérifier que le formulaire existe
    if (!this.subjectForm) {
      return;
    }

    // Remplir le formulaire
    const nameControl = this.subjectForm.get('name');
    const descriptionControl = this.subjectForm.get('description');
    const typeControl = this.subjectForm.get('type');
    
    if (nameControl) {
      nameControl.setValue(subject.name || '', { emitEvent: false, onlySelf: true });
    }
    
    if (descriptionControl) {
      descriptionControl.setValue(subject.description || '', { emitEvent: false, onlySelf: true });
    }
    
    if (typeControl) {
      typeControl.setValue(subject.type || 'scolaire', { emitEvent: false, onlySelf: true });
    }
    
    // Marquer les champs comme touchés pour que les valeurs s'affichent
    nameControl?.markAsTouched();
    descriptionControl?.markAsTouched();
    typeControl?.markAsTouched();
    
    // Mettre à jour la validité
    this.subjectForm.updateValueAndValidity({ emitEvent: false });

    
    // Si les valeurs ne correspondent pas, réessayer immédiatement
    const actualName = nameControl?.value || '';
    const actualDesc = descriptionControl?.value || '';
    const actualType = typeControl?.value || '';
    if (actualName !== subject.name || actualDesc !== (subject.description || '') || actualType !== subject.type) {
      console.warn('[SubjectsComponent] fillFormFromSubject: valeurs non correspondantes, nouvelle tentative');
      if (nameControl) nameControl.setValue(subject.name || '', { emitEvent: false });
      if (descriptionControl) descriptionControl.setValue(subject.description || '', { emitEvent: false });
      if (typeControl) typeControl.setValue(subject.type || 'scolaire', { emitEvent: false });
      this.subjectForm.updateValueAndValidity({ emitEvent: false });
    }
  }

  // ===== Gestion des sous-catégories =====
  private loadCategories(subjectId: string): void {
    this.infra.getCategoriesBySubject(subjectId).subscribe(({ categories, error }) => {
      if (error) {
        console.error('[SubjectsComponent] Erreur lors du chargement des sous-catégories:', error);
        this.errorSnackbar.showError(error.message || 'Erreur lors du chargement des sous-catégories');
        return;
      }
      this.categories.set(categories || []);
      
      // Charger les stats de jeux et le nombre d'enfants pour chaque catégorie
      if (categories && categories.length > 0) {
        const categoryIds = categories.map(c => c.id);
        
        // Charger les stats de jeux en batch
        this.gamesStatsService.loadStatsForCategories(categoryIds);
        
        // Charger le nombre d'enfants pour chaque catégorie
        const countObservables = categoryIds.map(categoryId =>
          this.infra.countChildrenByCategory(categoryId, null, null).pipe(
            map(({ count, error: countError }) => ({
              categoryId,
              count: countError ? 0 : count
            }))
          )
        );

        forkJoin(countObservables).subscribe(results => {
          const counts = new Map<string, number>();
          results.forEach(({ categoryId, count }) => {
            counts.set(categoryId, count);
          });
          this.childrenCountByCategory.set(counts);
        });
      } else {
        this.childrenCountByCategory.set(new Map());
      }
    });
  }

  createCategory(): void {
    const id = this.subjectId();
    if (!id || !this.categoryForm.valid) return;
    const v = this.categoryForm.value;
    const newName = (v.name || '').trim();
    if (!newName) return;

    this.infra.createCategory({
      subject_id: id,
      name: newName,
      description: v.description || null,
    }).subscribe(({ error }) => {
      if (error) {
        this.errorSnackbar.showError(error.message || 'Erreur lors de la création de la sous-catégorie');
        return;
      }
      this.toastService.success('Sous-catégorie créée.');
      this.categoryForm.reset();
      this.loadCategories(id);
    });
  }

  startEditCategory(category: SubjectCategory): void {
    this.editingCategoryId.set(category.id);
    this.categoryForm.patchValue({
      name: category.name,
      description: category.description || '',
    });
  }

  cancelEditCategory(): void {
    this.editingCategoryId.set(null);
    this.categoryForm.reset();
  }

  updateCategory(): void {
    const categoryId = this.editingCategoryId();
    const id = this.subjectId();
    if (!categoryId || !id || !this.categoryForm.valid) return;
    const v = this.categoryForm.value;
    const newName = (v.name || '').trim();
    if (!newName) return;

    this.infra.updateCategory(categoryId, {
      name: newName,
      description: v.description || null,
    }).subscribe(({ error }) => {
      if (error) {
        this.errorSnackbar.showError(error.message || 'Erreur lors de la mise à jour de la sous-catégorie');
        return;
      }
      this.toastService.success('Sous-catégorie mise à jour.');
      this.editingCategoryId.set(null);
      this.categoryForm.reset();
      this.loadCategories(id);
    });
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const confirmed = await this.confirmationDialog.confirm({
      message: 'Êtes-vous sûr de vouloir supprimer cette sous-catégorie ? Les jeux associés seront également supprimés.',
      type: 'danger',
    });

    if (!confirmed) {
      return;
    }
    const id = this.subjectId();
    if (!id) return;

    this.infra.deleteCategory(categoryId).subscribe(({ error }) => {
      if (error) {
        this.errorSnackbar.showError(error.message || 'Erreur lors de la suppression de la sous-catégorie');
        return;
      }
      this.toastService.success('Sous-catégorie supprimée.');
      this.loadCategories(id);
    });
  }

  onTransferCategory(categoryId: string): void {
    const category = this.categories().find(c => c.id === categoryId);
    if (category) {
      this.selectedCategoryForTransfer.set(category);
      this.showTransferDialog.set(true);
    }
  }

  onTransferConfirm(data: TransferCategoryData): void {
    const category = this.selectedCategoryForTransfer();
    if (!category) return;

    this.infra.transferCategory(category.id, data.newSubjectId).subscribe(({ error }) => {
      if (error) {
        this.errorSnackbar.showError(error.message || 'Erreur lors du transfert de la sous-catégorie');
        return;
      }
      this.toastService.success('Sous-catégorie transférée avec succès.');
      this.showTransferDialog.set(false);
      this.selectedCategoryForTransfer.set(null);
      const id = this.subjectId();
      if (id) {
        this.loadCategories(id);
      }
    });
  }

  onTransferCancel(): void {
    this.showTransferDialog.set(false);
    this.selectedCategoryForTransfer.set(null);
  }

  // Obtenir les stats de jeux pour une catégorie
  getCategoryGamesStats(categoryId: string): { total: number; stats: Record<string, number> } | null {
    const stats = this.gamesStatsService.getCategoryStats(categoryId);
    if (!stats) return null;
    return { total: stats.total, stats: stats.stats };
  }

  // Obtenir le nombre d'enfants inscrits à une catégorie
  getChildrenCountForCategory(categoryId: string): number {
    return this.childrenCountByCategory().get(categoryId) || 0;
  }

  // Formater les stats de jeux pour l'affichage
  formatCategoryGamesStats(categoryId: string): string {
    const statsData = this.getCategoryGamesStats(categoryId);
    if (!statsData || statsData.total === 0) {
      return '';
    }

    const formattedTypes = Object.entries(statsData.stats)
      .map(([type, count]) => `${type.toLowerCase()} (${count})`)
      .join(' • ');

    return `🎮 ${statsData.total} jeu${statsData.total > 1 ? 'x' : ''} : ${formattedTypes}`;
  }
}


