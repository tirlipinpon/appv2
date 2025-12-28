import { Component, Input, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ParentSubjectService, CategoryEnrollment, Enrollment } from '../../services/subject/parent-subject.service';
import { SchoolService } from '../../services/school/school.service';
import { GamesStatsService } from '../../../../shared/services/games-stats/games-stats.service';
import { GamesStatsDisplayComponent } from '../../../../shared/components/games-stats-display/games-stats-display.component';
import type { Subject, SubjectCategory } from '../../../teacher/types/subject';
import type { Child } from '../../types/child';
import { getSchoolLevelLabel } from '../../../teacher/utils/school-levels.util';

@Component({
  selector: 'app-child-subjects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GamesStatsDisplayComponent],
  templateUrl: './child-subjects.component.html',
  styleUrls: ['./child-subjects.component.scss'],
})
export class ChildSubjectsComponent implements OnInit, OnDestroy {
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
  readonly categoriesBySubject = signal<Map<string, SubjectCategory[]>>(new Map());
  readonly categoryEnrollments = signal<CategoryEnrollment[]>([]);
  readonly expandedSubjects = signal<Set<string>>(new Set()); // Matières avec sous-catégories visibles
  readonly selectedSubjectTypeFilter = signal<'scolaire' | 'extra' | 'optionnelle' | null>(null);
  
  getSchoolLevelForSubject(subjectId: string): string | null {
    // Chercher d'abord dans availableSubjects
    const subject = this.availableSubjects().find(s => s.id === subjectId);
    if (subject?.school_level) return subject.school_level;
    
    // Sinon chercher dans unofficialSubjects
    const unofficial = this.unofficialSubjects().find(s => s.id === subjectId);
    return unofficial?.school_level || null;
  }

  getSubjectTypeLabel(type: 'scolaire' | 'extra' | 'optionnelle'): string {
    const labels = {
      'scolaire': 'Scolaire',
      'extra': 'Extra-scolaire',
      'optionnelle': 'Optionnelle'
    };
    return labels[type] || type;
  }
  
  // Mécanisme pour recharger les données quand la page redevient visible (après transfert d'affectation)
  private visibilityChangeHandler: (() => void) | null = null;
  private reloadDataTimeout: ReturnType<typeof setTimeout> | null = null;
  private reloadDataInterval: ReturnType<typeof setInterval> | null = null;
  
  private reloadData(): void {
    const child = this.child();
    if (!child) return;
    
    // Annuler le timeout précédent si existant
    if (this.reloadDataTimeout) {
      clearTimeout(this.reloadDataTimeout);
    }
    
    // Utiliser un petit délai pour éviter les appels multiples
    this.reloadDataTimeout = setTimeout(() => {
      // Recharger availableSubjects et enrollments en parallèle
      forkJoin({
        availableSubjects: this.parentSvc.getAvailableSubjectsForChild(child),
        enrollments: this.parentSvc.getEnrollments(child.id)
        }).subscribe({
          next: ({ availableSubjects, enrollments }) => {
          try {
          const allEnrollments = enrollments.enrollments || [];
          
          // Mettre à jour availableSubjects
          this.availableSubjects.set(availableSubjects.subjects || []);
          
          // Créer automatiquement les enrollments manquants avec selected=true pour les matières dans availableSubjects
          const existingEnrollmentIds = new Set(allEnrollments.map(e => e.subject_id));
          const missingEnrollments = (availableSubjects.subjects || []).filter(s => !existingEnrollmentIds.has(s.id));
          
          if (missingEnrollments.length > 0 && child.school_id) {
            // Créer tous les enrollments manquants en parallèle
            const enrollmentCreates = missingEnrollments.map(subject => 
              this.parentSvc.upsertEnrollment({
                child_id: child.id,
                school_id: child.school_id!,
                subject_id: subject.id,
                selected: true
              })
            );
            
            forkJoin(enrollmentCreates).subscribe({
              next: () => {
                // Recharger les enrollments après création
                this.parentSvc.getEnrollments(child.id).subscribe(({ enrollments, error }) => {
                  if (!error && enrollments) {
                    this.enrollments.set(enrollments.map((e: Enrollment) => ({ 
                      subject_id: e.subject_id, 
                      selected: e.selected
                    })));
                  }
                });
              },
              error: (err) => {
                console.error('Error creating missing enrollments:', err);
              }
            });
          } else {
            // Mettre à jour enrollments normalement si aucun enrollment manquant
            this.enrollments.set((enrollments.enrollments || []).map(e => ({ 
              subject_id: e.subject_id, 
              selected: e.selected
            })));
          }
          } catch (err) {
            console.error('Error in reloadData next callback:', err);
          }
          },
          error: (err) => {
            console.error('Error reloading data:', err);
          }
        });
      this.reloadDataTimeout = null;
    }, 200);
  }

