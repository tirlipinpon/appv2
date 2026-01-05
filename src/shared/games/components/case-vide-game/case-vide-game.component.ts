import { Component, Input, Output, EventEmitter, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import type { CaseVideData } from '../../types/game-data';
import { GameErrorActionsComponent } from '../game-error-actions/game-error-actions.component';
import { AideSectionComponent } from '../../../components/aide-section/aide-section.component';

// Interface pour représenter une instance unique d'un mot
interface WordInstance {
  id: string; // Identifiant unique pour chaque instance
  word: string; // Le texte du mot
}

// Interface pour les parts de texte parsées avec cases
interface ParsedTextePart {
  type: 'text' | 'case';
  content: string;
  index?: number; // Index original du placeholder (pour validation)
  uniqueId?: string; // ID unique pour CDK (ex: "case-1-pos-0", "case-1-pos-1")
}

@Component({
  selector: 'app-case-vide-game',
  standalone: true,
  imports: [CommonModule, DragDropModule, GameErrorActionsComponent, AideSectionComponent],
  templateUrl: './case-vide-game.component.html',
  styleUrl: './case-vide-game.component.scss',
})
export class CaseVideGameComponent implements OnInit {
  @Input({ required: true }) caseVideData!: CaseVideData;
  @Input() showResult = false;
  @Input() disabled = false;
  @Input() aides: string[] | null = null; // Aides pour le jeu
  @Input() aideImageUrl: string | null = null; // URL de l'image d'aide
  @Input() aideVideoUrl: string | null = null; // URL de la vidéo d'aide
  @Input() instructions: string | null = null; // Instructions pour le jeu
  @Input() question: string | null = null; // Question pour le jeu
  
  @Output() validated = new EventEmitter<boolean>();
  @Output() nextRequested = new EventEmitter<void>();
  @Output() resetRequested = new EventEmitter<void>();

  // Signaux pour Case Vide
  userCaseVideAnswers = signal<Map<number, string>>(new Map());
  shuffledBanqueMots = signal<string[]>([]);
  availableWords = signal<WordInstance[]>([]); // Utiliser WordInstance[] au lieu de string[]
  usedWords = signal<Set<string>>(new Set()); // Garde le texte pour la validation
  caseDropLists = signal<Map<string, WordInstance[]>>(new Map()); // Utiliser uniqueId comme clé au lieu de index
  parsedTexteParts = signal<ParsedTextePart[]>([]);
  caseUniqueIdToIndex = signal<Map<string, number>>(new Map()); // Correspondance uniqueId -> index pour validation
  caseVideUserAnswer = signal<string>(''); // Pour l'ancien format
  isSubmitted = signal<boolean>(false);
  isCorrect = signal<boolean | null>(null);
  
  // Compteur pour générer des IDs uniques
  private wordInstanceCounter = 0;
  

  ngOnInit(): void {
    this.initializeCaseVide();
  }

  // Méthode pour initialiser complètement Case Vide
  private initializeCaseVide(): void {
    const caseVideData = this.caseVideData;
    if (!caseVideData) return;
    
    // Parser le texte avec cases
    if (caseVideData.texte) {
      const parsedParts = this.parseTexteWithCases(caseVideData.texte);
      this.parsedTexteParts.set(parsedParts);
      
      // Créer la Map de correspondance uniqueId -> index
      const uniqueIdToIndexMap = new Map<string, number>();
      parsedParts.forEach(part => {
        if (part.type === 'case' && part.uniqueId && part.index !== undefined) {
          uniqueIdToIndexMap.set(part.uniqueId, part.index);
        }
      });
      this.caseUniqueIdToIndex.set(uniqueIdToIndexMap);
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
      
      // Réinitialiser le compteur pour chaque nouvelle initialisation
      this.wordInstanceCounter = 0;
      
      // Créer des WordInstance avec des IDs uniques pour chaque mot
      const wordInstances: WordInstance[] = shuffled.map(word => ({
        id: `word-${this.wordInstanceCounter++}`,
        word: word
      }));
      this.availableWords.set(wordInstances);
      
      // Initialiser les listes de drop pour toutes les cases vides (utiliser uniqueId comme clé)
      const caseLists = new Map<string, WordInstance[]>();
      const parsedParts = this.parsedTexteParts();
      parsedParts.forEach(part => {
        if (part.type === 'case' && part.uniqueId) {
          caseLists.set(part.uniqueId, []);
        }
      });
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

  private parseTexteWithCases(texte: string): ParsedTextePart[] {
    if (!texte) return [];
    
    const parts: ParsedTextePart[] = [];
    const placeholderRegex = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match;
    let casePositionCounter = 0; // Compteur pour générer des IDs uniques basés sur la position
    
    while ((match = placeholderRegex.exec(texte)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: texte.substring(lastIndex, match.index),
        });
      }
      const caseIndex = parseInt(match[1], 10);
      // Générer un ID unique basé sur l'index ET la position dans le texte
      const uniqueId = `case-${caseIndex}-pos-${casePositionCounter++}`;
      parts.push({
        type: 'case',
        content: match[0],
        index: caseIndex,
        uniqueId: uniqueId,
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

  getAvailableWords(): WordInstance[] {
    return this.availableWords();
  }

  parseTexteWithCasesParts(): ParsedTextePart[] {
    return this.parsedTexteParts();
  }

  getWordInCase(caseIndex: number): string | undefined {
    return this.userCaseVideAnswers().get(caseIndex);
  }

  getCaseDropListData(uniqueId: string): WordInstance[] {
    const caseList = this.caseDropLists().get(uniqueId) || [];
    // Retourner directement la liste (pas de copie pour éviter les boucles infinies)
    return caseList;
  }

  getCaseIndexFromUniqueId(uniqueId: string): number | undefined {
    return this.caseUniqueIdToIndex().get(uniqueId);
  }

  readonly connectedDropListIds = computed(() => {
    const ids: string[] = ['banque-mots'];
    // Utiliser parsedTexteParts pour être sûr d'avoir tous les IDs des cases dans le template
    const parts = this.parsedTexteParts();
    parts.forEach(part => {
      if (part.type === 'case' && part.uniqueId) {
        ids.push(part.uniqueId);
      }
    });
    return ids;
  });

  isWordUsed(wordInstance: WordInstance): boolean {
    // Vérifier si cette instance spécifique est dans une case (pas seulement si le texte est utilisé)
    const caseLists = this.caseDropLists();
    let isUsed = false;
    for (const wordInstances of caseLists.values()) {
      if (wordInstances.some(w => w.id === wordInstance.id)) {
        isUsed = true;
        break;
      }
    }
    return isUsed;
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

  onWordDrop(event: CdkDragDrop<WordInstance[]>, uniqueId: string): void {
    if (this.disabled || this.isSubmitted()) return;
    
    const draggedWord = event.previousContainer.data[event.previousIndex];
    if (!draggedWord) return;
    
    // Obtenir l'index original pour la validation
    const caseIndex = this.getCaseIndexFromUniqueId(uniqueId);
    if (caseIndex === undefined) return;
    
    const answers = new Map(this.userCaseVideAnswers());
    const used = new Set(this.usedWords());
    const caseLists = new Map(this.caseDropLists());
    
    if (event.previousContainer.id === 'banque-mots') {
      // Glisser depuis la banque de mots vers une case
      
      // Si la case contient déjà un mot, le remettre dans la banque
      let returnedWordInstance: WordInstance | null = null;
      const previousWordInCase = caseLists.get(uniqueId)?.[0];
      if (previousWordInCase) {
        used.delete(previousWordInCase.word);
        answers.delete(caseIndex);
        // Créer une nouvelle instance pour le mot remis dans la banque
        returnedWordInstance = {
          id: `word-${this.wordInstanceCounter++}`,
          word: previousWordInCase.word
        };
        caseLists.set(uniqueId, []);
      }
      
      // Mettre à jour les réponses et les mots utilisés
      answers.set(caseIndex, draggedWord.word);
      used.add(draggedWord.word);
      
      // SOLUTION RADICALE : Ne PAS utiliser transferArrayItem du tout
      // Mettre à jour les signaux AVANT que CDK ne traite le drop
      // Cela évite toute confusion visuelle car CDK voit directement les bonnes données
      
      // 1. Créer le nouveau tableau de mots disponibles (filtrer par ID)
      const newAvailableWords: WordInstance[] = this.availableWords()
        .filter(w => w.id !== draggedWord.id)
        .map(w => ({ ...w })); // Nouvelle référence pour chaque mot restant
      
      // Ajouter le mot retourné à la banque s'il existe
      if (returnedWordInstance) {
        newAvailableWords.push(returnedWordInstance);
      }
      
      // 2. Créer une nouvelle référence pour le mot glissé
      const draggedWordCopy: WordInstance = { ...draggedWord };
      caseLists.set(uniqueId, [draggedWordCopy]);
      
      // 3. Mettre à jour TOUS les signaux AVANT que CDK ne fasse quoi que ce soit
      this.availableWords.set(newAvailableWords);
      this.caseDropLists.set(caseLists);
      this.userCaseVideAnswers.set(answers);
      this.usedWords.set(used);
      
      // 4. Maintenant synchroniser les tableaux CDK avec les nouveaux tableaux
      // CDK verra directement les bonnes données, sans confusion
      event.previousContainer.data.length = 0;
      event.previousContainer.data.push(...newAvailableWords);
      event.container.data.length = 0;
      event.container.data.push(draggedWordCopy);
    } else if (event.previousContainer.id.startsWith('case-')) {
      // Glisser d'une case vers une autre case
      const previousUniqueId = event.previousContainer.id;
      const previousCaseIndex = this.getCaseIndexFromUniqueId(previousUniqueId);
      if (previousCaseIndex === undefined) return;
      
      // Retirer le mot de la case source
      answers.delete(previousCaseIndex);
      caseLists.set(previousUniqueId, []);
      
      // Si la case de destination contient déjà un mot, le mettre dans la case source
      const previousWordInCase = caseLists.get(uniqueId)?.[0];
      if (previousWordInCase && previousWordInCase.id !== draggedWord.id) {
        answers.set(previousCaseIndex, previousWordInCase.word);
        caseLists.set(previousUniqueId, [previousWordInCase]);
      }
      
      // Mettre le nouveau mot dans la case de destination
      answers.set(caseIndex, draggedWord.word);
      caseLists.set(uniqueId, [draggedWord]);
      
      // Effectuer le transfert visuel
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex >= 0 ? event.currentIndex : 0
      );
      
      // Mettre à jour les signaux avec les tableaux modifiés
      caseLists.set(previousUniqueId, [...event.previousContainer.data]);
      caseLists.set(uniqueId, [...event.container.data]);
      this.caseDropLists.set(caseLists);
      this.userCaseVideAnswers.set(answers);
    }
  }

  removeWordFromCase(uniqueId: string): void {
    if (this.disabled || this.isSubmitted()) return;
    
    const caseIndex = this.getCaseIndexFromUniqueId(uniqueId);
    if (caseIndex === undefined) return;
    
    const answers = new Map(this.userCaseVideAnswers());
    const used = new Set(this.usedWords());
    const caseLists = new Map(this.caseDropLists());
    
    const wordInstance = caseLists.get(uniqueId)?.[0];
    if (wordInstance) {
      const wordText = wordInstance.word;
      answers.delete(caseIndex);
      used.delete(wordText);
      caseLists.set(uniqueId, []);
      
      const available = [...this.availableWords()];
      // Remettre l'instance de mot dans la banque (créer une nouvelle instance avec un nouvel ID)
      available.push({
        id: `word-${this.wordInstanceCounter++}`,
        word: wordText
      });
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

  onResetRequested(): void {
    // Réinitialiser l'état interne du composant
    this.reset();
    // Émettre l'événement vers le parent pour qu'il puisse aussi réinitialiser son état
    this.resetRequested.emit();
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

