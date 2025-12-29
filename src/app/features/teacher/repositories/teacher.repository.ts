import { Injectable, inject } from '@angular/core';
import { BaseRepository } from '../../../shared/repositories/base-repository.service';
import { SupabaseService } from '../../../shared/services/supabase/supabase.service';
import { AuthCoreService } from '../../../core/auth/core/auth-core.service';
import { CacheService } from '../../../shared/services/cache/cache.service';
import { LoggerService } from '../../../shared/services/logging/logger.service';
import type { Teacher } from '../types/teacher';

/**
 * Repository pour la gestion des enseignants
 * Principe SRP : Gère uniquement l'accès aux données enseignants
 */
@Injectable({
  providedIn: 'root',
})
export class TeacherRepository extends BaseRepository<Teacher> {
  constructor() {
    super('teachers', 'teacher-profile', {
      supabaseService: inject(SupabaseService),
      authCoreService: inject(AuthCoreService),
      cacheService: inject(CacheService),
      logger: inject(LoggerService),
    });
  }
}
