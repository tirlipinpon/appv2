import { inject } from '@angular/core';
import { WordService } from '../../services/word/word.service';
import type { GlobalWord, ChildWord } from '../../types/word.types';
import { Observable } from 'rxjs';

/**
 * Infrastructure layer - Wrapper API
 * Adapte les appels au WordService pour l'Application layer
 */
export class Infrastructure {
  private readonly wordService = inject(WordService);

  /**
   * Charge tous les mots globaux
   */
  loadGlobalWords(): Observable<GlobalWord[]> {
    return this.wordService.getGlobalWords();
  }

  /**
   * Charge les mots liés à un enfant
   */
  loadChildWords(childId: string): Observable<ChildWord[]> {
    return this.wordService.getChildWords(childId);
  }
}
