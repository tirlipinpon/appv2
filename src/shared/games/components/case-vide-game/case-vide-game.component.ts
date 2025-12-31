import { Component, Input, Output, EventEmitter, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import type { CaseVideData } from '../../types/game-data';

@Component({
  selector: 'app-case-vide-game',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './case-vide-game.component.html',
  styleUrl: './case-vide-game.component.scss',
})
export class CaseVideGameComponent implements OnInit {
  @Input({ required: true }) caseVideData!: CaseVideData;
  @Input() showResult = false;
  @Input() disabled = false;
  
  @Output() validated = new EventEmitter<boolean>();

  // Signaux pour Case Vide
  userCaseVideAnswers = signal<Map<number, string>>(new Map());
  shuffledBanqueMots = signal<string[]>([]);
  availableWords = signal<string[]>([]);
  usedWords = signal<Set<string>>(new Set());
  caseDropLists = signal<Map<number, string[]>>(new Map());
  parsedTexteParts = signal<{ type: 'text' | 'case'; content: string; index?: number }[]>([]);
  caseVideUserAnswer = signal<string>(''); // Pour l'ancien format
  isSubmitted = signal<boolean>(false);
  isCorrect = signal<boolean | null>(null);

  constructor() {
    // Effet pour réinitialiser quand showResult change
    effect(() => {
      if (this.showResult) {
        this.isSubmitted.set(true);
      }
    });
  }

  ngOnInit(): void {
    this.initializeCaseVide();
  }

  // Méthode pour initialiser complètement Case Vide
  private initializeCaseVide(): void {
    const caseVideData = this.caseVideData;
    if (!caseVideData) return;
    
    // Parser le texte avec cases
    if (caseVideData.texte) {
      this.parsedTexteParts.set(this.parseTexteWithCases(caseVideData.texte));
    }
    
    // Réinitialiser l'état utilisateur
    this.userCaseVideAnswers.set(new Map());
    this.usedWords.set(new Set());
    this.caseVideUserAnswer.set('');
    this.isSubmitted.set(false);
    this.isCorrect.set(null);
    
    // Mélanger la banque de mots
    if (caseVideData.banque_mots) {
      const shuffled = this.shuffleArray([...caseVideData.banque_mots]);
      this.shuffledBanqueMots.set(shuffled);
      this.availableWords.set([...shuffled]);
      
      // Initialiser les listes de drop pour toutes les cases vides
      const caseLists = new Map<number, string[]>();
      if (caseVideData.cases_vides) {
        caseVideData.cases_vides.forEach(caseVide => {
          caseLists.set(caseVide.index, []);
        });
      }
      this.caseDropLists.set(caseLists);
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private parseTexteWithCases(texte: string): { type: 'text' | 'case'; content: string; index?: number }[] {
    if (!texte) return [];
    
    const parts: { type: 'text' | 'case'; content: string; index?: number }[] = [];
    const placeholderRegex = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match;
    
    while ((match = placeholderRegex.exec(texte)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: texte.substring(lastIndex, match.index),
        });
      }
      const caseIndex = parseInt(match[1], 10);
      parts.push({
        type: 'case',
        content: match[0],
        index: caseIndex,
      });
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < texte.length) {
      parts.push({
        type: 'text',
        content: texte.substring(lastIndex),
      });
    }
    
    if (parts.length === 0) {
      parts.push({
        type: 'text',
        content: texte,
      });
    }
    
    return parts;
  }

  getAvailableWords(): string[] {
    return this.availableWords();
  }

  parseTexteWithCasesParts(): { type: 'text' | 'case'; content: string; index?: number }[] {
    return this.parsedTexteParts();
  }

  getWordInCase(caseIndex: number): string | undefined {
    return this.userCaseVideAnswers().get(caseIndex);
  }

  getCaseDropListData(caseIndex: number): string[] {
    return this.caseDropLists().get(caseIndex) || [];
  }

  readonly connectedDropListIds = computed(() => {
    const caseVideData = this.caseVideData;
    const ids: string[] = ['banque-mots'];
    if (caseVideData?.cases_vides) {
      caseVideData.cases_vides.forEach(caseVide => {
        ids.push(`case-${caseVide.index}`);
      });
    }
    return ids;
  });

  isWordUsed(word: string): boolean {
    return this.usedWords().has(word);
  }

  isCaseCorrect(caseIndex: number): boolean | null {
    if (!this.showResult && !this.isSubmitted()) return null;
    const caseVideData = this.caseVideData;
    if (!caseVideData?.cases_vides) return null;
    const caseVide = caseVideData.cases_vides.find(c => c.index === caseIndex);
    if (!caseVide) return null;
    const userAnswer = this.userCaseVideAnswers().get(caseIndex);
    return userAnswer?.toLowerCase().trim() === caseVide.reponse_correcte.toLowerCase().trim();
  }

  onWordDrop(event: CdkDragDrop<string[]>, caseIndex: number): void {
    if (this.disabled || this.isSubmitted()) return;
    
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex >= 0 ? event.currentIndex : 0
    );
    
    const answers = new Map(this.userCaseVideAnswers());
    const used = new Set(this.usedWords());
    const available = [...this.availableWords()];
    const caseLists = new Map(this.caseDropLists());
    
    if (event.previousContainer.id === 'banque-mots') {
      const word = event.container.data[0];
      if (!word) return;
      
      const previousWord = answers.get(caseIndex);
      if (previousWord && previousWord !== word) {
        used.delete(previousWord);
        available.push(previousWord);
        answers.delete(caseIndex);
      }
      
      answers.set(caseIndex, word);
      used.add(word);
      
      const wordIndex = available.indexOf(word);
      if (wordIndex > -1) {
        available.splice(wordIndex, 1);
      }
      
      caseLists.set(caseIndex, [word]);
      
      this.userCaseVideAnswers.set(answers);
      this.usedWords.set(used);
      this.availableWords.set(available);
      this.caseDropLists.set(caseLists);
    } else if (event.previousContainer.id.startsWith('case-')) {
      const previousCaseIndex = parseInt(event.previousContainer.id.replace('case-', ''), 10);
      const wordFromPrevious = event.container.data[0];
      const wordInNewCase = event.previousContainer.data[0];
      
      if (wordFromPrevious) {
        if (wordInNewCase) {
          answers.set(previousCaseIndex, wordInNewCase);
          caseLists.set(previousCaseIndex, [wordInNewCase]);
        } else {
          answers.delete(previousCaseIndex);
          caseLists.set(previousCaseIndex, []);
        }
        
        answers.set(caseIndex, wordFromPrevious);
        caseLists.set(caseIndex, [wordFromPrevious]);
        
        this.userCaseVideAnswers.set(answers);
        this.caseDropLists.set(caseLists);
      }
    }
  }

  removeWordFromCase(caseIndex: number): void {
    if (this.disabled || this.isSubmitted()) return;
    
    const answers = new Map(this.userCaseVideAnswers());
    const used = new Set(this.usedWords());
    const caseLists = new Map(this.caseDropLists());
    
    const word = answers.get(caseIndex);
    if (word) {
      answers.delete(caseIndex);
      used.delete(word);
      caseLists.set(caseIndex, []);
      
      const available = [...this.availableWords()];
      available.push(word);
      this.availableWords.set(available);
      
      this.userCaseVideAnswers.set(answers);
      this.usedWords.set(used);
      this.caseDropLists.set(caseLists);
    }
  }

  getCaseVideReponseValide(): string {
    const caseVideData = this.caseVideData;
    if (!caseVideData) return '';
    if (caseVideData.reponse_valide) {
      return caseVideData.reponse_valide;
    }
    if (caseVideData.cases_vides) {
      return caseVideData.cases_vides.map(c => c.reponse_correcte).join(', ');
    }
    return '';
  }

  submitCaseVide(): void {
    if (this.disabled || this.isSubmitted()) return;
    const caseVideData = this.caseVideData;
    if (!caseVideData) return;
    
    if (caseVideData.texte && caseVideData.cases_vides) {
      // Nouveau format : valider toutes les cases vides
      const allFilled = caseVideData.cases_vides.every(caseVide => 
        this.userCaseVideAnswers().has(caseVide.index)
      );
      
      if (!allFilled) {
        return;
      }
      
      const allCorrect = caseVideData.cases_vides.every(caseVide => {
        const userAnswer = this.userCaseVideAnswers().get(caseVide.index);
        return userAnswer?.toLowerCase().trim() === caseVide.reponse_correcte.toLowerCase().trim();
      });
      
      this.isSubmitted.set(true);
      this.isCorrect.set(allCorrect);
      this.validated.emit(allCorrect);
    } else if (caseVideData.debut_phrase && caseVideData.fin_phrase && caseVideData.reponse_valide) {
      // Ancien format : validation simple
      const isValid = this.caseVideUserAnswer().trim().toLowerCase() === caseVideData.reponse_valide.trim().toLowerCase();
      this.isSubmitted.set(true);
      this.isCorrect.set(isValid);
      this.validated.emit(isValid);
    }
  }

  reset(): void {
    this.initializeCaseVide();
  }

  canSubmit(): boolean {
    const caseVideData = this.caseVideData;
    if (!caseVideData) return false;
    
    if (caseVideData.texte && caseVideData.cases_vides) {
      return this.userCaseVideAnswers().size === (caseVideData.cases_vides?.length || 0);
    } else if (caseVideData.debut_phrase && caseVideData.fin_phrase) {
      return this.caseVideUserAnswer().trim().length > 0;
    }
    return false;
  }
}

