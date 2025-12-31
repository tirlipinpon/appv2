import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { Game, GameAttempt } from '../../../../core/types/game.types';

@Injectable({
  providedIn: 'root',
})
export class GameInfrastructure {
  private readonly supabase = inject(SupabaseService);

  async loadGame(gameId: string): Promise<Game | null> {
    const { data, error } = await this.supabase.client
      .from('games')
      .select(`
        *,
        game_types!inner(name)
      `)
      .eq('id', gameId)
      .single();

    if (error) throw error;
    
    if (!data) return null;
    
    // Normaliser les données : convertir la structure ancienne en nouvelle si nécessaire
    const game = data as any;
    const gameTypeName = (game.game_types?.name || '').toLowerCase().replace(/\s+/g, '_');
    
    // La table games n'a pas de colonne game_data_json, donc on doit toujours convertir
    // depuis metadata, question, reponses, aides
    let gameDataJson: Record<string, unknown> = {};
    
    // Convertir selon le type de jeu
    if (gameTypeName === 'reponse_libre') {
      gameDataJson = {
        reponse_valide: game.metadata?.reponse_valide || ''
      };
    } else if (gameTypeName === 'memory') {
      // Memory : convertir metadata.paires en game_data_json.paires
      if (game.metadata?.paires && Array.isArray(game.metadata.paires)) {
        gameDataJson = {
          paires: game.metadata.paires.map((paire: any) => ({
            question: paire.question || '',
            reponse: paire.reponse || ''
          }))
        };
      }
    } else if (gameTypeName === 'qcm') {
      // QCM : convertir depuis metadata ou reponses
      if (game.metadata?.propositions || game.reponses?.propositions) {
        gameDataJson = {
          propositions: game.metadata?.propositions || game.reponses?.propositions || [],
          reponses_valides: game.metadata?.reponses_valides || game.reponses?.reponses_valides || (game.reponses?.reponse_valide ? [game.reponses.reponse_valide] : [])
        };
      } else if (game.reponses) {
        gameDataJson = game.reponses;
      }
    } else if (gameTypeName === 'chronologie' || gameTypeName === 'chronologie') {
      // Chronologie : convertir depuis metadata
      if (game.metadata?.mots || game.metadata?.ordre_correct) {
        gameDataJson = {
          mots: game.metadata.mots || [],
          ordre_correct: game.metadata.ordre_correct || []
        };
      } else if (game.reponses) {
        gameDataJson = game.reponses;
      }
    } else if (gameTypeName === 'vrai_faux' || gameTypeName === 'vrai/faux') {
      // Vrai/Faux : convertir depuis metadata.enonces
      if (game.metadata?.enonces && Array.isArray(game.metadata.enonces)) {
        gameDataJson = {
          enonces: game.metadata.enonces.map((enonce: any) => ({
            texte: enonce.texte || '',
            reponse_correcte: enonce.reponse_correcte ?? false
          }))
        };
      } else if (game.reponses) {
        gameDataJson = game.reponses;
      }
    } else if (gameTypeName === 'liens') {
      // Liens : convertir depuis metadata
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
      // Case vide : convertir depuis metadata
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
      // Pour les autres types, utiliser reponses si disponible
      gameDataJson = game.reponses;
    } else if (game.game_data_json) {
      // Si game_data_json existe (pour les nouveaux jeux), l'utiliser
      gameDataJson = game.game_data_json;
    }
    
    // Retourner le jeu normalisé
    return {
      ...game,
      game_type: gameTypeName || game.game_type || 'generic',
      game_data_json: gameDataJson,
      // Garder les anciens champs pour compatibilité
      question: game.question,
      reponses: game.reponses,
      aides: game.aides,
      metadata: game.metadata
    } as Game;
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

  async saveGameAttempt(attempt: Partial<GameAttempt>): Promise<GameAttempt> {
    const { data, error } = await this.supabase.client
      .from('frontend_game_attempts')
      .insert(attempt)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

