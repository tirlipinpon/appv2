import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TeacherService } from '../../services/teacher/teacher.service';
import { SchoolService } from '../../services/school/school.service';
import { SchoolYearService } from '../../services/school-year/school-year.service';
import { SubjectService } from '../../services/subject/subject.service';
import { TeacherAssignmentService } from '../../services/teacher-assignment/teacher-assignment.service';
import type { Teacher, TeacherUpdate } from '../../types/teacher';
import type { School } from '../../types/school';
import type { Subject } from '../../types/subject';
import type { TeacherAssignment, TeacherAssignmentCreate } from '../../types/teacher-assignment';
import type { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class Infrastructure {
  private readonly teacherService = inject(TeacherService);
  private readonly schoolService = inject(SchoolService);
  private readonly schoolYearService = inject(SchoolYearService);
  private readonly subjectService = inject(SubjectService);
  private readonly teacherAssignmentService = inject(TeacherAssignmentService);

  getTeacherProfile(): Observable<Teacher | null> {
    return this.teacherService.getTeacherProfile();
  }

  updateTeacherProfile(updates: TeacherUpdate): Observable<{ teacher: Teacher | null; error: PostgrestError | null }> {
    return this.teacherService.updateTeacherProfile(updates);
  }

  createTeacherProfile(profileData: Omit<Teacher, 'id' | 'profile_id' | 'created_at' | 'updated_at'>): Observable<{ teacher: Teacher | null; error: PostgrestError | null }> {
    return this.teacherService.createTeacherProfile(profileData);
  }

  // ===== Domaine Affectations (Teacher) =====
  getSchools(): Observable<{ schools: School[]; error: PostgrestError | null }> {
    return this.schoolService.getSchools();
  }

  createSchool(schoolData: Omit<School, 'id' | 'created_at' | 'updated_at'>): Observable<{ school: School | null; error: PostgrestError | null }> {
    return this.schoolService.createSchool(schoolData);
  }

  getSchoolYearsBySchool(schoolId: string): Observable<{ schoolYears: any[]; error: PostgrestError | null }> {
    return this.schoolYearService.getSchoolYearsBySchool(schoolId);
  }

  createSchoolYear(schoolYearData: Omit<any, 'id' | 'created_at' | 'updated_at'>): Observable<{ schoolYear: any; error: PostgrestError | null }> {
    return this.schoolYearService.createSchoolYear(schoolYearData);
  }

  getSubjects(): Observable<{ subjects: Subject[]; error: PostgrestError | null }> {
    return this.subjectService.getSubjects();
  }

  createSubject(subjectData: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Observable<{ subject: Subject | null; error: PostgrestError | null }> {
    return this.subjectService.createSubject(subjectData);
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
}

