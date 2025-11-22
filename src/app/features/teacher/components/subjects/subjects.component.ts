import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Infrastructure } from '../infrastructure/infrastructure';
import { TeacherAssignmentStore } from '../../store/assignments.store';
import type { Subject } from '../../types/subject';
import { ErrorSnackbarService } from '../../../../shared/services/snackbar/error-snackbar.service';
import { ToastService } from '../../../../shared/services/toast/toast.service';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './subjects.component.html',
  styleUrls: ['./subjects.component.scss'],
})
export class SubjectsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly infra = inject(Infrastructure);
  private readonly errorSnackbar = inject(ErrorSnackbarService);
  private readonly toastService = inject(ToastService);
  readonly store = inject(TeacherAssignmentStore);

  readonly subjectId = signal<string | null>(null);
  readonly subjects = computed(() => this.store.subjects());
  readonly schools = computed(() => this.store.schools());
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
        
        console.log('[SubjectsComponent] Effect: vérification', {
          sid,
          subjectFound: !!subj,
          currentName,
          subjectName: subj.name,
          shouldFill,
          formExists: !!this.subjectForm
        });
        
        if (shouldFill) {
          console.log('[SubjectsComponent] Effect: remplissage du formulaire depuis le store', subj);
          this.fillFormFromSubject(subj);
        } else {
          console.log('[SubjectsComponent] Effect: formulaire déjà rempli, pas de changement nécessaire');
        }
      } else {
        console.warn('[SubjectsComponent] Effect: sujet non trouvé dans le store avec ID:', sid, 'Liste:', list.map(s => ({ id: s.id, name: s.name })));
      }
    } else {
      console.log('[SubjectsComponent] Effect: conditions non remplies', { sid, listLength: list.length });
    }
  }, { allowSignalWrites: true });

  subjectForm = this.fb.group({
    name: ['', Validators.required, [/* async */ this.nameUniqueValidator()]],
    description: [''],
    type: ['scolaire', Validators.required],
  });

  constructor() {
    // Écouter les changements du formulaire pour déboguer
    this.subjectForm.get('name')?.valueChanges.subscribe(value => {
      console.log('[SubjectsComponent] name valueChanges:', value);
    });
  }

  linkForm = this.fb.group({
    school_id: ['', Validators.required],
    school_level: ['', Validators.required],
    required: [true],
  });

  readonly links = signal<{ id: string; school_id: string; school_level: string; required: boolean }[]>([]);

  ngOnInit(): void {
    this.store.loadSchools();
    // Toujours charger tous les sujets pour s'assurer d'avoir la matière complète
    this.store.loadSubjects();
    const id = this.route.snapshot.paramMap.get('id');
    this.subjectId.set(id);
    
    console.log('[SubjectsComponent] Initialisation avec subjectId:', id);

    // Préselection via query params (ex: depuis le dashboard/affectations)
    const q = this.route.snapshot.queryParamMap;
    const qpSchoolId = q.get('school_id');
    const qpSchoolLevel = q.get('school_level');
    if (qpSchoolId || qpSchoolLevel) {
      const normalizedLevel = this.normalizeLevel(qpSchoolLevel || '');
      this.linkForm.patchValue({
        school_id: qpSchoolId || '',
        school_level: normalizedLevel || '',
      });
    }
    this.route.queryParamMap.subscribe(params => {
      const sId = params.get('school_id');
      const sLvl = params.get('school_level');
      if (sId || sLvl) {
        const normalized = this.normalizeLevel(sLvl || '');
        this.linkForm.patchValue({
          school_id: sId || this.linkForm.get('school_id')?.value || '',
          school_level: normalized || this.linkForm.get('school_level')?.value || '',
        });
      }
    });

    if (id) {
      this.loadLinks(id);
      
      // Essayer de remplir depuis le store d'abord (si disponible)
      // Le formulaire est déjà initialisé à ce stade, pas besoin de setTimeout
      const s = this.subjects().find(x => x.id === id);
      if (s) {
        console.log('[SubjectsComponent] Remplissage depuis le store (immédiat)', s);
        this.fillFormFromSubject(s);
      } else {
        console.log('[SubjectsComponent] Sujet non trouvé dans le store, chargement depuis l\'infrastructure');
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
          console.log('[SubjectsComponent] Remplissage depuis l\'infrastructure', found);
          this.fillFormFromSubject(found);
        } else {
          console.warn('[SubjectsComponent] Sujet non trouvé avec l\'ID:', id);
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

    // Validation: nom unique insensible à la casse
    const newName = (v.name || '').trim();
    if (!newName) return;
    const exists = this.subjects().some(s => (s.name || '').trim().toLowerCase() === newName.toLowerCase());
    if (exists) {
      this.errorSnackbar.showError('Cette matière existe déjà (même nom, insensible à la casse).');
      return;
    }

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
    console.log('[SubjectsComponent] update subject submit', { id, payload: v });
    const updates = {
      name: ((v.name || '').trim() || undefined) as string | undefined,
      description: (v.description || undefined) as string | undefined,
      type: v.type as Subject['type'],
    };
    this.infra.updateSubject(id, updates).subscribe(({ subject, error }) => {
      console.log('[SubjectsComponent] update subject result', { error, subject });
      if (error) {
        this.errorSnackbar.showError(error.message || 'Erreur lors de la mise à jour de la matière');
        return;
      }
      // Succès même si 'subject' est null (aucun champ réellement changé)
      this.store.loadSubjects();
      this.toastService.success('Matière enregistrée.');
    });
  }

  private nameUniqueValidator(): AsyncValidatorFn {
    return (control) => {
      const raw = (control.value || '') as string;
      const trimmed = raw.trim();
      if (!trimmed) {
        return Promise.resolve(null);
      }
      const currentId = this.subjectId();
      return new Promise<ValidationErrors | null>((resolve) => {
        this.infra.getSubjects().subscribe(({ subjects, error }) => {
          if (error) {
            resolve(null);
            return;
          }
          const exists = (subjects || []).some(s =>
            s.id !== currentId &&
            (s.name || '').trim().toLowerCase() === trimmed.toLowerCase()
          );
          resolve(exists ? { nameTaken: true } : null);
        });
      });
    };
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
      console.warn('[SubjectsComponent] fillFormFromSubject: sujet null ou undefined');
      return;
    }

    console.log('[SubjectsComponent] fillFormFromSubject appelé avec:', subject);
    
    // Vérifier que le formulaire existe
    if (!this.subjectForm) {
      console.error('[SubjectsComponent] fillFormFromSubject: formulaire non initialisé');
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

    // Vérifier immédiatement que les valeurs ont bien été assignées
    const actualName = this.subjectForm.get('name')?.value;
    const actualDesc = this.subjectForm.get('description')?.value;
    const actualType = this.subjectForm.get('type')?.value;
    
    console.log('[SubjectsComponent] fillFormFromSubject: formulaire rempli', {
      expected: { name: subject.name, description: subject.description, type: subject.type },
      actual: { name: actualName, description: actualDesc, type: actualType },
      match: actualName === subject.name && actualDesc === (subject.description || '') && actualType === subject.type
    });
    
    // Si les valeurs ne correspondent pas, réessayer immédiatement
    if (actualName !== subject.name || actualDesc !== (subject.description || '') || actualType !== subject.type) {
      console.warn('[SubjectsComponent] fillFormFromSubject: valeurs non correspondantes, nouvelle tentative');
      if (nameControl) nameControl.setValue(subject.name || '', { emitEvent: false });
      if (descriptionControl) descriptionControl.setValue(subject.description || '', { emitEvent: false });
      if (typeControl) typeControl.setValue(subject.type || 'scolaire', { emitEvent: false });
      this.subjectForm.updateValueAndValidity({ emitEvent: false });
    }
  }
}