  // Effect pour charger les matières hors programme quand availableSubjects et enrollments sont chargés
  private loadUnofficialSubjectsTimeout: ReturnType<typeof setTimeout> | null = null;
  private isLoadingUnofficialSubjects = false;
  private lastLoadUnofficialSubjectsIds = '';
  
  private readonly loadUnofficialSubjectsEffect = effect(() => {
    this.availableSubjects();
    const enrollments = this.enrollments();
    const child = this.child();
    
    // Nettoyer les matières scolaires qui ne sont plus dans availableSubjects
    // (c'est-à-dire dont l'affectation a été supprimée)
    const availableIds = new Set(this.availableSubjects().map(s => s.id));
    const currentUnofficial = this.unofficialSubjects();
    const cleanedUnofficial = currentUnofficial.filter(s => {
      // Si c'est une matière scolaire, elle doit être dans availableSubjects (affectation active)
      if (s.type === 'scolaire') {
        return availableIds.has(s.id);
      }
      // Pour les matières extra/optionnelles, on peut les garder
      return true;
    });
    if (cleanedUnofficial.length !== currentUnofficial.length) {
      this.unofficialSubjects.set(cleanedUnofficial);
    }
    
    // Ne charger que si l'enfant est chargé et qu'on a des enrollments
    if (child && enrollments.length > 0) {
      // Calculer l'identifiant unique pour cette combinaison de données
      const availableIdsStr = Array.from(availableIds).sort().join(',');
      const selectedEnrollmentIds = enrollments
        .filter(e => e.selected === true)
        .map(e => e.subject_id)
        .sort()
        .join(',');
      const currentIds = `${availableIdsStr}|${selectedEnrollmentIds}`;
      
      // Si on est déjà en train de charger ou si c'est la même combinaison, ne pas recharger
      if (this.isLoadingUnofficialSubjects || this.lastLoadUnofficialSubjectsIds === currentIds) {
        return;
      }
      
      // Annuler le timeout précédent si existant
      if (this.loadUnofficialSubjectsTimeout) {
        clearTimeout(this.loadUnofficialSubjectsTimeout);
      }
      
      // Utiliser un petit délai pour éviter les appels multiples
      this.loadUnofficialSubjectsTimeout = setTimeout(() => {
        this.lastLoadUnofficialSubjectsIds = currentIds;
        this.loadUnofficialSubjects();
        this.loadUnofficialSubjectsTimeout = null;
      }, 100);
    }
  });
  
