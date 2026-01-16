import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GlobalWord, ChildWord, FormattedWord } from '../../types/word.types';
import { ENVIRONMENT, type Environment } from '@shared/tokens/environment.token';

@Injectable({
  providedIn: 'root',
})
export class WordService {
  // Injection directe du token ENVIRONMENT (fourni dans app.config.ts)
  private readonly environment = inject<Environment | null>(ENVIRONMENT, { optional: true });
  
  private _client: SupabaseClient | null = null;
  
  /**
   * Récupère le client Supabase (compatible admin et frontend)
   * Utilise l'injection directe du token ENVIRONMENT fourni dans app.config.ts
   * 
   * SOLUTION SIMPLE : Injection directe du token ENVIRONMENT partagé
   */
  private getSupabaseClient(): SupabaseClient | null {
    if (this._client) {
      return this._client;
    }
    
    // Injection directe du token ENVIRONMENT
    if (this.environment?.supabaseUrl && this.environment?.supabaseAnonKey) {
      this._client = createClient(this.environment.supabaseUrl, this.environment.supabaseAnonKey);
      return this._client;
    }
    
    return null;
  }
  
  private get client(): SupabaseClient {
    const client = this.getSupabaseClient();
    if (!client) {
      throw new Error('SupabaseService not found. Please ensure SupabaseService is provided in your app.config.ts or ENVIRONMENT token is available.');
    }
    return client;
  }
  /**
   * Normalise un mot : trim, lowercase, suppression des accents
   * @param word - Le mot à normaliser
   * @returns Le mot normalisé
   */
  normalizeWord(word: string): string {
    if (!word) return '';
    
    return word
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Supprime les diacritiques (accents)
  }

  /**
   * Obtient le préfixe normalisé pour la recherche
   * @param input - L'input de recherche
   * @returns Le préfixe normalisé (max 20 caractères)
   */
  getPrefix(input: string): string {
    const normalized = this.normalizeWord(input);
    return normalized.slice(0, 20); // Limite à 20 chars pour sécurité
  }

  /**
   * Formate un mot avec highlight (prefix en gras, suffix normal)
   * @param original - Le mot original
   * @param query - La requête de recherche
   * @returns Objet avec prefix et suffix
   */
  formatHighlight(original: string, query: string): { prefix: string; suffix: string } {
    const normalizedOriginal = this.normalizeWord(original);
    const normalizedQuery = this.normalizeWord(query);
    
    if (normalizedQuery.length === 0) {
      return { prefix: '', suffix: original };
    }

    const index = normalizedOriginal.indexOf(normalizedQuery);
    if (index === -1) {
      return { prefix: '', suffix: original };
    }

    // Trouver la position dans le mot original (en tenant compte de la casse)
    // On utilise la longueur du query pour split
    const prefix = original.slice(0, index + query.length);
    const suffix = original.slice(index + query.length);

    return { prefix, suffix };
  }

