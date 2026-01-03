import { Injectable } from '@angular/core';
import type { TeacherAssignment } from '../../types/teacher-assignment';
import type { Subject } from '../../types/subject';
import { SCHOOL_LEVELS } from '../../utils/school-levels.util';

@Injectable({
  providedIn: 'root',
})
export class AssignmentFilterService {
  /**
   * Obtient les niveaux disponibles selon l'école sélectionnée
   * @param assignments Liste des affectations du professeur
   * @param schoolId ID de l'école
   * @returns Liste des niveaux triés selon l'ordre de SCHOOL_LEVELS
   */
  getAvailableLevelsForSchool(
    assignments: TeacherAssignment[],
    schoolId: string | null
  ): string[] {
    if (!schoolId) return [];

    const filtered = assignments.filter(
      (a) => a.school_id === schoolId && a.school_level
    );
    const levels = new Set(filtered.map((a) => a.school_level!));

    // Trier selon l'ordre de SCHOOL_LEVELS
    return Array.from(levels).sort((a, b) => {
      const indexA = SCHOOL_LEVELS.findIndex((l) => l.value === a);
      const indexB = SCHOOL_LEVELS.findIndex((l) => l.value === b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }

  /**
   * Obtient les matières disponibles selon l'école et le niveau
   * @param assignments Liste des affectations du professeur
   * @param subjects Liste de toutes les matières
   * @param schoolId ID de l'école
   * @param level Niveau scolaire
   * @returns Liste des matières triées par nom
   */
  getAvailableSubjectsForSchoolAndLevel(
    assignments: TeacherAssignment[],
    subjects: Subject[],
    schoolId: string | null,
    level: string | null
  ): Subject[] {
    if (!schoolId || !level) return [];

    const filtered = assignments.filter(
      (a) => a.school_id === schoolId && a.school_level === level
    );
    const subjectIds = new Set(filtered.map((a) => a.subject_id));

    return subjects
      .filter((subject) => subjectIds.has(subject.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Version computed-friendly qui retourne directement les niveaux depuis les assignments
   * Utile pour les computed signals
   */
  getAvailableLevels(
    assignments: TeacherAssignment[],
    schoolId: string | null
  ): string[] {
    return this.getAvailableLevelsForSchool(assignments, schoolId);
  }

  /**
   * Version computed-friendly qui retourne directement les matières depuis les assignments et subjects
   * Utile pour les computed signals
   */
  getAvailableSubjects(
    assignments: TeacherAssignment[],
    subjects: Subject[],
    schoolId: string | null,
    level: string | null
  ): Subject[] {
    return this.getAvailableSubjectsForSchoolAndLevel(
      assignments,
      subjects,
      schoolId,
      level
    );
  }
}