  private loadUnofficialSubjects(): void {
    // Éviter les appels multiples simultanés
    if (this.isLoadingUnofficialSubjects) {
      return;
    }

    const availableIds = new Set(this.availableSubjects().map(s => s.id));
    const selectedEnrollments = this.enrollments().filter(e => e.selected === true);
    // Filtrer pour exclure les matières scolaires qui ne sont pas dans availableSubjects
    // (car cela signifie que l'affectation a été supprimée)
    const unofficialSubjectIds = selectedEnrollments
      .map(e => e.subject_id)
      .filter(id => !availableIds.has(id));
    
    if (unofficialSubjectIds.length > 0) {
      this.isLoadingUnofficialSubjects = true;
      const c = this.child();
      const schoolId = c?.school_id || null;
      
      // Chercher d'abord dans les résultats de recherche pour récupérer le niveau
      const searchResultsMap = new Map(this.searchResults().map(s => [s.id, s]));
      
      this.parentSvc.getSubjectsByIds(unofficialSubjectIds, schoolId).subscribe(({ subjects, error: subjError }) => {
        this.isLoadingUnofficialSubjects = false;
        
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
          
          // Filtrer les matières scolaires qui ne sont pas dans availableSubjects
          // (car cela signifie que l'affectation a été supprimée)
          const filteredSubjects = enrichedSubjects.filter(s => {
            // Si c'est une matière scolaire, elle doit être dans availableSubjects (affectation active)
            if (s.type === 'scolaire') {
              return availableIds.has(s.id);
            }
            // Pour les matières extra/optionnelles, on peut les charger
            return true;
          });
          
          // Dédupliquer par ID pour éviter les doublons (garder seulement les nouvelles matières)
          const currentUnofficial = this.unofficialSubjects();
          const currentIds = new Set(currentUnofficial.map(s => s.id));
          const newSubjects = filteredSubjects.filter(s => !currentIds.has(s.id));
          
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
          // Charger toutes les données nécessaires en parallèle (optimisation)
          forkJoin({
            availableSubjects: this.parentSvc.getAvailableSubjectsForChild(child),
            enrollments: this.parentSvc.getEnrollments(child.id),
            categoryEnrollments: this.parentSvc.getCategoryEnrollments(child.id),
            school: this.schoolService.getSchoolById(child.school_id)
          }).subscribe(({ availableSubjects, enrollments, categoryEnrollments, school }) => {
            // Traiter le nom de l'école
            this.schoolName.set(school?.name || null);
            
            // Traiter les matières disponibles
            if (availableSubjects.error) {
              console.error('Error loading available subjects:', availableSubjects.error);
            }
            console.log('Available subjects loaded:', availableSubjects.subjects?.length, availableSubjects.subjects);
            this.availableSubjects.set(availableSubjects.subjects || []);
            
            // Traiter les enrollments
            if (enrollments.error) {
              console.error('Error loading enrollments:', enrollments.error);
            }
            console.log('Enrollments loaded:', enrollments.enrollments?.length, enrollments.enrollments);
            const allEnrollments = enrollments.enrollments || [];
            this.enrollments.set(allEnrollments.map(e => ({ 
              subject_id: e.subject_id, 
              selected: e.selected
            })));
            
            // Créer automatiquement les enrollments manquants avec selected=true pour les matières dans availableSubjects
            if (child.school_id && availableSubjects.subjects && availableSubjects.subjects.length > 0) {
              const existingEnrollmentIds = new Set(allEnrollments.map(e => e.subject_id));
              const missingEnrollments = availableSubjects.subjects.filter(s => !existingEnrollmentIds.has(s.id));
              
              if (missingEnrollments.length > 0 && child.school_id) {
                // Créer tous les enrollments manquants en parallèle
                const enrollmentCreates = missingEnrollments.map(subject => 
                  this.parentSvc.upsertEnrollment({
                    child_id: child.id,
                    school_id: child.school_id!,
                    subject_id: subject.id,
                    selected: true
                  })
                );
                
                forkJoin(enrollmentCreates).subscribe({
                  next: () => {
                    // Recharger les enrollments après création
                    this.parentSvc.getEnrollments(child.id).subscribe(({ enrollments, error }) => {
                      if (!error && enrollments) {
                        this.enrollments.set(enrollments.map((e: Enrollment) => ({ 
                          subject_id: e.subject_id, 
                          selected: e.selected
                        })));
                      }
                    });
                  },
                  error: (err) => {
                    console.error('Error creating missing enrollments:', err);
                  }
                });
              }
            }
            
            // Traiter les category enrollments
            if (categoryEnrollments.error) {
              console.error('Error loading category enrollments:', categoryEnrollments.error);
            }
            console.log('Category enrollments loaded:', categoryEnrollments.enrollments?.length, categoryEnrollments.enrollments);
            this.categoryEnrollments.set(categoryEnrollments.enrollments || []);
            
            // Charger les catégories pour toutes les matières en BATCH (optimisation)
            // Utiliser directement les données chargées plutôt que les computed signals
            const selectedIds = new Set((enrollments.enrollments || [])
              .filter(e => e.selected === true)
              .map(e => e.subject_id));
            const availableIds = (availableSubjects.subjects || []).map(s => s.id);
            const allSubjectIds = [...new Set([...Array.from(selectedIds), ...availableIds])];
            
            // Charger toutes les catégories en une seule requête
            if (allSubjectIds.length > 0) {
              this.loadCategoriesBatch(allSubjectIds, selectedIds, child.id);
            }
          });
        } else {
          this.schoolName.set(null);
        }
      }
    });
    
