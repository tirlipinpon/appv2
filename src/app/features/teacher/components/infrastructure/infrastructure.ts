import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap, map, catchError, of, forkJoin } from 'rxjs';
import { TeacherService } from '../../services/teacher/teacher.service';
import { SchoolService } from '../../services/school/school.service';
import { SchoolYearService } from '../../services/school-year/school-year.service';
import { SubjectService } from '../../services/subject/subject.service';
import { TeacherAssignmentService } from '../../services/teacher-assignment/teacher-assignment.service';
import { GameTypeService } from '../../services/game-type/game-type.service';
import { GameService } from '../../services/game/game.service';
import { AIGameGeneratorService } from '../../services/ai-game-generator/ai-game-generator.service';
import type { Teacher, TeacherUpdate } from '../../types/teacher';
import type { School } from '../../types/school';
import type { Subject } from '../../types/subject';
import type { TeacherAssignment, TeacherAssignmentCreate } from '../../types/teacher-assignment';
import type { GameType } from '../../types/game-type';
import type { Game, GameCreate, GameUpdate } from '../../types/game';
import type { PostgrestError } from '@supabase/supabase-js';
import type { SchoolYear } from '../../types/school';
import type { AIGameGenerationRequest, AIRawResponse } from '../../types/ai-game-generation';

@Injectable({
  providedIn: 'root',
})
export class Infrastructure {
  private readonly teacherService = inject(TeacherService);
  private readonly schoolService = inject(SchoolService);
  private readonly schoolYearService = inject(SchoolYearService);
  private readonly subjectService = inject(SubjectService);
  private readonly teacherAssignmentService = inject(TeacherAssignmentService);
  private readonly gameTypeService = inject(GameTypeService);
  private readonly gameService = inject(GameService);
  private readonly aiGameGeneratorService = inject(AIGameGeneratorService);

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
    schoolLevel: string | null
  ): Observable<{ count: number; error: PostgrestError | null }> {
    return this.subjectService.countStudentsBySubject(subjectId, schoolId, schoolLevel);
  }

  createSubject(subjectData: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Observable<{ subject: Subject | null; error: PostgrestError | null }> {
    return this.subjectService.createSubject(subjectData);
  }

  updateSubject(id: string, updates: Partial<Omit<Subject, 'id' | 'created_at' | 'updated_at'>>): Observable<{ subject: Subject | null; error: PostgrestError | null }> {
    return this.subjectService.updateSubject(id, updates);
  }

  getTeacherAssignments(teacherId: string): Observable<{ assignments: TeacherAssignment[]; error: PostgrestError | null }> {
    return this.teacherAssignmentService.getTeacherAssignments(teacherId);
  }

  createAssignment(assignmentData: TeacherAssignmentCreate): Observable<{ assignment: TeacherAssignment | null; error: PostgrestError | null }> {
    return this.teacherAssignmentService.createAssignment(assignmentData);
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

  // ===== Domaine Jeux =====
  getGameTypes(): Observable<{ gameTypes: GameType[]; error: PostgrestError | null }> {
    return this.gameTypeService.getGameTypes();
  }

  getGamesBySubject(subjectId: string): Observable<{ games: Game[]; error: PostgrestError | null }> {
    return this.gameService.getGamesBySubject(subjectId);
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

  getGamesStatsBySubject(subjectId: string): Observable<{ 
    stats: Record<string, number>; 
    total: number;
    error: PostgrestError | null 
  }> {
    return this.gameService.getGamesStatsBySubject(subjectId);
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