  /**
   * Filtre les mots globaux selon le préfixe de recherche
   * @param searchPrefix - Le préfixe de recherche normalisé
   * @param globalWords - Liste de tous les mots globaux
   * @param childWords - Liste des mots liés à l'enfant
   * @returns Liste de mots formatés et filtrés
   */
  filterWords(
    searchPrefix: string,
    globalWords: GlobalWord[],
    childWords: ChildWord[]
  ): FormattedWord[] {
    if (searchPrefix.length === 0) {
      return [];
    }

    // Créer un Set des IDs de mots liés à l'enfant pour lookup rapide
    const childWordIds = new Set(childWords.map(cw => cw.global_word_id));

    // Filtrer les mots qui commencent par le préfixe
    const matchingWords = globalWords.filter(word =>
      word.normalized_word.startsWith(searchPrefix)
    );

    // Séparer en deux groupes : mots de l'enfant vs autres
    const childWordsGroup: GlobalWord[] = [];
    const otherWordsGroup: GlobalWord[] = [];

    matchingWords.forEach(word => {
      if (childWordIds.has(word.id)) {
        childWordsGroup.push(word);
      } else {
        otherWordsGroup.push(word);
      }
    });

    // Limiter les autres mots à 10 max, puis ajouter les mots de l'enfant en bas
    const limitedOtherWords = otherWordsGroup.slice(0, 10);
    const limitedChildWords = childWordsGroup.slice(0, 10);

    // Combiner : autres mots en premier, puis mots de l'enfant en bas
    const combinedWords = [...limitedOtherWords, ...limitedChildWords];

    // Dédupliquer par normalized_word (garder la première occurrence)
    const seen = new Set<string>();
    const uniqueWords: GlobalWord[] = [];
    
    combinedWords.forEach(word => {
      if (!seen.has(word.normalized_word)) {
        seen.add(word.normalized_word);
        uniqueWords.push(word);
      }
    });

    // Créer un Map pour lookup rapide du childWordId (global_word_id -> childWord.id)
    const childWordsMap = new Map(childWords.map(cw => [cw.global_word_id, cw]));

    // Formater chaque mot avec highlight
    return uniqueWords.map(word => {
      const { prefix, suffix } = this.formatHighlight(word.word, searchPrefix);
      const childWord = childWordsMap.get(word.id);
      return {
        original: word.word,
        prefix,
        suffix,
        isFromChild: childWordIds.has(word.id),
        globalWordId: word.id,
        childWordId: childWord?.id,
      };
    });
  }

