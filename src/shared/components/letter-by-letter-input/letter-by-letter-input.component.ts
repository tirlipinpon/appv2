import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WordValidationUtil, type LetterState, type LetterAnalysisResult } from '../../utils/word-validation.util';

export interface LetterBox {
  letter: string;
  state: LetterState | null;
  isCursor: boolean;
}

@Component({
  selector: 'app-letter-by-letter-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './letter-by-letter-input.component.html',
  styleUrls: ['./letter-by-letter-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LetterByLetterInputComponent implements OnInit, OnChanges {
  @Input() targetWord = '';
  @Input() maxLength?: number;
  @Input() allowHyphen = true;
  @Input() disabled = false;
  
  @Output() wordChange = new EventEmitter<string>();
  @Output() wordComplete = new EventEmitter<string>();

  @ViewChild('mobileInput', { static: false }) mobileInput?: ElementRef<HTMLInputElement>;

  // État interne
  private currentInput = signal<string>('');
  private previousInputValue = signal<string>('');
  private letterStates = signal<LetterState[]>([]);

  // Computed signals
  readonly effectiveMaxLength = computed(() => {
    if (this.maxLength) {
      return this.maxLength;
    }
    return this.targetWord ? this.targetWord.length : 20; // Par défaut 20 si pas de targetWord
  });

  readonly letterBoxes = computed<LetterBox[]>(() => {
    const input = this.currentInput();
    const states = this.letterStates();
    const targetLength = this.effectiveMaxLength();
    const boxes: LetterBox[] = [];

    for (let i = 0; i < targetLength; i++) {
      const letter = i < input.length ? input[i].toUpperCase() : '?';
      const state = i < states.length ? states[i] : null;
      const isCursor = this.getCursorPosition() === i;

      boxes.push({
        letter,
        state,
        isCursor
      });
    }

    return boxes;
  });

  readonly isComplete = computed(() => {
    const input = this.currentInput();
    const states = this.letterStates();
    if (!this.targetWord) {
      return false; // Pas de validation si pas de targetWord
    }
    return input.length === this.targetWord.length && 
           WordValidationUtil.areAllLettersCorrect(states);
  });

  ngOnInit(): void {
    this.setupKeyboardListeners();
    this.setupMobileInput();
    
    // Focuser automatiquement l'input sur mobile après un court délai
    if (this.isMobileDevice()) {
      setTimeout(() => {
        if (this.mobileInput?.nativeElement && !this.disabled) {
          this.mobileInput.nativeElement.focus();
        }
      }, 300);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['targetWord'] && !changes['targetWord'].firstChange) {
      this.reset();
    }
  }

  /**
   * Configure les écouteurs de clavier
   */
  private setupKeyboardListeners(): void {
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));
  }

  /**
   * Configure l'input mobile pour déclencher le clavier
   */
  private setupMobileInput(): void {
    // L'input mobile sera géré dans le template avec (input) et (blur)
  }

  /**
   * Gère les touches du clavier
   */
  private handleKeyPress(e: KeyboardEvent): void {
    // Ignorer si un input est focus (sauf mobileInput)
    if (document.activeElement?.tagName === 'INPUT' && 
        (document.activeElement as HTMLElement).id !== 'mobileInput') {
      return;
    }

    // Ignorer si désactivé
    if (this.disabled) {
      return;
    }

    // Touche Backspace
    if (e.key === 'Backspace') {
      e.preventDefault();
      this.handleBackspace();
      return;
    }

    // Lettres (a-z, A-Z), nombres (0-9) et trait d'union si autorisé
    if (e.key.length === 1) {
      const isValidLetter = /[a-zA-Z0-9]/.test(e.key);
      const isValidHyphen = this.allowHyphen && e.key === '-';
      
      if (isValidLetter || isValidHyphen) {
        e.preventDefault();
        this.handleLetterInput(e.key);
      }
    }
  }

  /**
   * Gère la saisie d'une lettre
   */
  private handleLetterInput(letter: string): void {
    const current = this.currentInput();
    const maxLength = this.effectiveMaxLength();
    const consecutiveGreenCount = this.countConsecutiveGreenLetters();

    // Vérifier si on peut encore ajouter des lettres
    if (current.length >= maxLength) {
      return;
    }

    // Vérifier si on est à la position du curseur
    const cursorPos = this.getCursorPosition();
    if (cursorPos === -1 || cursorPos >= maxLength) {
      return;
    }

    // Si on a un targetWord et qu'on est sur une lettre verte, ne pas modifier
    if (this.targetWord) {
      const states = this.letterStates();
      if (cursorPos < states.length && states[cursorPos] === 'correct') {
        // Ne pas modifier une lettre verte
        return;
      }
    }

    // Construire le nouvel input
    let newInput = current;
    if (cursorPos < current.length) {
      // Remplacer la lettre à la position du curseur
      newInput = current.substring(0, cursorPos) + letter + current.substring(cursorPos + 1);
    } else {
      // Ajouter la lettre
      newInput = current + letter;
    }

    // Limiter la longueur
    if (newInput.length > maxLength) {
      newInput = newInput.substring(0, maxLength);
    }

    // S'assurer que les lettres vertes au début sont préservées (seulement si on a un targetWord)
    if (this.targetWord && consecutiveGreenCount > 0) {
      const greenLetters = current.substring(0, consecutiveGreenCount);
      if (!newInput.toUpperCase().startsWith(greenLetters)) {
        newInput = greenLetters + newInput.substring(consecutiveGreenCount);
      }
    }

    this.updateInput(newInput);
  }

  /**
   * Gère le backspace
   */
  private handleBackspace(): void {
    const current = this.currentInput();
    const consecutiveGreenCount = this.countConsecutiveGreenLetters();

    if (current.length === 0) {
      return;
    }

    // Empêcher de supprimer les lettres vertes (seulement si on a un targetWord)
    if (this.targetWord && current.length <= consecutiveGreenCount) {
      return;
    }

    const newInput = current.slice(0, -1);
    this.updateInput(newInput);
  }

  /**
   * Met à jour l'input et déclenche la validation
   */
  private updateInput(newInput: string): void {
    this.previousInputValue.set(this.currentInput());
    this.currentInput.set(newInput);

    // Analyser la tentative seulement si on a un targetWord
    let result: LetterAnalysisResult | null = null;
    if (newInput.length > 0 && this.targetWord) {
      result = WordValidationUtil.analyzeGuess(newInput, this.targetWord);
      this.letterStates.set(result.letterStates);
    } else {
      // Mode saisie libre : pas de validation, toutes les lettres sont neutres
      this.letterStates.set([]);
    }

    // Émettre les événements
    this.wordChange.emit(newInput);

    // Vérifier si le mot est complet et correct (seulement si on a un targetWord)
    if (this.targetWord && this.isComplete()) {
      this.wordComplete.emit(newInput);
    }
  }

  /**
   * Gère l'input mobile
   */
  onMobileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.toUpperCase();
    const previous = this.previousInputValue();

    if (value.length > previous.length) {
      // Nouvelle lettre ajoutée
      const newLetter = value[value.length - 1];
      if (/[A-Z0-9-]/.test(newLetter)) {
        this.handleLetterInput(newLetter);
      }
    } else if (value.length < previous.length) {
      // Backspace
      this.handleBackspace();
    }

    this.previousInputValue.set(value);

    // Réinitialiser l'input pour permettre de continuer la saisie
    setTimeout(() => {
      if (input) {
        input.value = '';
        this.previousInputValue.set('');
      }
    }, 10);
  }

  /**
   * Gère le focus sur mobile
   */
  onMobileFocus(): void {
    // Focus automatique sur mobile
  }

  /**
   * Gère le blur sur mobile
   */
  onMobileBlur(): void {
    // Ne pas refocus automatiquement si on est sur un autre input/select
    const activeElement = document.activeElement;
    const isInput = activeElement?.tagName === 'INPUT';
    const isSelect = activeElement?.tagName === 'SELECT';

    if (!isInput && !isSelect && this.isMobileDevice()) {
      setTimeout(() => {
        if (this.mobileInput && !this.isComplete()) {
          this.mobileInput.nativeElement?.focus();
        }
      }, 100);
    }
  }

  /**
   * Gère le clic sur l'input mobile pour le focuser
   */
  onMobileInputClick(): void {
    if (this.isMobileDevice() && this.mobileInput?.nativeElement) {
      this.mobileInput.nativeElement.focus();
    }
  }

  /**
   * Gère le clic sur la zone d'affichage des lettres pour focuser l'input mobile
   */
  onWordDisplayClick(): void {
    if (this.disabled || this.isComplete()) {
      return;
    }
    
    if (this.isMobileDevice() && this.mobileInput?.nativeElement) {
      // Focuser l'input pour déclencher le clavier
      this.mobileInput.nativeElement.focus();
    }
  }

  /**
   * Détecte si on est sur un appareil mobile
   */
  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
  }

  /**
   * Obtient la position du curseur (première boîte non-verte ou première boîte vide)
   */
  private getCursorPosition(): number {
    const states = this.letterStates();
    const input = this.currentInput();
    const maxLength = this.effectiveMaxLength();

    // Si pas de targetWord, le curseur est simplement après la dernière lettre
    if (!this.targetWord) {
      return input.length < maxLength ? input.length : -1;
    }

    // Sinon, chercher la première boîte non-verte
    for (let i = 0; i < maxLength; i++) {
      if (i >= states.length || states[i] !== 'correct') {
        return i;
      }
    }

    return -1;
  }

  /**
   * Compte les lettres vertes consécutives depuis le début
   */
  private countConsecutiveGreenLetters(): number {
    return WordValidationUtil.countConsecutiveGreenLetters(this.letterStates());
  }

  /**
   * Réinitialise la saisie
   */
  reset(): void {
    this.currentInput.set('');
    this.previousInputValue.set('');
    this.letterStates.set([]);
    
    // Réinitialiser l'input mobile
    if (this.mobileInput?.nativeElement) {
      this.mobileInput.nativeElement.value = '';
    }
  }

  /**
   * Obtient l'input actuel
   */
  getCurrentInput(): string {
    return this.currentInput();
  }

  /**
   * Vérifie si le mot est complet et correct
   */
  isWordComplete(): boolean {
    return this.isComplete();
  }

  /**
   * Obtient les classes CSS pour une boîte de lettre
   */
  getLetterBoxClasses(box: LetterBox): string {
    const classes = ['letter-box'];
    
    if (box.state === 'correct') {
      classes.push('letter-correct');
    } else if (box.state === 'wrong-place') {
      classes.push('letter-wrong-place');
    } else if (box.state === 'wrong') {
      classes.push('letter-wrong');
    }
    
    if (box.isCursor) {
      classes.push('letter-cursor');
    }
    
    return classes.join(' ');
  }
}

