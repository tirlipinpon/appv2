import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap, map, catchError, of } from 'rxjs';
import { TeacherService } from '../../services/teacher/teacher.service';
import { SchoolService } from '../../services/school/school.service';
import { SchoolYearService } from '../../services/school-year/school-year.service';
import { SubjectService } from '../../services/subject/subject.service';
import { SubjectCategoryService } from '../../services/subject-category/subject-category.service';
import { TeacherAssignmentService } from '../../services/teacher-assignment/teacher-assignment.service';
import { GameTypeService } from '../../services/game-type/game-type.service';
import { GameService } from '../../services/game/game.service';
import { AIGameGeneratorService } from '../../services/ai-game-generator/ai-game-generator.service';
import { SupabaseService } from '../../../../shared';
import type { Teacher, TeacherUpdate } from '../../types/teacher';
import type { School } from '../../types/school';
import type { Subject } from '../../types/subject';
import type { SubjectCategory, SubjectCategoryCreate, SubjectCategoryUpdate } from '../../types/subject';
import type { TeacherAssignment, TeacherAssignmentCreate, TeacherAssignmentUpdate } from '../../types/teacher-assignment';
import type { GameType } from '../../types/game-type';
import type { Game, GameCreate, GameUpdate } from '../../types/game';
import type { PostgrestError } from '@supabase/supabase-js';
import type { SchoolYear } from '../../types/school';
import type { Child } from '../../../child/types/child';
import type { AIGameGenerationRequest, AIRawResponse } from '../../types/ai-game-generation';

@Injectable({
  providedIn: 'root',
})
export class Infrastructure {
  private readonly teacherService = inject(TeacherService);
  private readonly schoolService = inject(SchoolService);
  private readonly schoolYearService = inject(SchoolYearService);
  private readonly subjectService = inject(SubjectService);
  private readonly subjectCategoryService = inject(SubjectCategoryService);
  private readonly teacherAssignmentService = inject(TeacherAssignmentService);
  private readonly gameTypeService = inject(GameTypeService);
  private readonly gameService = inject(GameService);
  private readonly aiGameGeneratorService = inject(AIGameGeneratorService);
  private readonly supabaseService = inject(SupabaseService);

  getTeacherProfile(): Observable<Teacher | null> {
    return this.teacherService.getTeacherProfile();
  }

  updateTeacherProfile(updates: TeacherUpdate): Observable<{ teacher: Teacher | null; error: PostgrestError | null }> {
    return this.teacherService.updateTeacherProfile(updates);
  }

  createTeacherProfile(profileData: Omit<Teacher, 'id' | 'profile_id' | 'created_at' | 'updated_at'>): Observable<{ teacher: Teacher | null; error: PostgrestError | null }> {
    return this.teacherService.createTeacherProfile(profileData);
  }

  getAllTeachers(excludeTeacherId?: string): Observable<{ teachers: Teacher[]; error: PostgrestError | null }> {
    return this.teacherService.getAllTeachers(excludeTeacherId);
  }

  // ===== Domaine Affectations (Teacher) =====
  getSchools(): Observable<{ schools: School[]; error: PostgrestError | null }> {
    return this.schoolService.getSchools();
  }

  createSchool(schoolData: Omit<School, 'id' | 'created_at' | 'updated_at'>): Observable<{ school: School | null; error: PostgrestError | null }> {
    return this.schoolService.createSchool(schoolData);
  }

  getSchoolYearsBySchool(schoolId: string): Observable<{ schoolYears: SchoolYear[]; error: PostgrestError | null }> {
    return this.schoolYearService.getSchoolYearsBySchool(schoolId);
  }

  createSchoolYear(schoolYearData: Omit<SchoolYear, 'id' | 'created_at' | 'updated_at'>): Observable<{ schoolYear: SchoolYear | null; error: PostgrestError | null }> {
    return this.schoolYearService.createSchoolYear(schoolYearData);
  }

  getSubjects(): Observable<{ subjects: Subject[]; error: PostgrestError | null }> {
    return this.subjectService.getSubjects();
  }

  getSubjectsForSchoolLevel(schoolId: string, schoolLevel: string): Observable<{ subjects: Subject[]; error: PostgrestError | null }> {
    console.log('[Infrastructure] getSubjectsForSchoolLevel → call', { schoolId, schoolLevel });
    return this.subjectService.getSubjectsForSchoolLevel(schoolId, schoolLevel);
  }