  /**
   * Récupère tous les mots globaux
   * @returns Observable de la liste des mots globaux
   */
  getGlobalWords(): Observable<GlobalWord[]> {
    return from(
      this.client
        .from('global_words')
        .select('*')
        .order('word', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching global words:', error);
          return [];
        }
        return data || [];
      }),
      catchError((error) => {
        console.error('Error in getGlobalWords:', error);
        return of([]);
      })
    );
  }

  /**
   * Récupère les mots liés à un enfant
   * @param childId - L'ID de l'enfant
   * @returns Observable de la liste des mots liés à l'enfant
   */
  getChildWords(childId: string): Observable<ChildWord[]> {
    if (!childId) {
      return of([]);
    }

    return from(
      this.client
        .from('child_words')
        .select('*')
        .eq('child_id', childId)
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching child words:', error);
          return [];
        }
        return data || [];
      }),
      catchError((error) => {
        console.error('Error in getChildWords:', error);
        return of([]);
      })
    );
  }

  /**
   * Vérifie si un mot existe déjà (insensible à la casse et aux accents)
   * @param word - Le mot à vérifier
   * @param excludeId - ID de mot à exclure de la vérification (pour les updates)
   * @returns Observable<boolean> - true si le mot existe
   */
  checkWordExists(word: string, excludeId?: string): Observable<boolean> {
    const normalized = this.normalizeWord(word);
    if (!normalized) {
      return of(false);
    }

    let query = this.client
      .from('global_words')
      .select('id', { count: 'exact', head: true })
      .eq('normalized_word', normalized);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    return from(query).pipe(
      map(({ count, error }) => {
        if (error) {
          console.error('Error checking word existence:', error);
          return false;
        }
        return (count || 0) > 0;
      }),
      catchError((error) => {
        console.error('Error in checkWordExists:', error);
        return of(false);
      })
    );
  }

  /**
   * Crée un nouveau mot global
   * @param word - Le mot à créer
   * @returns Observable du mot créé
   */
  createGlobalWord(word: string): Observable<GlobalWord> {
    const normalized = this.normalizeWord(word);
    if (!normalized || !word.trim()) {
      throw new Error('Le mot ne peut pas être vide');
    }

    // Récupérer l'utilisateur actuel si disponible
    const authUser = this.client.auth.getUser();
    
    return from(authUser).pipe(
      switchMap(({ data: { user } }) => {
        const wordData: Partial<GlobalWord> = {
          word: word.trim(),
          normalized_word: normalized,
          created_by: user?.id || null,
        };

        return from(
          this.client
            .from('global_words')
            .insert(wordData)
            .select()
            .single()
        );
      }),
      map(({ data, error }) => {
        if (error) {
          // Si le mot existe déjà (contrainte unique), essayer de le récupérer
          if (error.code === '23505') {
            // Violation de contrainte unique - le mot existe déjà
            throw new Error('Ce mot existe déjà');
          }
          console.error('Error creating global word:', error);
          throw new Error(error.message || 'Erreur lors de la création du mot');
        }
        if (!data) {
          throw new Error('Aucune donnée retournée lors de la création');
        }
        return data;
      }),
      catchError((error) => {
        if (error.message) {
          throw error;
        }
        console.error('Error in createGlobalWord:', error);
        throw new Error('Erreur lors de la création du mot');
      })
    );
  }

  /**
   * Lie des mots globaux à un enfant
   * @param childId - L'ID de l'enfant
   * @param globalWordIds - Liste des IDs de mots globaux à lier
   * @returns Observable de la liste des liens créés
   */
  linkWordsToChild(childId: string, globalWordIds: string[]): Observable<ChildWord[]> {
    if (!childId || globalWordIds.length === 0) {
      return of([]);
    }

    // Préparer les données pour l'insertion en batch
    const links = globalWordIds.map(globalWordId => ({
      child_id: childId,
      global_word_id: globalWordId,
    }));

    return from(
      this.client
        .from('child_words')
        .insert(links)
        .select()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          // Si certains liens existent déjà (ON CONFLICT), c'est OK
          // On récupère les liens existants
          if (error.code === '23505') {
            // Certains liens existent déjà, récupérer tous les liens de l'enfant
            return this.getChildWords(childId).pipe(
              map(childWords => {
                // Filtrer pour ne garder que ceux qui correspondent aux IDs demandés
                return childWords.filter(cw => globalWordIds.includes(cw.global_word_id));
              })
            );
          }
          console.error('Error linking words to child:', error);
          throw new Error(error.message || 'Erreur lors de la liaison des mots');
        }
        return data || [];
      }),
      switchMap(result => {
        if (result instanceof Observable) {
          return result;
        }
        return of(result);
      }),
      catchError((error) => {
        console.error('Error in linkWordsToChild:', error);
        throw error;
      })
    );
  }

  /**
   * Met à jour un lien enfant-mot
   * @param childWordId - L'ID du lien à mettre à jour
   * @param updates - Les champs à mettre à jour
   * @returns Observable du lien mis à jour
   */
  updateChildWord(childWordId: string, updates: Partial<ChildWord>): Observable<ChildWord> {
    return from(
      this.client
        .from('child_words')
        .update(updates)
        .eq('id', childWordId)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error updating child word:', error);
          throw new Error(error.message || 'Erreur lors de la mise à jour');
        }
        if (!data) {
          throw new Error('Aucune donnée retournée lors de la mise à jour');
        }
        return data;
      }),
      catchError((error) => {
        if (error.message) {
          throw error;
        }
        console.error('Error in updateChildWord:', error);
        throw new Error('Erreur lors de la mise à jour');
      })
    );
  }

  /**
   * Supprime un lien enfant-mot (ne supprime jamais le mot global)
   * @param childWordId - L'ID du lien à supprimer
   * @returns Observable<void>
   */
  deleteChildWord(childWordId: string): Observable<void> {
    return from(
      this.client
        .from('child_words')
        .delete()
        .eq('id', childWordId)
    ).pipe(
      map(({ error }) => {
        if (error) {
          console.error('Error deleting child word:', error);
          throw new Error(error.message || 'Erreur lors de la suppression');
        }
      }),
      catchError((error) => {
        if (error.message) {
          throw error;
        }
        console.error('Error in deleteChildWord:', error);
        throw new Error('Erreur lors de la suppression');
      })
    );
  }
}
