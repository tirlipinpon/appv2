import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SmartWordSearchStore } from '../../store/index';
import { WordService } from '../../services/word/word.service';
import type { FormattedWord, GlobalWord } from '../../types/word.types';

/**
 * Application layer - Orchestration métier
 * Gère la logique de sélection, validation, création et soumission
 */
@Injectable({
  providedIn: 'root',
})
export class Application {
  private readonly store = inject(SmartWordSearchStore);
  private readonly wordService = inject(WordService);

  /**
   * Gère le changement d'input de recherche
   */
  onInputChange(value: string): void {
    const trimmed = value.trim();
    this.store.patchState({
      searchInput: trimmed,
      selectedIndex: -1,
      errorMessage: null,
      isDropdownVisible: trimmed.length > 0,
    });
  }

  /**
   * Toggle la sélection d'un mot et l'ajoute/supprime automatiquement de l'enfant
   */
  async toggleWordSelection(globalWordId: string, childWordId: string | undefined, childId: string): Promise<void> {
    // Si c'est un mot déjà lié à l'enfant, on le supprime
    if (childWordId) {
      await this.toggleChildWordLink(globalWordId, childWordId, childId);
      return;
    }

    // Sinon, c'est un mot non lié : on l'ajoute automatiquement à l'enfant
    const currentSelected = new Set(this.store.selectedWords());
    
    if (currentSelected.has(globalWordId)) {
      // Déjà sélectionné, on le retire (et on le supprime de l'enfant si déjà lié)
      currentSelected.delete(globalWordId);
      this.store.patchState({
        selectedWords: currentSelected,
      });
    } else {
      // Nouveau mot à ajouter : on l'ajoute directement à l'enfant
      currentSelected.add(globalWordId);
      this.store.patchState({
        selectedWords: currentSelected,
        isValidating: true,
        errorMessage: null,
      });

      try {
        await firstValueFrom(this.wordService.linkWordsToChild(childId, [globalWordId]));
        
        // Recharger les mots de l'enfant et globaux
        this.loadChildWords(childId);
        this.loadGlobalWords();
        
        this.store.patchState({
          isValidating: false,
          errorMessage: null,
        });
      } catch (error: any) {
        // En cas d'erreur, retirer de la sélection
        currentSelected.delete(globalWordId);
        this.store.patchState({
          selectedWords: currentSelected,
          isValidating: false,
          errorMessage: error?.message || 'Erreur lors de l\'ajout du mot',
        });
      }
    }
  }

  /**
   * Toggle le lien d'un mot avec l'enfant (ajouter ou supprimer)
   */
  async toggleChildWordLink(globalWordId: string, childWordId: string | undefined, childId: string): Promise<void> {
    if (!childWordId) {
      // Le mot n'est pas lié, on l'ajoute directement
      this.store.patchState({
        isValidating: true,
        errorMessage: null,
      });

      try {
        await firstValueFrom(this.wordService.linkWordsToChild(childId, [globalWordId]));
        
        // Recharger les mots de l'enfant et globaux
        this.loadChildWords(childId);
        this.loadGlobalWords();
        
        this.store.patchState({
          isValidating: false,
          errorMessage: null,
        });
      } catch (error: any) {
        this.store.patchState({
          isValidating: false,
          errorMessage: error?.message || 'Erreur lors de la liaison du mot',
        });
      }
      return;
    }

    // Le mot est lié, on le supprime (sans confirmation pour rester cohérent avec le toggle)
    this.store.patchState({
      isValidating: true,
      errorMessage: null,
    });

    try {
      await firstValueFrom(this.wordService.deleteChildWord(childWordId));
      
      // Recharger les mots de l'enfant et globaux
      this.loadChildWords(childId);
      this.loadGlobalWords();
      
      // Retirer de la sélection si présent
      const currentSelected = new Set(this.store.selectedWords());
      currentSelected.delete(globalWordId);
      
      this.store.patchState({
        selectedWords: currentSelected,
        isValidating: false,
        errorMessage: null,
      });
    } catch (error: any) {
      this.store.patchState({
        isValidating: false,
        errorMessage: error?.message || 'Erreur lors de la suppression du mot',
      });
    }
  }

