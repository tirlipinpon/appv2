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
      .select(`
        *,
        game_types!inner(name)
      `)
      .eq('subject_category_id', categoryId)
      .order('name');

    if (error) throw error;
    if (!data) return [];
    
    // Normaliser les jeux comme dans GameInfrastructure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((game: any) => {
      const gameTypeName = (game.game_types?.name || '').toLowerCase().replace(/\s+/g, '_');
      
      // Convertir depuis metadata vers game_data_json
      let gameDataJson: Record<string, unknown> = {};
      
      if (gameTypeName === 'reponse_libre') {
        gameDataJson = {
          reponse_valide: game.metadata?.reponse_valide || ''
        };
      } else if (gameTypeName === 'memory') {
        if (game.metadata?.paires && Array.isArray(game.metadata.paires)) {
          gameDataJson = {
            paires: game.metadata.paires.map((paire: { question?: string; reponse?: string }) => ({
              question: paire.question || '',
              reponse: paire.reponse || ''
            }))
          };
        }
      } else if (gameTypeName === 'qcm') {
        if (game.metadata?.propositions || game.reponses?.propositions) {
          gameDataJson = {
            propositions: game.metadata?.propositions || game.reponses?.propositions || [],
            reponses_valides: game.metadata?.reponses_valides || game.reponses?.reponses_valides || (game.reponses?.reponse_valide ? [game.reponses.reponse_valide] : [])
          };
        } else if (game.reponses) {
          gameDataJson = game.reponses;
        }
      } else if (gameTypeName === 'chronologie') {
        if (game.metadata?.mots || game.metadata?.ordre_correct) {
          gameDataJson = {
            mots: game.metadata.mots || [],
            ordre_correct: game.metadata.ordre_correct || []
          };
        } else if (game.reponses) {
          gameDataJson = game.reponses;
        }
      } else if (gameTypeName === 'vrai_faux' || gameTypeName === 'vrai/faux') {
        if (game.metadata?.enonces && Array.isArray(game.metadata.enonces)) {
          gameDataJson = {
            enonces: game.metadata.enonces.map((enonce: { texte?: string; reponse_correcte?: boolean }) => ({
              texte: enonce.texte || '',
              reponse_correcte: enonce.reponse_correcte ?? false
            }))
          };
        } else if (game.reponses) {
          gameDataJson = game.reponses;
        }
      } else if (gameTypeName === 'liens') {
        if (game.metadata?.mots || game.metadata?.reponses || game.metadata?.liens) {
          gameDataJson = {
            mots: game.metadata.mots || [],
            reponses: game.metadata.reponses || [],
            liens: game.metadata.liens || []
          };
        } else if (game.reponses) {
          gameDataJson = game.reponses;
        }
      } else if (gameTypeName === 'case_vide' || gameTypeName === 'case vide') {
        if (game.metadata) {
          gameDataJson = {
            texte: game.metadata.texte || '',
            cases_vides: game.metadata.cases_vides || [],
            banque_mots: game.metadata.banque_mots || [],
            mots_leurres: game.metadata.mots_leurres || []
          };
        } else if (game.reponses) {
          gameDataJson = game.reponses;
        }
      } else if (game.reponses) {
        gameDataJson = game.reponses;
      } else if (game.game_data_json) {
        gameDataJson = game.game_data_json;
      }
      
      return {
        ...game,
        game_type: gameTypeName || game.game_type || 'generic',
        game_data_json: gameDataJson,
        question: game.question,
        reponses: game.reponses,
        aides: game.aides,
        metadata: game.metadata
      } as Game;
    });
  }
}

