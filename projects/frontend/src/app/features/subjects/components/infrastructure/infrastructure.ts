import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { CacheService } from '../../../../core/services/cache/cache.service';
import { Subject, SubjectCategory } from '../../types/subject.types';
import { SubjectCategoryProgress, Game } from '../../../../core/types/game.types';

@Injectable({
  providedIn: 'root',
})
export class SubjectsInfrastructure {
  private readonly supabase = inject(SupabaseService);
  private readonly cache = inject(CacheService);

  async loadSubjects(childId: string | null = null): Promise<Subject[]> {
    if (!childId) {
      // Si pas de childId, retourner tous les sujets (comportement par défaut)
      const cacheKey = 'subjects:all';
      const cached = this.cache.get<Subject[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const { data, error } = await this.supabase.client
        .from('subjects')
        .select('*')
        .order('name');

      if (error) throw error;
      const subjects = data || [];
      this.cache.set(cacheKey, subjects, 10 * 60 * 1000); // Cache 10 minutes
      return subjects;
    }

    // Filtrer les sujets par childId via la table child_subject_enrollments (comme l'admin)
    // L'admin utilise child_subject_enrollments avec selected=true pour déterminer les matières activées
    const cacheKey = `subjects:child:${childId}`;
    const cached = this.cache.get<Subject[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Récupérer les enrollments où selected = true (comme l'admin)
    const { data: enrollments, error: enrollmentsError } = await this.supabase.client
      .from('child_subject_enrollments')
      .select('subject_id')
      .eq('child_id', childId)
      .eq('selected', true);

    if (enrollmentsError) throw enrollmentsError;

    if (!enrollments || enrollments.length === 0) {
      return [];
    }

    // Extraire les IDs de sujets
    const subjectIds = enrollments
      .map((e: { subject_id: string }) => e.subject_id)
      .filter((id: string | undefined): id is string => id !== undefined);

    if (subjectIds.length === 0) {
      return [];
    }

    // Récupérer les sujets correspondants
    const { data, error } = await this.supabase.client
      .from('subjects')
      .select('*')
      .in('id', subjectIds)
      .order('name');

    if (error) throw error;
    const subjects = data || [];
    this.cache.set(cacheKey, subjects, 10 * 60 * 1000); // Cache 10 minutes
    return subjects;
  }

  async loadSubjectCategories(subjectId: string): Promise<SubjectCategory[]> {
    const { data, error } = await this.supabase.client
      .from('subject_categories')
      .select('*')
      .eq('subject_id', subjectId)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async loadChildProgress(childId: string, categoryIds: string[]): Promise<SubjectCategoryProgress[]> {
    if (categoryIds.length === 0) return [];

    const { data, error } = await this.supabase.client
      .from('frontend_subject_category_progress')
      .select('*')
      .eq('child_id', childId)
      .in('subject_category_id', categoryIds);

    if (error) throw error;
    return data || [];
  }

  async loadSubjectWithCategories(subjectId: string): Promise<SubjectCategory[]> {
    return this.loadSubjectCategories(subjectId);
  }

  async loadGamesByCategory(categoryId: string): Promise<Game[]> {
    const { data, error } = await this.supabase.client
      .from('games')
      .select('*')
      .eq('subject_category_id', categoryId)
      .order('name');

    if (error) throw error;
    return data || [];
  }
}

