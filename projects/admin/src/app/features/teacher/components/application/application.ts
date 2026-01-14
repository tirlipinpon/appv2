import { Injectable, inject } from '@angular/core';
import { TeacherStore } from '../../store/index';
import { TeacherAssignmentStore } from '../../store/assignments.store';
import type { Teacher, TeacherUpdate } from '../../types/teacher';
import type { School } from '../../types/school';
import type { Subject } from '../../types/subject';
import type { TeacherAssignmentCreate, TeacherAssignmentUpdate } from '../../types/teacher-assignment';

@Injectable({
  providedIn: 'root',
})
export class Application {
  private readonly store = inject(TeacherStore);
  private readonly assignmentStore = inject(TeacherAssignmentStore);

  loadTeacherProfile(): void {
    this.store.loadTeacherProfile();
  }

  updateTeacherProfile(updates: Partial<TeacherUpdate>): void {
    this.store.updateTeacherProfile(updates as TeacherUpdate);
  }

  createTeacherProfile(profileData: Omit<Teacher, 'id' | 'profile_id' | 'created_at' | 'updated_at'>): void {
    this.store.createTeacherProfile(profileData);
  }

  // Assignments API
  loadSchools(): void {
    this.assignmentStore.loadSchools();
  }
  createSchool(schoolData: Omit<School, 'id' | 'created_at' | 'updated_at'>): void {
    this.assignmentStore.createSchool(schoolData);
  }
  loadSchoolYears(schoolId: string): void {
    this.assignmentStore.loadSchoolYears(schoolId);
  }
  createSchoolYear(schoolYearData: { school_id: string; label: string; order_index?: number | null; is_active?: boolean }): void {
    this.assignmentStore.createSchoolYear(schoolYearData);
  }
  loadSubjects(): void {
    this.assignmentStore.loadSubjects();
  }
  loadSubjectsForSchoolLevel(schoolId: string, schoolLevel: string): void {
    this.assignmentStore.loadSubjectsForSchoolLevel({ schoolId, schoolLevel });
  }
  createSubject(subjectData: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): void {
    this.assignmentStore.createSubject(subjectData);
  }
  loadAssignments(teacherId: string): void {
    this.assignmentStore.loadAssignments(teacherId);
  }
  createAssignment(assignmentData: TeacherAssignmentCreate): void {
    this.assignmentStore.createAssignment(assignmentData);
  }
  updateAssignment(assignmentId: string, updates: TeacherAssignmentUpdate): void {
    this.assignmentStore.updateAssignment({ id: assignmentId, updates });
  }
  deleteAssignment(assignmentId: string): void {
    this.assignmentStore.deleteAssignment(assignmentId);
  }
}