  /**
   * Sélectionne tous les mots de l'enfant (admin feature)
   */
  selectAllFromChild(): void {
    const childWordIds = this.store.childWords().map(cw => cw.global_word_id);
    const currentSelected = new Set(this.store.selectedWords());
    
    childWordIds.forEach(id => currentSelected.add(id));
    
    this.store.patchState({
      selectedWords: currentSelected,
    });
  }

  /**
   * Efface la sélection
   */
  clearSelection(): void {
    this.store.patchState( {
      selectedWords: new Set(),
      searchInput: '',
      isDropdownVisible: false,
      errorMessage: null,
      selectedIndex: -1,
    });
  }

  /**
   * Gère la navigation au clavier
   */
  onKeyDown(event: KeyboardEvent, childId: string): void {
    const filtered = this.store.filteredWords();
    
    if (filtered.length === 0) {
      return;
    }

    const currentIndex = this.store.selectedIndex();
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        newIndex = currentIndex < filtered.length - 1 ? currentIndex + 1 : 0;
        this.store.patchState( { selectedIndex: newIndex });
        break;

      case 'ArrowUp':
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : filtered.length - 1;
        this.store.patchState( { selectedIndex: newIndex });
        break;

      case 'Enter':
        event.preventDefault();
        if (currentIndex >= 0 && currentIndex < filtered.length) {
          const word = filtered[currentIndex];
          this.toggleWordSelection(word.globalWordId, word.childWordId, childId);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.store.patchState( { isDropdownVisible: false });
        break;
    }
  }

  /**
   * Vérifie si la soumission est possible
   */
  canSubmit(): boolean {
    return (
      this.store.selectedWords().size > 0 &&
      !this.store.isValidating()
    );
  }

  /**
   * Valide avant soumission
   * @returns Tableau d'erreurs (vide si valide)
   */
  validateBeforeSubmit(): string[] {
    const errors: string[] = [];
    const selectedIds = Array.from(this.store.selectedWords());
    const globalWords = this.store.globalWords();
    const childWords = this.store.childWords();

    // Vérifier que tous les IDs sélectionnés existent dans globalWords
    const globalWordIds = new Set(globalWords.map(gw => gw.id));
    const invalidIds = selectedIds.filter(id => !globalWordIds.has(id));
    
    if (invalidIds.length > 0) {
      errors.push('Certains mots sélectionnés ne sont plus disponibles');
    }

    // Vérifier qu'il n'y a pas de doublons (via Set, normalement impossible)
    const uniqueIds = new Set(selectedIds);
    if (uniqueIds.size !== selectedIds.length) {
      errors.push('Des doublons ont été détectés dans la sélection');
    }

    // Vérifier qu'aucun mot n'est déjà lié à l'enfant (optionnel, car ON CONFLICT gère ça)
    // On peut laisser passer, le backend gérera les doublons

    return errors;
  }

