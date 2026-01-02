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

  /**
   * Récupère les scores des jeux pour un enfant donné
   * Retourne une Map<gameId, score> avec le meilleur score pour chaque jeu
   */
  async getGameScores(childId: string, gameIds: string[]): Promise<Map<string, number>> {
    if (gameIds.length === 0) return new Map();

    const { data, error } = await this.supabase.client
      .from('frontend_game_attempts')
      .select('game_id, score')
      .eq('child_id', childId)
      .in('game_id', gameIds);

    if (error) throw error;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'infrastructure.ts:116',message:'getGameScores retrieved',data:{childId,gameIdsCount:gameIds.length,dataCount:data?.length,rawData:data?.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // Créer une Map avec le meilleur score pour chaque jeu
    const scoresMap = new Map<string, number>();
    if (data) {
      for (const attempt of data) {
        const currentScore = scoresMap.get(attempt.game_id) || 0;
        if (attempt.score > currentScore) {
          scoresMap.set(attempt.game_id, attempt.score);
        }
      }
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'infrastructure.ts:130',message:'getGameScores result map',data:{scoresMapSize:scoresMap.size,scoresMapEntries:Array.from(scoresMap.entries()).slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    return scoresMap;
  }

  /**
   * Mélange aléatoirement un tableau en utilisant l'algorithme de Fisher-Yates
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Normalise un jeu depuis la structure de la base de données vers l'interface Game
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeGame(game: any): Game {
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
    } else if (gameTypeName === 'simon') {
      // Simon : convertir depuis metadata
      if (game.metadata) {
        gameDataJson = {
          nombre_elements: game.metadata.nombre_elements || 4,
          type_elements: game.metadata.type_elements || 'couleurs',
          elements: game.metadata.elements || []
        };
      } else if (game.reponses) {
        gameDataJson = game.reponses;
      } else if (game.game_data_json) {
        gameDataJson = game.game_data_json;
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
  }

  async loadGamesByCategory(categoryId: string, childId?: string): Promise<Game[]> {
    const { data, error } = await this.supabase.client
      .from('games')
      .select(`
        *,
        game_types!inner(name)
      `)
      .eq('subject_category_id', categoryId);

    if (error) throw error;
    if (!data) return [];
    
    // Normaliser les jeux
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const games = data.map((game: any) => this.normalizeGame(game));
    
    // Mélanger aléatoirement les jeux (on affiche tous les jeux maintenant)
    return this.shuffleArray(games);
  }

  async loadGamesBySubject(subjectId: string, childId?: string): Promise<Game[]> {
    const { data, error } = await this.supabase.client
      .from('games')
      .select(`
        *,
        game_types!inner(name)
      `)
      .eq('subject_id', subjectId)
      .is('subject_category_id', null);

    if (error) throw error;
    if (!data) return [];
    
    // Normaliser les jeux
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const games = data.map((game: any) => this.normalizeGame(game));
    
    // Mélanger aléatoirement les jeux (on affiche tous les jeux maintenant)
    return this.shuffleArray(games);
  }
}

