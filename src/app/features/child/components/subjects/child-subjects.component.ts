import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ParentSubjectService } from '../../services/subject/parent-subject.service';
import type { Subject } from '../../../teacher/types/subject';

@Component({
  selector: 'app-child-subjects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './child-subjects.component.html',
  styleUrls: ['./child-subjects.component.scss'],
})
export class ChildSubjectsComponent implements OnInit {
  @Input() childId?: string;
  private readonly parentSvc = inject(ParentSubjectService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly child = signal<any | null>(null);
  readonly availableSubjects = signal<Subject[]>([]);
  readonly enrollments = signal<{ subject_id: string; selected: boolean }[]>([]);
  readonly searchQuery = signal<string>('');
  readonly searchResults = signal<Subject[]>([]);

  ngOnInit(): void {
    // Récupérer childId depuis la route si pas fourni en @Input
    const routeChildId = this.route.snapshot.paramMap.get('childId');
    const finalChildId = this.childId || routeChildId;
    
    if (!finalChildId) {
      this.router.navigate(['/dashboard']);
      return;
    }
    
    this.childId = finalChildId;
    this.parentSvc.getChild(this.childId).subscribe(({ child }) => {
      this.child.set(child);
      if (child && child.school_id) {
        this.parentSvc.getAvailableSubjectsForChild(child).subscribe(({ subjects, error }) => {
          if (error) {
            console.error('Error loading available subjects:', error);
          }
          console.log('Available subjects loaded:', subjects?.length, subjects);
          this.availableSubjects.set(subjects || []);
        });
        this.parentSvc.getEnrollments(child.id).subscribe(({ enrollments, error }) => {
          if (error) {
            console.error('Error loading enrollments:', error);
          }
          console.log('Enrollments loaded:', enrollments?.length, enrollments);
          this.enrollments.set((enrollments || []).map(e => ({ subject_id: e.subject_id, selected: e.selected })));
        });
      }
    });
  }

  readonly selectedSubjects = computed(() => {
    const explicit = this.enrollments();
    // Seulement les matières avec selected=true dans les enrollments
    const selectedIds = new Set(explicit.filter(e => e.selected === true).map(e => e.subject_id));
    // Filtrer les matières disponibles qui sont sélectionnées
    return this.availableSubjects().filter(s => selectedIds.has(s.id));
  });
  readonly unselectedSubjects = computed(() => {
    const explicit = this.enrollments();
    // Matières avec selected=false ou absentes des enrollments
    const selectedIds = new Set(explicit.filter(e => e.selected === true).map(e => e.subject_id));
    // Afficher toutes les matières disponibles qui ne sont pas sélectionnées
    return this.availableSubjects().filter(s => !selectedIds.has(s.id));
  });
  isUnofficial(subjectId: string): boolean {
    const isInAvailable = this.availableSubjects().some(s => s.id === subjectId);
    const isSelected = this.enrollments().some(e => e.subject_id === subjectId && e.selected);
    return isSelected && !isInAvailable;
  }

  onToggle(subjectId: string, selected: boolean): void {
    const c = this.child();
    if (!c) return;
    const schoolYearId = (c as any).school_year_id || null;
    this.parentSvc.upsertEnrollment({ child_id: c.id, school_id: c.school_id, school_year_id: schoolYearId, subject_id: subjectId, selected })
      .subscribe(() => {
        const list = this.enrollments();
        const idx = list.findIndex(e => e.subject_id === subjectId);
        if (idx >= 0) list[idx] = { subject_id: subjectId, selected };
        else list.push({ subject_id: subjectId, selected });
        this.enrollments.set([...list]);
      });
  }

  onSearchInput(q: string): void {
    this.searchQuery.set(q);
    const trimmed = (q || '').trim();
    if (trimmed.length < 2) {
      this.searchResults.set([]);
      return;
    }
    
    console.log('🔍 Searching subjects for query:', trimmed);
    this.parentSvc.searchSubjects(trimmed).subscribe({
      next: ({ subjects, error }) => {
        if (error) {
          console.error('❌ Error searching subjects:', error);
          this.searchResults.set([]);
          return;
        }
        
        console.log('📋 Search results:', subjects?.length || 0, subjects);
        
        // Exclure celles déjà sélectionnées (par défaut ou explicite)
        const selectedIds = new Set(this.selectedSubjects().map(s => s.id));
        const filtered = (subjects || []).filter(s => !selectedIds.has(s.id));
        console.log('✅ Filtered search results (excluding selected):', filtered.length, filtered);
        this.searchResults.set(filtered);
      },
      error: (err) => {
        console.error('❌ Error in search subscription:', err);
        this.searchResults.set([]);
      }
    });
  }

  addSearchedSubject(subjectId: string): void {
    const c = this.child();
    if (!c) {
      console.error('❌ Cannot add subject: child not loaded');
      return;
    }
    const schoolYearId = (c as any).school_year_id || null;
    
    console.log('➕ Adding searched subject:', {
      child_id: c.id,
      school_id: c.school_id,
      school_year_id: schoolYearId,
      subject_id: subjectId,
      selected: true
    });
    
    this.parentSvc.upsertEnrollment({ 
      child_id: c.id, 
      school_id: c.school_id, 
      school_year_id: schoolYearId, 
      subject_id: subjectId, 
      selected: true 
    }).subscribe({
      next: ({ enrollment, error }) => {
        if (error) {
          console.error('❌ Error adding subject:', error);
          alert(`Erreur lors de l'ajout de la matière: ${error.message || 'Erreur inconnue'}`);
          return;
        }
        
        console.log('✅ Subject added successfully:', enrollment);
        
        // Mettre à jour la liste locale des enrollments
        const list = this.enrollments();
        const idx = list.findIndex(e => e.subject_id === subjectId);
        if (idx >= 0) {
          list[idx] = { subject_id: subjectId, selected: true };
        } else {
          list.push({ subject_id: subjectId, selected: true });
        }
        this.enrollments.set([...list]);
        
        // Vider les résultats de recherche
        this.searchResults.set([]);
        this.searchQuery.set('');
      },
      error: (err) => {
        console.error('❌ Error in addSearchedSubject subscription:', err);
        alert(`Erreur lors de l'ajout de la matière: ${err.message || 'Erreur inconnue'}`);
      }
    });
  }
}