  // Liens matière <-> (école, niveau)
  getSubjectLinks(subjectId: string) {
    return this.subjectService.getSubjectLinks(subjectId);
  }
  addSubjectLink(link: { subject_id: string; school_id: string; school_level: string; required?: boolean }) {
    return this.subjectService.addSubjectLink(link);
  }
  deleteSubjectLink(linkId: string) {
    return this.subjectService.deleteSubjectLink(linkId);
  }

  countStudentsBySubject(
    subjectId: string,
    schoolId: string | null,
    schoolLevel: string | null,
    teacherId?: string | null
  ): Observable<{ count: number; error: PostgrestError | null }> {
    return this.subjectService.countStudentsBySubject(subjectId, schoolId, schoolLevel, teacherId);
  }

  getChildrenBySubject(
    subjectId: string,
    schoolId: string | null = null,
    schoolLevel: string | null = null,
    teacherId?: string | null
  ): Observable<{ children: Child[]; error: PostgrestError | null }> {
    return this.subjectService.getChildrenBySubject(subjectId, schoolId, schoolLevel, teacherId);
  }

  createSubject(subjectData: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Observable<{ subject: Subject | null; error: PostgrestError | null }> {
    return this.subjectService.createSubject(subjectData);
  }

  updateSubject(id: string, updates: Partial<Omit<Subject, 'id' | 'created_at' | 'updated_at'>>): Observable<{ subject: Subject | null; error: PostgrestError | null }> {
    return this.subjectService.updateSubject(id, updates);
  }

  // ===== Domaine Sous-catégories de matières =====
  getCategoriesBySubject(subjectId: string): Observable<{ categories: SubjectCategory[]; error: PostgrestError | null }> {
    return this.subjectCategoryService.getCategoriesBySubject(subjectId);
  }

  createCategory(categoryData: SubjectCategoryCreate): Observable<{ category: SubjectCategory | null; error: PostgrestError | null }> {
    return this.subjectCategoryService.createCategory(categoryData);
  }

  updateCategory(id: string, updates: SubjectCategoryUpdate): Observable<{ category: SubjectCategory | null; error: PostgrestError | null }> {
    return this.subjectCategoryService.updateCategory(id, updates);
  }

  deleteCategory(id: string): Observable<{ error: PostgrestError | null }> {
    return this.subjectCategoryService.deleteCategory(id);
  }

  transferCategory(categoryId: string, newSubjectId: string): Observable<{ category: SubjectCategory | null; error: PostgrestError | null }> {
    return this.subjectCategoryService.transferCategory(categoryId, newSubjectId);
  }

  getChildrenByCategory(
    categoryId: string,
    schoolId: string | null = null,
    schoolLevel: string | null = null,
    teacherId?: string | null
  ): Observable<{ children: Child[]; error: PostgrestError | null }> {
    return this.subjectCategoryService.getChildrenByCategory(categoryId, schoolId, schoolLevel, teacherId);
  }

  countChildrenByCategory(
    categoryId: string,
    schoolId: string | null = null,
    schoolLevel: string | null = null,
    teacherId?: string | null
  ): Observable<{ count: number; error: PostgrestError | null }> {
    return this.subjectCategoryService.countChildrenByCategory(categoryId, schoolId, schoolLevel, teacherId);
  }

  getTeacherAssignments(teacherId: string): Observable<{ assignments: TeacherAssignment[]; error: PostgrestError | null }> {
    return this.teacherAssignmentService.getTeacherAssignments(teacherId);
  }

  createAssignment(assignmentData: TeacherAssignmentCreate): Observable<{ 
    assignment: TeacherAssignment | null; 
    error: PostgrestError | null;
    requiresConfirmation?: {
      conflictingAssignments: Array<{ id: string; school_level: string }>;
      message: string;
      assignmentData: TeacherAssignmentCreate;
    };
  }> {
    return this.teacherAssignmentService.createAssignment(assignmentData);
  }

  createAssignmentWithConfirmation(
    assignmentData: TeacherAssignmentCreate,
    conflictingAssignmentIds: string[]
  ): Observable<{ assignment: TeacherAssignment | null; error: PostgrestError | null }> {
    return this.teacherAssignmentService.createAssignmentWithConfirmation(assignmentData, conflictingAssignmentIds);
  }

  updateAssignment(id: string, updates: TeacherAssignmentUpdate): Observable<{ assignment: TeacherAssignment | null; error: PostgrestError | null }> {
    return this.teacherAssignmentService.updateAssignment(id, updates);
  }

  deleteAssignment(id: string): Observable<{ error: PostgrestError | null }> {
    return this.teacherAssignmentService.deleteAssignment(id);
  }

  validateShareOrTransfer(
    assignmentId: string,
    newTeacherId: string,
    mode: 'transfer' | 'share'
  ): Observable<{
    canProceed: boolean;
    reason?: string;
    existingAssignment?: TeacherAssignment;
    sourceAssignment?: TeacherAssignment;
  }> {
    return this.teacherAssignmentService.validateShareOrTransfer(assignmentId, newTeacherId, mode);
  }

  transferAssignment(assignmentId: string, newTeacherId: string): Observable<{ assignment: TeacherAssignment | null; error: PostgrestError | null }> {
    return this.teacherAssignmentService.transferAssignment(assignmentId, newTeacherId);
  }

  shareAssignment(assignmentId: string, newTeacherId: string): Observable<{ assignment: TeacherAssignment | null; error: PostgrestError | null }> {
    return this.teacherAssignmentService.shareAssignment(assignmentId, newTeacherId);
  }

  getSharedAssignments(assignmentId: string): Observable<{ 
    sharedAssignments: { 
      assignment: TeacherAssignment; 
      teacher: { id: string; fullname: string | null } 
    }[]; 
    error: PostgrestError | null 
  }> {
    return this.teacherAssignmentService.getSharedAssignments(assignmentId);
  }

  /**
   * Récupère tous les professeurs qui enseignent une matière donnée
   * @param subjectId ID de la matière
   * @param excludeTeacherId ID du professeur à exclure (optionnel)
   * @returns Observable avec la liste des professeurs
   */
  getTeachersForSubject(
    subjectId: string,
    excludeTeacherId?: string | null
  ): Observable<{ teachers: { id: string; fullname: string | null }[]; error: PostgrestError | null }> {
    return from(
      this.supabaseService.client
        .from('teacher_assignments')
        .select('teacher_id')
        .eq('subject_id', subjectId)
        .is('deleted_at', null)
    ).pipe(
      switchMap(({ data: assignments, error: assignmentsError }) => {
        if (assignmentsError) {
          return of({ teachers: [], error: assignmentsError as PostgrestError });
        }

        const assignmentRows = (assignments as Array<{ teacher_id: string }> | null) || [];
        const teacherIds = [...new Set(assignmentRows.map(a => a.teacher_id).filter(Boolean))];
        
        // Exclure le professeur actuel si spécifié
        const filteredTeacherIds = excludeTeacherId 
          ? teacherIds.filter(id => id !== excludeTeacherId)
          : teacherIds;

        if (filteredTeacherIds.length === 0) {
          return of({ teachers: [], error: null });
        }

        // Récupérer les informations des professeurs
        return from(
          this.supabaseService.client
            .from('teachers')
            .select('id, fullname')
            .in('id', filteredTeacherIds)
        ).pipe(
          map(({ data: teachers, error: teachersError }) => {
            if (teachersError) {
              return { teachers: [], error: teachersError as PostgrestError };
            }

            const teachersList = ((teachers || []) as Array<{ id: string; fullname: string | null }>).map(t => ({
              id: t.id,
              fullname: t.fullname || null
            }));

            return { teachers: teachersList, error: null };
          })
        );
      })
    );
  }

  // ===== Domaine Jeux =====
  getGameTypes(): Observable<{ gameTypes: GameType[]; error: PostgrestError | null }> {
    return this.gameTypeService.getGameTypes();
  }

  getGamesBySubject(subjectId: string, subjectCategoryId?: string): Observable<{ games: Game[]; error: PostgrestError | null }> {
    return this.gameService.getGamesBySubject(subjectId, subjectCategoryId);
  }

  createGame(gameData: GameCreate): Observable<{ game: Game | null; error: PostgrestError | null }> {
    return this.gameService.createGame(gameData);
  }

  updateGame(id: string, updates: GameUpdate): Observable<{ game: Game | null; error: PostgrestError | null }> {
    return this.gameService.updateGame(id, updates);
  }

  deleteGame(id: string): Observable<{ error: PostgrestError | null }> {
    return this.gameService.deleteGame(id);
  }

  getGamesStatsBySubject(subjectId: string, subjectCategoryId?: string, skipAssignmentCheck?: boolean): Observable<{ 
    stats: Record<string, number>; 
    total: number;
    error: PostgrestError | null 
  }> {
    // Si on a une catégorie mais pas de subjectId, on peut utiliser un subjectId vide
    // Le GameService gère ce cas
    return this.gameService.getGamesStatsBySubject(subjectId || '', subjectCategoryId, skipAssignmentCheck || false);
  }

  getGamesStatsBySubjectsBatch(subjectIds: string[], skipAssignmentCheck?: boolean): Observable<{ 
    statsBySubject: Map<string, { stats: Record<string, number>, total: number }>;
    error: PostgrestError | null 
  }> {
    return this.gameService.getGamesStatsBySubjectsBatch(subjectIds, skipAssignmentCheck || false);
  }

  getGamesStatsByCategory(categoryId: string): Observable<{ 
    stats: Record<string, number>; 
    total: number;
    error: PostgrestError | null 
  }> {
    // Utiliser getGamesStatsBySubject avec categoryId (subjectId peut être vide)
    return this.gameService.getGamesStatsBySubject('', categoryId, false);
  }

  getGamesStatsByCategoriesBatch(categoryIds: string[]): Observable<{ 
    statsByCategory: Map<string, { stats: Record<string, number>, total: number }>;
    error: PostgrestError | null 
  }> {
    return this.gameService.getGamesStatsByCategoriesBatch(categoryIds);
  }

  // ===== Génération IA =====
  generateSingleGameWithAI(
    request: AIGameGenerationRequest
  ): Observable<{ game?: GameCreate; rawResponse?: AIRawResponse; userPrompt?: string; error?: PostgrestError | null }> {
    return this.getGameTypes().pipe(
      switchMap((gameTypes) => {
        if (gameTypes.error) {
          return of({ error: gameTypes.error });
        }

        // Si un PDF est fourni, extraire le texte
        const pdfPromise = request.pdfFile 
          ? this.aiGameGeneratorService.extractTextFromPDF(request.pdfFile)
          : Promise.resolve(undefined);

        return from(pdfPromise).pipe(
          switchMap((pdfText) => {
            return this.aiGameGeneratorService.generateSingleGame(
              request,
              gameTypes.gameTypes,
              pdfText
            );
          }),
          map((result) => ({ game: result.game, rawResponse: result.rawResponse, userPrompt: result.userPrompt })),
          catchError((error) => {
            console.error('[Infrastructure] Erreur génération IA:', error);
            return of({ 
              error: { 
                name: 'AIGenerationError',
                message: error.message || 'Erreur lors de la génération du jeu',
                details: error.toString(),
                hint: null,
                code: 'AI_ERROR'
              } as unknown as PostgrestError
            });
          })
        );
      })
    );
  }

  generateGamesWithAI(request: AIGameGenerationRequest): Observable<{ games?: GameCreate[]; error?: PostgrestError | null }> {
    return this.getGameTypes().pipe(
      switchMap((gameTypesResult) => {
        if (gameTypesResult.error) {
          return of({ error: gameTypesResult.error });
        }

        // Si un PDF est fourni, extraire le texte
        const pdfPromise = request.pdfFile 
          ? this.aiGameGeneratorService.extractTextFromPDF(request.pdfFile)
          : Promise.resolve(undefined);

        return from(pdfPromise).pipe(
          switchMap((pdfText) => {
            return this.aiGameGeneratorService.generateGames(
              request,
              gameTypesResult.gameTypes,
              pdfText
            );
          }),
          map((games) => ({ games })),
          catchError((error) => {
            console.error('[Infrastructure] Erreur génération IA:', error);
            return of({ 
              error: { 
                name: 'AIGenerationError',
                message: error.message || 'Erreur lors de la génération des jeux',
                details: error.toString(),
                hint: null,
                code: 'AI_ERROR'
              } as unknown as PostgrestError
            });
          })
        );
      })
    );
  }
}

