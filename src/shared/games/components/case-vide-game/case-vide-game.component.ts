import { Component, Input, Output, EventEmitter, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import type { CaseVideData } from '../../types/game-data';
import { GameErrorActionsComponent } from '../game-error-actions/game-error-actions.component';

@Component({
  selector: 'app-case-vide-game',
  standalone: true,
  imports: [CommonModule, DragDropModule, GameErrorActionsComponent],
  templateUrl: './case-vide-game.component.html',
  styleUrl: './case-vide-game.component.scss',
})
export class CaseVideGameComponent implements OnInit {
  @Input({ required: true }) caseVideData!: CaseVideData;
  @Input() showResult = false;
  @Input() disabled = false;
  @Input() aides: string[] | null = null; // Aides pour le jeu
  @Input() instructions: string | null = null; // Instructions pour le jeu
  @Input() question: string | null = null; // Question pour le jeu
  
  @Output() validated = new EventEmitter<boolean>();
  @Output() nextRequested = new EventEmitter<void>();

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
  
  // État pour afficher/masquer les aides
  showAides = signal<boolean>(false);

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
    const isUserAnswerCorrect = userAnswer?.toLowerCase().trim() === caseVide.reponse_correcte.toLowerCase().trim();
    
    // Si la réponse globale est incorrecte, ne pas révéler AUCUN feedback (ni vert ni rouge)
    // pour éviter que l'utilisateur déduise les bonnes réponses
    const globalIsCorrect = this.isCorrect();
    if (globalIsCorrect === false || globalIsCorrect === null) {
      // Si la réponse globale est incorrecte, retourner null pour toutes les cases
      // pour ne pas afficher de feedback visuel (ni correct ni incorrect)
      return null;
    }
    
    // Seulement si la réponse globale est correcte, on peut révéler les bonnes et mauvaises réponses
    return isUserAnswerCorrect;
  }

  onWordDrop(event: CdkDragDrop<string[]>, caseIndex: number): void {
    if (this.disabled || this.isSubmitted()) return;
    
    // Récupérer le mot qui est déplacé AVANT transferArrayItem
    const draggedWord = event.previousContainer.data[event.previousIndex];
    if (!draggedWord) return;
    
    const answers = new Map(this.userCaseVideAnswers());
    const used = new Set(this.usedWords());
    const available = [...this.availableWords()];
    const caseLists = new Map(this.caseDropLists());
    
    // Récupérer le mot déjà présent dans la case de destination (si existe)
    const previousWordInCase = caseLists.get(caseIndex)?.[0];
    
    if (event.previousContainer.id === 'banque-mots') {
      // Glisser depuis la banque de mots vers une case
      
      // Si la case contient déjà un mot, le remettre dans la banque AVANT le transfert
      if (previousWordInCase) {
        used.delete(previousWordInCase);
        answers.delete(caseIndex);
        // Remettre le mot précédent dans la banque
        const previousWordIndex = available.findIndex(w => w === previousWordInCase);
        if (previousWordIndex === -1) {
          available.push(previousWordInCase);
          // Insérer le mot à la position appropriée dans event.previousContainer.data
          event.previousContainer.data.push(previousWordInCase);
        }
      }
      
      // Retirer le nouveau mot de la banque
      const wordIndex = available.indexOf(draggedWord);
      if (wordIndex > -1) {
        available.splice(wordIndex, 1);
      }
      
      // Ajouter le nouveau mot à la case
      answers.set(caseIndex, draggedWord);
      used.add(draggedWord);
      caseLists.set(caseIndex, [draggedWord]);
      
      // Effectuer le transfert visuel (doit être fait après la mise à jour des signaux)
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex >= 0 ? event.currentIndex : 0
      );
      
      // Mettre à jour les signaux
      this.userCaseVideAnswers.set(answers);
      this.usedWords.set(used);
      this.availableWords.set(available);
      this.caseDropLists.set(caseLists);
    } else if (event.previousContainer.id.startsWith('case-')) {
      // Glisser d'une case vers une autre case
      const previousCaseIndex = parseInt(event.previousContainer.id.replace('case-', ''), 10);
      
      // Retirer le mot de la case source
      answers.delete(previousCaseIndex);
      caseLists.set(previousCaseIndex, previousWordInCase ? [previousWordInCase] : []);
      
      // Si la case de destination contient déjà un mot, le mettre dans la case source
      if (previousWordInCase && previousWordInCase !== draggedWord) {
        answers.set(previousCaseIndex, previousWordInCase);
      }
      
      // Mettre le nouveau mot dans la case de destination
      answers.set(caseIndex, draggedWord);
      caseLists.set(caseIndex, [draggedWord]);
      
      // Effectuer le transfert visuel
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex >= 0 ? event.currentIndex : 0
      );
      
      // Mettre à jour les signaux
      this.userCaseVideAnswers.set(answers);
      this.caseDropLists.set(caseLists);
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

  toggleAides(): void {
    this.showAides.update(v => !v);
  }
}

