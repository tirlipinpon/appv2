import { Component, Input, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ParentSubjectService } from '../../services/subject/parent-subject.service';
import { SchoolService } from '../../services/school/school.service';
import { GamesStatsService } from '../../../../shared/services/games-stats/games-stats.service';
import { GamesStatsDisplayComponent } from '../../../../shared/components/games-stats-display/games-stats-display.component';
import type { Subject } from '../../../teacher/types/subject';
import type { Child } from '../../types/child';
import { getSchoolLevelLabel } from '../../../teacher/utils/school-levels.util';

@Component({
  selector: 'app-child-subjects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GamesStatsDisplayComponent],
  templateUrl: './child-subjects.component.html',
  styleUrls: ['./child-subjects.component.scss'],
})
export class ChildSubjectsComponent implements OnInit {
  @Input() childId?: string;
  private readonly parentSvc = inject(ParentSubjectService);
  private readonly schoolService = inject(SchoolService);
  private readonly gamesStatsService = inject(GamesStatsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly child = signal<Child | null>(null);
  readonly schoolName = signal<string | null>(null);
  readonly availableSubjects = signal<(Subject & { school_level?: string | null })[]>([]);
  readonly unofficialSubjects = signal<(Subject & { school_level?: string | null })[]>([]); // Matières hors programme
  readonly enrollments = signal<{ subject_id: string; selected: boolean }[]>([]);
  readonly searchQuery = signal<string>('');
  readonly searchResults = signal<(Subject & { school_level?: string | null })[]>([]);
  
  getSchoolLevelForSubject(subjectId: string): string | null {
    // Chercher d'abord dans availableSubjects
    const subject = this.availableSubjects().find(s => s.id === subjectId);
    if (subject?.school_level) return subject.school_level;
    
    // Sinon chercher dans unofficialSubjects
    const unofficial = this.unofficialSubjects().find(s => s.id === subjectId);
    return unofficial?.school_level || null;
  }
  
  // Effect pour charger les matières hors programme quand availableSubjects et enrollments sont chargés
  private loadUnofficialSubjectsTimeout: ReturnType<typeof setTimeout> | null = null;
  
  private readonly loadUnofficialSubjectsEffect = effect(() => {
    this.availableSubjects();
    const enrollments = this.enrollments();
    const child = this.child();
    
    // Ne charger que si l'enfant est chargé et qu'on a des enrollments
    if (child && enrollments.length > 0) {
      // Annuler le timeout précédent si existant
      if (this.loadUnofficialSubjectsTimeout) {
        clearTimeout(this.loadUnofficialSubjectsTimeout);
      }
      
      // Utiliser un petit délai pour éviter les appels multiples
      this.loadUnofficialSubjectsTimeout = setTimeout(() => {
        this.loadUnofficialSubjects();
        this.loadUnofficialSubjectsTimeout = null;
      }, 100);
    }
  });
  
  private loadUnofficialSubjects(): void {
    const availableIds = new Set(this.availableSubjects().map(s => s.id));
    const selectedEnrollments = this.enrollments().filter(e => e.selected === true);
    const unofficialSubjectIds = selectedEnrollments
      .map(e => e.subject_id)
      .filter(id => !availableIds.has(id));
    
    if (unofficialSubjectIds.length > 0) {
      const c = this.child();
      const schoolId = c?.school_id || null;
      
      // Chercher d'abord dans les résultats de recherche pour récupérer le niveau
      const searchResultsMap = new Map(this.searchResults().map(s => [s.id, s]));
      
      this.parentSvc.getSubjectsByIds(unofficialSubjectIds, schoolId).subscribe(({ subjects, error: subjError }) => {
        if (!subjError && subjects) {
          // Enrichir les matières avec le niveau depuis la recherche si disponible (priorité)
          const enrichedSubjects = subjects.map(s => {
            const searchResult = searchResultsMap.get(s.id);
            if (searchResult?.school_level) {
              return { ...s, school_level: searchResult.school_level };
            }
            // Sinon utiliser le niveau récupéré depuis la base de données
            return s;
          });
          
          // Dédupliquer par ID pour éviter les doublons (garder seulement les nouvelles matières)
          const currentUnofficial = this.unofficialSubjects();
          const currentIds = new Set(currentUnofficial.map(s => s.id));
          const newSubjects = enrichedSubjects.filter(s => !currentIds.has(s.id));
          
          if (newSubjects.length > 0) {
            // Dédupliquer par ID
            const byId = new Map<string, Subject & { school_level?: string | null }>();
            [...currentUnofficial, ...newSubjects].forEach(s => {
              if (s && s.id) {
                byId.set(s.id, s);
              }
            });
            
            this.unofficialSubjects.set(Array.from(byId.values()));
          }
        }
      });
    } else {
      this.unofficialSubjects.set([]);
    }
  }

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
      if (child) {
        this.child.set(child);
        // Charger le nom de l'école si school_id existe
        if (child.school_id) {
          this.schoolService.getSchoolById(child.school_id).subscribe(school => {
            this.schoolName.set(school?.name || null);
          });
          
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
            this.enrollments.set((enrollments || []).map(e => ({ 
              subject_id: e.subject_id, 
              selected: e.selected
            })));
          });
        } else {
          this.schoolName.set(null);
        }
      }
    });
  }

  readonly selectedSubjects = computed(() => {
    const explicit = this.enrollments();
    // Seulement les matières avec selected=true dans les enrollments
    const selectedIds = new Set(explicit.filter(e => e.selected === true).map(e => e.subject_id));
    
    // Matières disponibles qui sont sélectionnées
    const fromAvailable = this.availableSubjects().filter(s => selectedIds.has(s.id));
    
    // Matières hors programme qui sont sélectionnées (exclure celles déjà dans availableSubjects)
    const availableIds = new Set(fromAvailable.map(s => s.id));
    const fromUnofficial = this.unofficialSubjects().filter(s => selectedIds.has(s.id) && !availableIds.has(s.id));
    
    // Dédupliquer par ID pour éviter les doublons
    const byId = new Map<string, Subject & { school_level?: string | null }>();
    [...fromAvailable, ...fromUnofficial].forEach(s => {
      if (s && s.id) {
        byId.set(s.id, s);
      }
    });
    
    return Array.from(byId.values());
  });

  // Effect pour charger les stats de jeux quand les matières changent
  private readonly loadGamesStatsEffect = effect(() => {
    const selectedSubjects = this.selectedSubjects();
    const unselectedSubjects = this.unselectedSubjects();
    // Charger les stats pour toutes les matières affichées (sélectionnées + disponibles)
    const allSubjects = [...selectedSubjects, ...unselectedSubjects];
    if (allSubjects.length > 0) {
      const subjectIds = allSubjects.map(s => s.id).filter(Boolean) as string[];
      this.gamesStatsService.loadStatsForSubjects(subjectIds);
    }
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
    if (!c || !c.school_id) return;
    this.parentSvc.upsertEnrollment({ child_id: c.id, school_id: c.school_id, school_year_id: null, subject_id: subjectId, selected })
      .subscribe(() => {
        // Mettre à jour la liste locale des enrollments
        const list = this.enrollments();
        const idx = list.findIndex(e => e.subject_id === subjectId);
        if (idx >= 0) {
          list[idx] = { subject_id: subjectId, selected };
        } else {
          list.push({ subject_id: subjectId, selected });
        }
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
    
    const c = this.child();
    const schoolId = c?.school_id || null;
    
    console.log('🔍 Searching subjects for query:', trimmed, 'schoolId:', schoolId);
    this.parentSvc.searchSubjects(trimmed, schoolId).subscribe({
      next: ({ subjects, error }) => {
        if (error) {
          console.error('❌ Error searching subjects:', error);
          this.searchResults.set([]);
          return;
        }
        
        console.log('📋 Search results:', subjects?.length || 0, subjects);
        
        // Exclure celles déjà dans "Matières activées" (selectedSubjects)
        const selectedSubjectIds = new Set(this.selectedSubjects().map(s => s.id));
        const filtered = (subjects || []).filter(s => !selectedSubjectIds.has(s.id));
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
    if (!c || !c.school_id) {
      console.error('❌ Cannot add subject: child not loaded or no school_id');
      return;
    }
    
    console.log('➕ Adding searched subject:', {
      child_id: c.id,
      school_id: c.school_id,
      subject_id: subjectId,
      selected: true
    });
    
    this.parentSvc.upsertEnrollment({ 
      child_id: c.id, 
      school_id: c.school_id, 
      school_year_id: null, 
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
        
        // Charger la matière ajoutée si elle n'est pas dans availableSubjects (hors programme)
        const availableIds = new Set(this.availableSubjects().map(s => s.id));
        if (!availableIds.has(subjectId)) {
          // Chercher d'abord dans les résultats de recherche pour récupérer le niveau
          const searchedSubject = this.searchResults().find(s => s.id === subjectId);
          if (searchedSubject) {
            // Utiliser la matière de la recherche qui a déjà le niveau
            const currentUnofficial = this.unofficialSubjects();
            if (!currentUnofficial.some(s => s.id === subjectId)) {
              // Dédupliquer par ID
              const byId = new Map<string, Subject & { school_level?: string | null }>();
              [...currentUnofficial, searchedSubject].forEach(s => {
                if (s && s.id) {
                  byId.set(s.id, s);
                }
              });
              this.unofficialSubjects.set(Array.from(byId.values()));
            }
          } else {
            // Sinon charger depuis la base de données avec le niveau
            const schoolId = c?.school_id || null;
            this.parentSvc.getSubjectsByIds([subjectId], schoolId).subscribe(({ subjects, error: subjError }) => {
              if (!subjError && subjects && subjects.length > 0) {
                const currentUnofficial = this.unofficialSubjects();
                if (!currentUnofficial.some(s => s.id === subjectId)) {
                  // Dédupliquer par ID
                  const byId = new Map<string, Subject & { school_level?: string | null }>();
                  [...currentUnofficial, ...subjects].forEach(s => {
                    if (s && s.id) {
                      byId.set(s.id, s);
                    }
                  });
                  this.unofficialSubjects.set(Array.from(byId.values()));
                }
              }
            });
          }
        }
        
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

  // Utilise directement la fonction utils
  readonly getSchoolLevelLabel = getSchoolLevelLabel;
}


