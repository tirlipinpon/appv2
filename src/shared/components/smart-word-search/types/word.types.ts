/**
 * Types pour le composant SmartWordSearchComponent
 */

export interface GlobalWord {
  id: string;
  word: string;
  normalized_word: string;
  created_at: string;
  created_by?: string | null;
}

export interface ChildWord {
  id: string;
  child_id: string;
  global_word_id: string;
  created_at: string;
}

export interface FormattedWord {
  original: string;
  prefix: string;
  suffix: string;
  isFromChild: boolean;
  globalWordId: string;
  childWordId?: string;
}

export interface SearchState {
  input: string;
  filteredWords: FormattedWord[];
  selectedWords: Set<string>;
  hasError: boolean;
}
