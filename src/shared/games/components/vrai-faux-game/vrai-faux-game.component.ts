import { Component, Input, Output, EventEmitter, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { VraiFauxData } from '../../types/game-data';

@Component({
  selector: 'app-vrai-faux-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vrai-faux-game.component.html',
  styleUrl: './vrai-faux-game.component.scss',
})
export class VraiFauxGameComponent implements OnInit {
  @Input({ required: true }) vraiFauxData!: VraiFauxData;
  @Input() showResult = false;
  @Input() disabled = false;
  
  @Output() validated = new EventEmitter<boolean>();

  // Énoncés mélangés
  shuffledEnonces = signal<{ texte: string; reponse_correcte: boolean }[]>([]);

  // Réponses de l'utilisateur (index → réponse)
  userAnswers = signal<Map<number, boolean>>(new Map());

  // État de validation
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
    this.shuffleVraiFauxData();
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  shuffleVraiFauxData(): void {
    if (this.vraiFauxData) {
      this.shuffledEnonces.set(this.shuffleArray([...this.vraiFauxData.enonces]));
    } else {
      this.shuffledEnonces.set([]);
    }
  }

  getVraiFauxEnonces(): { texte: string; reponse_correcte: boolean }[] {
    return this.shuffledEnonces().length > 0 ? this.shuffledEnonces() : (this.vraiFauxData?.enonces || []);
  }

  selectAnswer(index: number, reponse: boolean): void {
    if (this.disabled || this.isSubmitted()) return;
    const answers = new Map(this.userAnswers());
    answers.set(index, reponse);
    this.userAnswers.set(answers);
  }

  isAnswerSelected(index: number, reponse: boolean): boolean {
    return this.userAnswers().get(index) === reponse;
  }

  isCorrectAnswer(index: number): boolean | null {
    if (!this.showResult && !this.isSubmitted()) return null;
    const enonces = this.getVraiFauxEnonces();
    if (index < 0 || index >= enonces.length) return null;
    const enonce = enonces[index];
    if (!enonce) return null;
    const userAnswer = this.userAnswers().get(index);
    if (userAnswer === undefined) return null;
    return userAnswer === enonce.reponse_correcte;
  }

  submitVraiFaux(): void {
    if (this.disabled || this.isSubmitted()) return;
    const enonces = this.getVraiFauxEnonces();
    if (enonces.length === 0) return;

    const userAnswers = this.userAnswers();
    
    // Vérifier que tous les énoncés ont une réponse
    if (userAnswers.size !== enonces.length) {
      return;
    }

    // Vérifier si toutes les réponses sont correctes
    const isValid = enonces.every((enonce, index) => {
      const userAnswer = userAnswers.get(index);
      return userAnswer === enonce.reponse_correcte;
    });

    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
    this.validated.emit(isValid);
  }

  reset(): void {
    this.userAnswers.set(new Map());
    this.isSubmitted.set(false);
    this.isCorrect.set(null);
    this.shuffleVraiFauxData();
  }

  canSubmit(): boolean {
    return this.userAnswers().size === this.getVraiFauxEnonces().length;
  }
}