    // Écouter les événements de visibilité pour recharger les données quand la page redevient visible
    // Cela permet de synchroniser les données après un transfert d'affectation quand l'utilisateur revient sur la page
    // NOTE: Le setInterval a été désactivé pour éviter les appels API répétés inutiles
    // La synchronisation se fait uniquement via visibilitychange (quand l'utilisateur revient sur l'onglet)
    if (typeof document !== 'undefined') {
      this.visibilityChangeHandler = () => {
        if (document.visibilityState === 'visible') {
          this.reloadData();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
      
      // DÉSACTIVÉ: Rechargement périodique désactivé pour optimiser les performances
      // Si nécessaire, vous pouvez réactiver avec un intervalle plus long (ex: 30000ms = 30 secondes)
      // this.reloadDataInterval = setInterval(() => {
      //   if (document.visibilityState === 'visible' && this.child()) {
      //     this.reloadData();
      //   }
      // }, 30000); // 30 secondes au lieu de 5
    }
  }
  
  ngOnDestroy(): void {
    // Nettoyer les listeners
    if (this.visibilityChangeHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    if (this.reloadDataTimeout) {
      clearTimeout(this.reloadDataTimeout);
    }
    if (this.reloadDataInterval) {
      clearInterval(this.reloadDataInterval);
    }
  }

  readonly selectedSubjects = computed(() => {
    const explicit = this.enrollments();
    // Seulement les matières avec selected=true dans les enrollments
    const selectedIds = new Set(explicit.filter(e => e.selected === true).map(e => e.subject_id));
    
    // Matières disponibles qui sont sélectionnées (celles-ci ont toujours une affectation active)
    const fromAvailable = this.availableSubjects().filter(s => selectedIds.has(s.id));
    
    // Matières hors programme qui sont sélectionnées (exclure celles déjà dans availableSubjects)
    // IMPORTANT: Pour les matières scolaires, ne les afficher que si elles sont dans availableSubjects
    // (c'est-à-dire si l'affectation existe toujours)
    const availableIds = new Set(fromAvailable.map(s => s.id));
    const fromUnofficial = this.unofficialSubjects().filter(s => {
      // Si c'est une matière scolaire, elle doit être dans availableSubjects (affectation active)
      if (s.type === 'scolaire') {
        return availableIds.has(s.id);
      }
      // Pour les matières extra/optionnelles, on peut les afficher même si pas dans availableSubjects
      return selectedIds.has(s.id) && !availableIds.has(s.id);
    });
    
    // Dédupliquer par ID pour éviter les doublons
    const byId = new Map<string, Subject & { school_level?: string | null }>();
    [...fromAvailable, ...fromUnofficial].forEach(s => {
      if (s && s.id) {
        byId.set(s.id, s);
      }
    });
    
    const result = Array.from(byId.values());
    // Appliquer le filtre par type
    const typeFilter = this.selectedSubjectTypeFilter();
    if (typeFilter) {
      return result.filter(s => s.type === typeFilter);
    }
    return result;
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
    const filtered = this.availableSubjects().filter(s => !selectedIds.has(s.id));
    // Appliquer le filtre par type
    const typeFilter = this.selectedSubjectTypeFilter();
    if (typeFilter) {
      return filtered.filter(s => s.type === typeFilter);
    }
    return filtered;
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
        
        // Si on active une matière, charger ses catégories et créer les enrollments par défaut
        if (selected) {
          this.loadCategoriesForSubject(subjectId, true);
        } else {
          // Si on désactive une matière, retirer les catégories de la map
          const categoriesMap = this.categoriesBySubject();
          categoriesMap.delete(subjectId);
          this.categoriesBySubject.set(new Map(categoriesMap));
        }
      });
  }

  /**
   * Charge les catégories de plusieurs matières en batch (optimisation)
   */
  private loadCategoriesBatch(subjectIds: string[], selectedSubjectIds: Set<string>, childId: string): void {
    if (subjectIds.length === 0) return;

    this.parentSvc.getSubjectCategoriesBatch(subjectIds).subscribe(({ categoriesBySubject, error }) => {
      if (error) {
        console.error('Error loading categories batch:', error);
        return;
      }

      // Mettre à jour le signal avec toutes les catégories
      const currentCategoriesMap = this.categoriesBySubject();
      categoriesBySubject.forEach((categories, subjectId) => {
        currentCategoriesMap.set(subjectId, categories);
      });
      this.categoriesBySubject.set(new Map(currentCategoriesMap));

      // Charger les stats de jeux pour toutes les catégories en parallèle
      const allCategoryIds: string[] = [];
      categoriesBySubject.forEach(categories => {
        categories.forEach(category => {
          allCategoryIds.push(category.id);
        });
      });
      if (allCategoryIds.length > 0) {
        this.gamesStatsService.loadStatsForCategories(allCategoryIds);
      }

      // Créer automatiquement les enrollments pour toutes les catégories des matières sélectionnées en batch
      const existingEnrollments = this.categoryEnrollments();
      const existingCategoryIds = new Set(existingEnrollments.map(e => e.subject_category_id));
      
      const enrollmentsToCreate: { child_id: string; subject_category_id: string; selected: boolean }[] = [];
      categoriesBySubject.forEach((categories, subjectId) => {
        if (selectedSubjectIds.has(subjectId)) {
          categories.forEach(category => {
            if (!existingCategoryIds.has(category.id)) {
              enrollmentsToCreate.push({
                child_id: childId,
                subject_category_id: category.id,
                selected: true
              });
            }
          });
        }
      });

      // Créer tous les enrollments en batch
      if (enrollmentsToCreate.length > 0) {
        this.parentSvc.upsertCategoryEnrollmentsBatch(enrollmentsToCreate).subscribe(({ enrollments, error: enrollError }) => {
          if (!enrollError && enrollments && enrollments.length > 0) {
            const currentEnrollments = this.categoryEnrollments();
            // Éviter les doublons
            const existingIds = new Set(currentEnrollments.map(e => e.id));
            const newEnrollments = enrollments.filter(e => !existingIds.has(e.id));
            this.categoryEnrollments.set([...currentEnrollments, ...newEnrollments]);
          }
        });
      }
    });
  }

  private loadCategoriesForSubject(subjectId: string, isSelected = true): void {
    // Vérifier si déjà chargé
    if (this.categoriesBySubject().has(subjectId)) {
      // Si la matière est sélectionnée, s'assurer que les enrollments sont créés
      if (isSelected) {
        const categories = this.getCategoriesForSubject(subjectId);
        const c = this.child();
        if (c && categories.length > 0) {
          const existingEnrollments = this.categoryEnrollments();
          const existingCategoryIds = new Set(existingEnrollments.map(e => e.subject_category_id));
          
          const enrollmentsToCreate = categories
            .filter(category => !existingCategoryIds.has(category.id))
            .map(category => ({
              child_id: c.id,
              subject_category_id: category.id,
              selected: true
            }));

          if (enrollmentsToCreate.length > 0) {
            this.parentSvc.upsertCategoryEnrollmentsBatch(enrollmentsToCreate).subscribe(({ enrollments, error: enrollError }) => {
              if (!enrollError && enrollments && enrollments.length > 0) {
                const currentEnrollments = this.categoryEnrollments();
                const existingIds = new Set(currentEnrollments.map(e => e.id));
                const newEnrollments = enrollments.filter(e => !existingIds.has(e.id));
                this.categoryEnrollments.set([...currentEnrollments, ...newEnrollments]);
              }
            });
          }
        }
      }
      return;
    }

    this.parentSvc.getSubjectCategories(subjectId).subscribe(({ categories, error }) => {
      if (error) {
        console.error('Error loading categories for subject:', subjectId, error);
        return;
      }
      
      const categoriesMap = this.categoriesBySubject();
      categoriesMap.set(subjectId, categories || []);
      this.categoriesBySubject.set(new Map(categoriesMap));
      
      // Charger les stats de jeux pour les catégories en parallèle
      if (categories && categories.length > 0) {
        const categoryIds = categories.map(c => c.id);
        this.gamesStatsService.loadStatsForCategories(categoryIds);
      }
      
      // Créer automatiquement les enrollments pour toutes les catégories seulement si la matière est sélectionnée
      if (isSelected) {
        const c = this.child();
        if (!c) return;
        
        const existingEnrollments = this.categoryEnrollments();
        const existingCategoryIds = new Set(existingEnrollments.map(e => e.subject_category_id));
        
        const enrollmentsToCreate = (categories || [])
          .filter(category => !existingCategoryIds.has(category.id))
          .map(category => ({
            child_id: c.id,
            subject_category_id: category.id,
            selected: true
          }));

        // Utiliser le batch au lieu de créer un par un
        if (enrollmentsToCreate.length > 0) {
          this.parentSvc.upsertCategoryEnrollmentsBatch(enrollmentsToCreate).subscribe(({ enrollments, error: enrollError }) => {
            if (!enrollError && enrollments && enrollments.length > 0) {
              const currentEnrollments = this.categoryEnrollments();
              const existingIds = new Set(currentEnrollments.map(e => e.id));
              const newEnrollments = enrollments.filter(e => !existingIds.has(e.id));
              this.categoryEnrollments.set([...currentEnrollments, ...newEnrollments]);
            }
          });
        }
      }
    });
  }

  getCategoriesForSubject(subjectId: string): SubjectCategory[] {
    return this.categoriesBySubject().get(subjectId) || [];
  }

  isCategorySelected(categoryId: string): boolean {
    const enrollment = this.categoryEnrollments().find(e => e.subject_category_id === categoryId);
    return enrollment?.selected ?? false;
  }

  onToggleCategory(categoryId: string, selected: boolean): void {
    const c = this.child();
    if (!c) return;
    
    this.parentSvc.upsertCategoryEnrollment({
      child_id: c.id,
      subject_category_id: categoryId,
      selected
    }).subscribe(({ enrollment, error }) => {
      if (error) {
        console.error('Error toggling category enrollment:', error);
        return;
      }
      
      // Mettre à jour la liste locale
      const list = this.categoryEnrollments();
      const idx = list.findIndex(e => e.subject_category_id === categoryId);
      if (idx >= 0) {
        if (enrollment) {
          list[idx] = enrollment;
        } else {
          list.splice(idx, 1);
        }
      } else if (enrollment) {
        list.push(enrollment);
      }
      this.categoryEnrollments.set([...list]);
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
        
        // Charger les catégories de la matière ajoutée
        this.loadCategoriesForSubject(subjectId, true);
        
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

  // Toggle l'expansion des sous-catégories
  toggleCategories(subjectId: string): void {
    const expanded = this.expandedSubjects();
    if (expanded.has(subjectId)) {
      expanded.delete(subjectId);
    } else {
      expanded.add(subjectId);
    }
    this.expandedSubjects.set(new Set(expanded));
  }

  // Vérifie si les sous-catégories sont visibles
  isCategoriesExpanded(subjectId: string): boolean {
    return this.expandedSubjects().has(subjectId);
  }

  // Récupère le nombre total de jeux pour une matière (incluant les jeux des catégories)
  getTotalGamesCount(subjectId: string): number {
    const subjectStats = this.gamesStatsService.getStats(subjectId);
    let total = subjectStats?.total || 0;
    
    // Ajouter les jeux de toutes les catégories
    const categories = this.getCategoriesForSubject(subjectId);
    categories.forEach(category => {
      const categoryStats = this.gamesStatsService.getCategoryStats(category.id);
      if (categoryStats) {
        total += categoryStats.total;
      }
    });
    
    return total;
  }

  // Récupère le nombre de sous-catégories pour une matière
  getCategoriesCount(subjectId: string): number {
    return this.getCategoriesForSubject(subjectId).length;
  }
}