  /**
   * Crée un nouveau mot global
   * @param newWordInput - Le mot à créer
   * @param variant - Variant du composant ('admin' ou 'frontend')
   * @returns Promise qui résout avec le mot créé ou null en cas d'erreur
   */
  async onCreateNewWord(newWordInput: string, variant: 'admin' | 'frontend'): Promise<GlobalWord | null> {
    // Vérifier variant
    if (variant !== 'admin') {
      this.store.patchState( {
        errorMessage: 'La création de mots n\'est disponible qu\'en mode admin',
      });
      return null;
    }

    const newWord = newWordInput.trim();
    
    // Validation
    if (newWord.length === 0) {
      this.store.patchState( {
        errorMessage: 'Le mot ne peut pas être vide',
      });
      return null;
    }

    if (newWord.length < 3) {
      this.store.patchState( {
        errorMessage: 'Le mot doit contenir au moins 3 lettres',
      });
      return null;
    }

    this.store.patchState( {
      isValidating: true,
      errorMessage: null,
    });

    try {
      // Vérifier si le mot existe déjà
      const exists = await firstValueFrom(this.wordService.checkWordExists(newWord));
      
      if (exists) {
        this.store.patchState( {
          isValidating: false,
          errorMessage: 'Ce mot existe déjà',
        });
        return null;
      }

      // Créer le mot
      const createdWord = await firstValueFrom(this.wordService.createGlobalWord(newWord));
      
      if (!createdWord) {
        throw new Error('Erreur lors de la création du mot');
      }

      // Ajouter le mot créé à la liste globale et à la sélection
      const currentGlobalWords = [...this.store.globalWords(), createdWord];
      const currentSelected = new Set(this.store.selectedWords());
      currentSelected.add(createdWord.id);

      this.store.patchState( {
        globalWords: currentGlobalWords,
        selectedWords: currentSelected,
        searchInput: '',
        isValidating: false,
        errorMessage: null,
        isDropdownVisible: false,
      });

      return createdWord;
    } catch (error: any) {
      // Gérer les race conditions (mot créé entre check et insert)
      if (error?.message?.includes('existe déjà') || error?.code === '23505') {
        this.store.patchState( {
          isValidating: false,
          errorMessage: 'Ce mot a été créé entre-temps par quelqu\'un d\'autre',
        });
        // Recharger les mots globaux
        this.loadGlobalWords();
        return null;
      } else {
        this.store.patchState( {
          isValidating: false,
          errorMessage: error?.message || 'Erreur lors de la création du mot',
        });
        return null;
      }
    }
  }

  /**
   * Crée un nouveau mot et le lie automatiquement à l'enfant
   * @param newWordInput - Le mot à créer
   * @param variant - Variant du composant ('admin' ou 'frontend')
   * @param childId - L'ID de l'enfant
   */
  async onCreateNewWordAndLink(
    newWordInput: string,
    variant: 'admin' | 'frontend',
    childId: string
  ): Promise<void> {
    if (!childId) {
      this.store.patchState({
        errorMessage: 'ID enfant manquant',
      });
      return;
    }

    // Créer le mot
    const createdWord = await this.onCreateNewWord(newWordInput, variant);
    
    if (!createdWord) {
      // Erreur déjà gérée dans onCreateNewWord
      return;
    }

    // Lier automatiquement le mot créé à l'enfant
    try {
      const linkedWords = await firstValueFrom(
        this.wordService.linkWordsToChild(childId, [createdWord.id])
      );

      if (linkedWords && linkedWords.length > 0) {
        // Recharger les mots de l'enfant
        this.loadChildWords(childId);
        
        // Recharger les mots globaux pour avoir les dernières données
        this.loadGlobalWords();
        
        // Clear la sélection
        this.store.patchState({
          selectedWords: new Set(),
        });
      }
    } catch (error: any) {
      console.error('Error linking created word to child:', error);
      this.store.patchState({
        errorMessage: 'Le mot a été créé mais n\'a pas pu être lié à l\'enfant',
      });
    }
  }

  /**
   * Charge les mots globaux (méthode helper)
   */
  loadGlobalWords(): void {
    this.wordService.getGlobalWords().subscribe({
      next: (words) => {
        this.store.patchState( { globalWords: words });
      },
      error: (error) => {
        console.error('Error loading global words:', error);
        this.store.patchState( {
          errorMessage: 'Erreur lors du chargement des mots',
        });
      },
    });
  }

  /**
   * Charge les mots de l'enfant (méthode helper)
   */
  loadChildWords(childId: string): void {
    if (!childId) {
      return;
    }

    this.wordService.getChildWords(childId).subscribe({
      next: (words) => {
        this.store.patchState( { childWords: words });
      },
      error: (error) => {
        console.error('Error loading child words:', error);
        this.store.patchState( {
          errorMessage: 'Erreur lors du chargement des mots de l\'enfant',
        });
      },
    });
  }

