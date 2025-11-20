import { Injectable } from '@angular/core';
import { BaseRepository } from '../../../shared/repositories/base-repository.service';
import type { Teacher } from '../types/teacher';

/**
 * Repository pour la gestion des enseignants
 * Principe SRP : Gère uniquement l'accès aux données enseignants
 */
@Injectable({
  providedIn: 'root',
})
export class TeacherRepository extends BaseRepository<Teacher> {
  protected readonly tableName = 'teachers';
  protected readonly cacheKey = 'teacher-profile';
}
