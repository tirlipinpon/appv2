import { Injectable, inject } from '@angular/core';
import { TeacherAssignmentStore } from '../../store/index';
import type { School } from '../../types/school';
import type { Subject } from '../../types/subject';
import type { TeacherAssignmentCreate } from '../../types/teacher-assignment';

@Injectable({
  providedIn: 'root',
})
export class Application {
  private readonly store = inject(TeacherAssignmentStore);

  loadSchools(): void {
    this.store.loadSchools();
  }

  createSchool(schoolData: Omit<School, 'id' | 'created_at' | 'updated_at'>): void {
    this.store.createSchool(schoolData);
  }

  loadSchoolYears(schoolId: string): void {
    this.store.loadSchoolYears(schoolId);
  }

  createSchoolYear(schoolYearData: any): void {
    this.store.createSchoolYear(schoolYearData);
  }

  loadSubjects(): void {
    this.store.loadSubjects();
  }

  createSubject(subjectData: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): void {
    this.store.createSubject(subjectData);
  }

  loadAssignments(teacherId: string): void {
    this.store.loadAssignments(teacherId);
  }

  createAssignment(assignmentData: TeacherAssignmentCreate): void {
    this.store.createAssignment(assignmentData);
  }

  deleteAssignment(assignmentId: string): void {
    this.store.deleteAssignment(assignmentId);
  }
}


