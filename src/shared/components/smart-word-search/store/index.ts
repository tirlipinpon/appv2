import { inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { computed } from '@angular/core';
import type { GlobalWord, ChildWord, FormattedWord } from '../types/word.types';
import { WordService } from '../services/word/word.service';

export interface SmartWordSearchState {
  globalWords: GlobalWord[];
  childWords: ChildWord[];
  searchInput: string;
  selectedWords: Set<string>;
  isValidating: boolean;
  errorMessage: string | null;
  isDropdownVisible: boolean;
  selectedIndex: number;
  editingWordId: string | null; // ID du mot en cours d'édition (childWordId)
  editingWordValue: string; // Valeur temporaire pendant l'édition
}

const initialState: SmartWordSearchState = {
  globalWords: [],
  childWords: [],
  searchInput: '',
  selectedWords: new Set(),
  isValidating: false,
  errorMessage: null,
  isDropdownVisible: false,
  selectedIndex: -1,
  editingWordId: null,
  editingWordValue: '',
};

export const SmartWordSearchStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store, wordService = inject(WordService)) => {
    // Computed : Mots filtrés
    const filteredWords = computed(() => {
      const input = store.searchInput();
      const globalWords = store.globalWords();
      const childWords = store.childWords();
      
      if (input.length === 0) {
        return [];
      }

      const prefix = wordService.getPrefix(input);
      return wordService.filterWords(prefix, globalWords, childWords);
    });

    // Computed : Afficher le bouton "Ajouter"
    const showAddButton = computed(() => {
      // Toujours afficher le bouton
      return true;
    });

    // Computed : Peut ajouter (des mots sont sélectionnés OU input valide pour création)
    const canAddWord = computed(() => {
      if (store.isValidating()) {
        return false;
      }
      // Si des mots sont sélectionnés, on peut les ajouter
      if (store.selectedWords().size > 0) {
        return true;
      }
      // Sinon, on peut créer un nouveau mot si l'input a au moins 3 lettres
      const input = store.searchInput().trim();
      return input.length >= 3;
    });

    // Computed : Afficher le bouton "Valider"
    const showValidateButton = computed(() => {
      return store.selectedWords().size > 0 && !store.isValidating();
    });

    // Computed : Aucun résultat trouvé
    const showNoResults = computed(() => {
      const input = store.searchInput();
      const filtered = filteredWords();
      return input.length > 0 && filtered.length === 0 && !store.isValidating();
    });

    // Computed : Afficher l'option de création
    const showCreateOption = computed(() => {
      return showNoResults();
    });

    // Computed : Données des mots sélectionnés
    const selectedWordsData = computed(() => {
      const selectedIds = store.selectedWords();
      const globalWords = store.globalWords();
      
      if (selectedIds.size === 0) {
        return [];
      }
      
      // Créer un Map pour lookup rapide des mots globaux
      const globalWordsMap = new Map(globalWords.map(gw => [gw.id, gw]));
      
      // Récupérer les mots sélectionnés depuis globalWords
      const selectedWordsList: FormattedWord[] = [];
      selectedIds.forEach(globalWordId => {
        const globalWord = globalWordsMap.get(globalWordId);
        if (globalWord) {
          // Formater le mot avec highlight basé sur le mot original
          const { prefix, suffix } = wordService.formatHighlight(globalWord.word, '');
          selectedWordsList.push({
            original: globalWord.word,
            prefix,
            suffix,
            isFromChild: false, // On vérifiera si c'est un mot de l'enfant
            globalWordId: globalWord.id,
          });
        }
      });
      
      // Marquer les mots qui sont déjà liés à l'enfant
      const childWordIds = new Set(store.childWords().map(cw => cw.global_word_id));
      selectedWordsList.forEach(word => {
        word.isFromChild = childWordIds.has(word.globalWordId);
      });
      
      return selectedWordsList;
    });

    // Computed : Tous les mots de l'enfant sont sélectionnés
    const allChildWordsUsed = computed(() => {
      const childWordIds = new Set(store.childWords().map(cw => cw.global_word_id));
      const selectedIds = store.selectedWords();
      
      if (childWordIds.size === 0) return false;
      
      return Array.from(childWordIds).every(id => selectedIds.has(id));
    });

    // Computed : Mots de l'enfant formatés pour affichage
    const childWordsData = computed(() => {
      const childWords = store.childWords();
      const globalWords = store.globalWords();
      
      if (childWords.length === 0) {
        return [];
      }
      
      // Créer un Map pour lookup rapide des mots globaux
      const globalWordsMap = new Map(globalWords.map(gw => [gw.id, gw]));
      
      // Récupérer les mots de l'enfant avec leurs informations globales
      const childWordsList: (FormattedWord & { childWordId: string })[] = [];
      childWords.forEach(childWord => {
        const globalWord = globalWordsMap.get(childWord.global_word_id);
        if (globalWord) {
          // Formater le mot
          const { prefix, suffix } = wordService.formatHighlight(globalWord.word, '');
          childWordsList.push({
            original: globalWord.word,
            prefix,
            suffix,
            isFromChild: true,
            globalWordId: globalWord.id,
            childWordId: childWord.id,
          });
        }
      });
      
      // Trier par ordre alphabétique
      childWordsList.sort((a, b) => a.original.localeCompare(b.original));
      
      return childWordsList;
    });

    return {
      filteredWords,
      showAddButton,
      canAddWord,
      showValidateButton,
      showNoResults,
      showCreateOption,
      selectedWordsData,
      allChildWordsUsed,
      childWordsData,
    };
  }),
  withMethods((store) => ({
    // Méthodes pour mettre à jour l'état
    updateSearchInput: (value: string) => {
      patchState(store, { searchInput: value });
    },
    updateSelectedWords: (words: Set<string>) => {
      patchState(store, { selectedWords: words });
    },
    updateIsValidating: (value: boolean) => {
      patchState(store, { isValidating: value });
    },
    updateErrorMessage: (message: string | null) => {
      patchState(store, { errorMessage: message });
    },
    updateIsDropdownVisible: (visible: boolean) => {
      patchState(store, { isDropdownVisible: visible });
    },
    updateSelectedIndex: (index: number) => {
      patchState(store, { selectedIndex: index });
    },
    updateGlobalWords: (words: GlobalWord[]) => {
      patchState(store, { globalWords: words });
    },
    updateChildWords: (words: ChildWord[]) => {
      patchState(store, { childWords: words });
    },
    // Méthode pour mettre à jour plusieurs champs à la fois
    patchState: (updates: Partial<SmartWordSearchState>) => {
      patchState(store, updates);
    },
  }))
);
