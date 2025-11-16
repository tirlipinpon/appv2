import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Infrastructure } from '../infrastructure/infrastructure';
import { TeacherAssignmentStore } from '../../store/assignments.store';
import type { Subject } from '../../types/subject';
import { SchoolLevelSelectComponent } from '../../../../shared/components/school-level-select/school-level-select.component';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SchoolLevelSelectComponent],
  templateUrl: './subjects.component.html',
  styleUrls: ['./subjects.component.scss'],
})
export class SubjectsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly infra = inject(Infrastructure);
  readonly store = inject(TeacherAssignmentStore);

  readonly subjectId = signal<string | null>(null);
  readonly subjects = computed(() => this.store.subjects());
  readonly schools = computed(() => this.store.schools());

  subjectForm = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    type: ['scolaire', Validators.required],
  });

  linkForm = this.fb.group({
    school_id: ['', Validators.required],
    school_level: ['', Validators.required],
    required: [true],
  });

  readonly links = signal<Array<{ id: string; school_id: string; school_level: string; required: boolean }>>([]);

  ngOnInit(): void {
    this.store.loadSchools();
    this.store.loadSubjects();
    const id = this.route.snapshot.paramMap.get('id');
    this.subjectId.set(id);

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
      const s = this.subjects().find(x => x.id === id);
      if (s) this.subjectForm.patchValue({ name: s.name || '', description: s.description || '', type: s.type || 'scolaire' });
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
      'seconde': '2nde',
      '2nde': '2nde',
      'terminale': 'terminale',
      'cp': 'cp',
      'ce1': 'ce1',
      'ce2': 'ce2',
      'cm1': 'cm1',
      'cm2': 'cm2',
      'maternelle': 'maternelle',
      'autre': 'autre',
    };
    const key = (level || '').toLowerCase();
    // conserver les valeurs déjà compatibles
    return map[key] || level;
  }

  create(): void {
    if (!this.subjectForm.valid) return;
    const v = this.subjectForm.value;
    this.infra.createSubject({
      name: v.name!,
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

  addLink(): void {
    if (!(this.linkForm.valid && this.subjectId())) return;
    const v = this.linkForm.value;
    this.infra.addSubjectLink({
      subject_id: this.subjectId()!,
      school_id: v.school_id!,
      school_level: v.school_level!,
      required: !!v.required,
    }).subscribe(() => {
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
}