  /**
   * Soumet la sélection de mots et les lie à l'enfant
   * @param childId - L'ID de l'enfant
   * @param onSuccess - Callback appelé en cas de succès avec les IDs des mots liés
   * @returns Promise qui résout avec les IDs des mots liés ou null en cas d'erreur
   */
  async onSubmit(childId: string, onSuccess?: (wordIds: string[]) => void): Promise<string[] | null> {
    // Vérifier canSubmit
    if (!this.canSubmit()) {
      this.store.patchState( {
        errorMessage: 'Impossible de soumettre : aucune sélection valide',
      });
      return null;
    }

    // Valider avant soumission
    const validationErrors = this.validateBeforeSubmit();
    if (validationErrors.length > 0) {
      this.store.patchState( {
        errorMessage: validationErrors.join(', '),
      });
      return null;
    }

    if (!childId) {
      this.store.patchState( {
        errorMessage: 'ID enfant manquant',
      });
      return null;
    }

    this.store.patchState( {
      isValidating: true,
      errorMessage: null,
    });

    try {
      const selectedIds = Array.from(this.store.selectedWords());
      
      // Lier les mots à l'enfant
      const linkedWords = await firstValueFrom(this.wordService.linkWordsToChild(childId, selectedIds));
      
      if (!linkedWords || linkedWords.length === 0) {
        throw new Error('Aucun mot n\'a été lié');
      }

      // Recharger les mots de l'enfant
      this.loadChildWords(childId);

      // Émettre l'événement de succès
      const linkedIds = linkedWords.map(cw => cw.global_word_id);
      if (onSuccess) {
        onSuccess(linkedIds);
      }

      // Clear selection et input
      this.store.patchState( {
        selectedWords: new Set(),
        searchInput: '',
        isDropdownVisible: false,
        isValidating: false,
        errorMessage: null,
      });

      return linkedIds;

    } catch (error: any) {
      // Gérer les erreurs spécifiques
      let errorMessage = 'Erreur lors de la liaison des mots';
      
      if (error?.message) {
        if (error.message.includes('connexion') || error.message.includes('network')) {
          errorMessage = 'Erreur de connexion. Veuillez réessayer.';
        } else if (error.message.includes('non trouvé') || error.message.includes('not found')) {
          errorMessage = 'Certains mots n\'ont pas été trouvés';
        } else if (error.message.includes('serveur') || error.message.includes('server')) {
          errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
        } else {
          errorMessage = error.message;
        }
      }

      this.store.patchState( {
        isValidating: false,
        errorMessage: errorMessage,
      });

      return null;
    }
  }

  /**
   * Démarre l'édition d'un mot de l'enfant (affiche un input inline)
   * @param word - Le mot à éditer
   */
  startEditChildWord(word: FormattedWord & { childWordId: string }): void {
    this.store.patchState({
      editingWordId: word.childWordId,
      editingWordValue: word.original,
      errorMessage: null,
    });
  }

  /**
   * Annule l'édition en cours
   */
  cancelEditChildWord(): void {
    this.store.patchState({
      editingWordId: null,
      editingWordValue: '',
    });
  }

  /**
   * Met à jour la valeur temporaire pendant l'édition
   * @param value - La nouvelle valeur
   */
  updateEditingWordValue(value: string): void {
    this.store.patchState({
      editingWordValue: value,
    });
  }

  /**
   * Valide l'édition d'un mot de l'enfant
   * @param childWordId - L'ID du lien à modifier
   */
  async saveEditChildWord(childWordId: string): Promise<void> {
    const editingValue = this.store.editingWordValue().trim();
    const editingWordId = this.store.editingWordId();

    if (!editingValue || editingValue.length === 0) {
      this.store.patchState({
        errorMessage: 'Le mot ne peut pas être vide',
      });
      return;
    }

    // Trouver le mot original
    const childWord = this.store.childWords().find(cw => cw.id === childWordId);
    if (!childWord) {
      this.store.patchState({
        errorMessage: 'Mot introuvable',
        editingWordId: null,
        editingWordValue: '',
      });
      return;
    }

    const originalWord = this.store.globalWords().find(gw => gw.id === childWord.global_word_id);
    if (!originalWord) {
      this.store.patchState({
        errorMessage: 'Mot global introuvable',
        editingWordId: null,
        editingWordValue: '',
      });
      return;
    }

    // Si le mot n'a pas changé, annuler l'édition
    if (editingValue === originalWord.word) {
      this.cancelEditChildWord();
      return;
    }

    // Vérifier si le nouveau mot existe déjà
    const exists = await firstValueFrom(this.wordService.checkWordExists(editingValue));
    
    if (exists) {
      this.store.patchState({
        errorMessage: 'Ce mot existe déjà dans la base de données',
      });
      return;
    }

    // Créer le nouveau mot global et mettre à jour le lien
    await this.updateChildWordWithNewGlobalWord(childWordId, childWord.global_word_id, editingValue);
    
    // Annuler l'édition après sauvegarde
    this.cancelEditChildWord();
  }

