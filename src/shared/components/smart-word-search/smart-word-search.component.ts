import { Component, Input, Output, EventEmitter, inject, OnInit, OnDestroy, OnChanges, SimpleChanges, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { SearchState, FormattedWord } from './types/word.types';
import { SmartWordSearchStore } from './store/index';
import { Application } from './components/application/application';

@Component({
  selector: 'app-smart-word-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './smart-word-search.component.html',
  styleUrl: './smart-word-search.component.scss',
})
export class SmartWordSearchComponent implements OnInit, OnDestroy, OnChanges {
  // Inputs
  @Input() currentChildId = '';
  @Input() variant: 'admin' | 'frontend' = 'admin';

  // Outputs
  @Output() wordsLinked = new EventEmitter<string[]>();
  @Output() stateChanged = new EventEmitter<SearchState>();

  // Store et Application
  readonly store = inject(SmartWordSearchStore);
  private readonly application = inject(Application);

  // Effect pour émettre stateChanged
  private stateEffect = effect(() => {
    const state: SearchState = {
      input: this.store.searchInput(),
      filteredWords: this.store.filteredWords(),
      selectedWords: this.store.selectedWords(),
      hasError: this.store.errorMessage() !== null,
    };
    this.stateChanged.emit(state);
  });

  ngOnInit(): void {
    // Charger les mots globaux et les mots de l'enfant
    this.loadWordsIfNeeded();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Recharger les mots si currentChildId change
    if (changes['currentChildId'] && !changes['currentChildId'].firstChange) {
      this.loadWordsIfNeeded();
    } else if (changes['currentChildId']?.firstChange && this.currentChildId) {
      this.loadWordsIfNeeded();
    }
  }

  private loadWordsIfNeeded(): void {
    // Charger les mots globaux (toujours disponibles)
    this.application.loadGlobalWords();
    
    // Charger les mots de l'enfant si l'ID est disponible
    if (this.currentChildId && this.currentChildId.trim() !== '') {
      this.application.loadChildWords(this.currentChildId);
    }
  }

  ngOnDestroy(): void {
    // Nettoyage
    this.stateEffect.destroy();
  }

  // Handlers
  onInputChange(value: string): void {
    this.application.onInputChange(value);
  }

  onResetInput(): void {
    this.application.clearSelection();
  }

  async toggleWordSelection(globalWordId: string, childWordId?: string): Promise<void> {
    if (!this.currentChildId) {
      this.store.patchState({
        errorMessage: 'ID enfant manquant',
      });
      return;
    }
    await this.application.toggleWordSelection(globalWordId, childWordId, this.currentChildId);
  }

  async toggleChildWordLink(globalWordId: string, childWordId: string | undefined): Promise<void> {
    if (!this.currentChildId) {
      this.store.patchState({
        errorMessage: 'ID enfant manquant',
      });
      return;
    }
    await this.application.toggleChildWordLink(globalWordId, childWordId, this.currentChildId);
  }

  selectAllFromChild(): void {
    this.application.selectAllFromChild();
  }

  clearSelection(): void {
    this.application.clearSelection();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.currentChildId) {
      return;
    }
    this.application.onKeyDown(event, this.currentChildId);
  }

  async onCreateNewWord(): Promise<void> {
    await this.application.onCreateNewWord(this.store.searchInput(), this.variant);
  }

  async onSubmit(): Promise<void> {
    if (!this.currentChildId) {
      this.store.patchState({
        errorMessage: 'ID enfant manquant',
      });
      return;
    }

    const result = await this.application.onSubmit(this.currentChildId, (wordIds) => {
      this.wordsLinked.emit(wordIds);
    });

    if (result) {
      // Succès - déjà géré dans application.onSubmit
    }
  }

  async onAddSelectedWords(): Promise<void> {
    // Le bouton "+ Ajouter" sert uniquement à créer un nouveau mot
    const input = this.store.searchInput().trim();
    if (input.length >= 3) {
      // Créer le mot et l'ajouter automatiquement à l'enfant
      await this.application.onCreateNewWordAndLink(input, this.variant, this.currentChildId);
    }
  }

  startEditChildWord(word: FormattedWord & { childWordId: string }): void {
    this.application.startEditChildWord(word);
  }

  cancelEditChildWord(): void {
    this.application.cancelEditChildWord();
  }

  onEditingWordValueChange(value: string): void {
    this.application.updateEditingWordValue(value);
  }

  async saveEditChildWord(childWordId: string): Promise<void> {
    await this.application.saveEditChildWord(childWordId);
  }

  async onDeleteChildWord(word: FormattedWord & { childWordId: string }): Promise<void> {
    await this.application.onDeleteChildWord(word.childWordId, this.currentChildId);
  }
}