  /**
   * Met à jour un mot de l'enfant avec un nouveau mot global
   */
  private async updateChildWordWithNewGlobalWord(
    childWordId: string,
    oldGlobalWordId: string,
    newWord: string
  ): Promise<void> {
    this.store.patchState({
      isValidating: true,
      errorMessage: null,
    });

    try {
      // Récupérer l'ID de l'enfant depuis le lien actuel
      const childWord = this.store.childWords().find(cw => cw.id === childWordId);
      if (!childWord) {
        throw new Error('Lien enfant-mot introuvable');
      }

      const childId = childWord.child_id;

      // Créer le nouveau mot global (ou récupérer s'il existe déjà)
      let newGlobalWord;
      const exists = await firstValueFrom(this.wordService.checkWordExists(newWord));
      
      if (exists) {
        // Le mot existe déjà, le récupérer
        const globalWords = await firstValueFrom(this.wordService.getGlobalWords());
        
        newGlobalWord = globalWords.find(gw => 
          this.wordService.normalizeWord(gw.word) === this.wordService.normalizeWord(newWord)
        );
        
        if (!newGlobalWord) {
          throw new Error('Le mot existe mais n\'a pas pu être trouvé');
        }
      } else {
        // Créer le nouveau mot global
        newGlobalWord = await firstValueFrom(this.wordService.createGlobalWord(newWord));
        
        if (!newGlobalWord) {
          throw new Error('Erreur lors de la création du nouveau mot');
        }
      }

      // Supprimer l'ancien lien
      await firstValueFrom(this.wordService.deleteChildWord(childWordId));
      
      // Créer le nouveau lien vers le nouveau mot global
      await firstValueFrom(this.wordService.linkWordsToChild(childId, [newGlobalWord.id]));
      
      // Recharger les mots de l'enfant et globaux
      this.loadChildWords(childId);
      this.loadGlobalWords();

      this.store.patchState({
        isValidating: false,
        errorMessage: null,
      });
    } catch (error: any) {
      this.store.patchState({
        isValidating: false,
        errorMessage: error?.message || 'Erreur lors de la mise à jour du mot',
      });
    }
  }

  /**
   * Supprime un mot de l'enfant (supprime le lien, pas le mot global)
   * @param childWordId - L'ID du lien à supprimer
   * @param childId - L'ID de l'enfant (pour recharger après suppression)
   */
  async onDeleteChildWord(childWordId: string, childId: string): Promise<void> {
    if (!childWordId || !childId) {
      this.store.patchState({
        errorMessage: 'ID manquant pour la suppression',
      });
      return;
    }

    // Demander confirmation
    const confirmed = confirm('Êtes-vous sûr de vouloir supprimer ce mot de l\'enfant ?');
    if (!confirmed) {
      return;
    }

    this.store.patchState({
      isValidating: true,
      errorMessage: null,
    });

    try {
      // Supprimer le lien (pas le mot global)
      await firstValueFrom(this.wordService.deleteChildWord(childWordId));
      
      // Recharger les mots de l'enfant
      this.loadChildWords(childId);
      
      // Retirer de la sélection si présent
      const currentSelected = new Set(this.store.selectedWords());
      const childWord = this.store.childWords().find(cw => cw.id === childWordId);
      if (childWord) {
        currentSelected.delete(childWord.global_word_id);
        this.store.patchState({
          selectedWords: currentSelected,
        });
      }

      this.store.patchState({
        isValidating: false,
        errorMessage: null,
      });
    } catch (error: any) {
      this.store.patchState({
        isValidating: false,
        errorMessage: error?.message || 'Erreur lors de la suppression du mot',
      });
    }
  }
}
