import { Component, Input, Output, EventEmitter, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { QcmData } from '../../types/game-data';
import { GameErrorActionsComponent } from '../game-error-actions/game-error-actions.component';
import { AideSectionComponent } from '../../../components/aide-section/aide-section.component';

interface ShuffledProposition {
  originalIndex: number;
  text: string;
  letter: string;
}

@Component({
  selector: 'app-qcm-game',
  standalone: true,
  imports: [CommonModule, GameErrorActionsComponent, AideSectionComponent],
  templateUrl: './qcm-game.component.html',
  styleUrl: './qcm-game.component.scss',
})
export class QcmGameComponent implements OnInit {
  @Input({ required: true }) qcmData!: QcmData;
  @Input() showResult = false; // Pour afficher les résultats après validation
  @Input() disabled = false; // Pour désactiver l'interaction
  @Input() aides: string[] | null = null; // Aides pour le jeu
  @Input() aideImageUrl: string | null = null; // URL de l'image d'aide
  @Input() aideVideoUrl: string | null = null; // URL de la vidéo d'aide
  @Input() instructions: string | null = null; // Instructions pour le jeu
  @Input() question: string | null = null; // Question pour le jeu
  
  @Output() answerSelected = new EventEmitter<string[]>();
  @Output() validated = new EventEmitter<boolean>();
  @Output() resetRequested = new EventEmitter<void>();
  @Output() nextRequested = new EventEmitter<void>();

  // Propositions mélangées avec leur lettre (A, B, C...)
  shuffledPropositions = signal<ShuffledProposition[]>([]);
  
  
  // Réponses sélectionnées (par lettre: A, B, C...)
  selectedLetters = signal<Set<string>>(new Set());
  
  // État de validation
  isSubmitted = signal<boolean>(false);
  isCorrect = signal<boolean | null>(null);

  // Lettres de l'alphabet
  private readonly letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  ngOnInit(): void {
    this.shufflePropositions();
  }

  /**
   * Mélange les propositions de manière aléatoire
   */
  private shufflePropositions(): void {
    const propositions = [...this.qcmData.propositions];
    const shuffled: ShuffledProposition[] = [];
    
    // Mélanger avec Fisher-Yates
    for (let i = propositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [propositions[i], propositions[j]] = [propositions[j], propositions[i]];
    }
    
    // Créer les objets avec lettre et index original
    propositions.forEach((prop, index) => {
      shuffled.push({
        originalIndex: this.qcmData.propositions.indexOf(prop),
        text: prop,
        letter: this.letters[index]
      });
    });
    
    this.shuffledPropositions.set(shuffled);
  }

  /**
   * Toggle la sélection d'une proposition par sa lettre
   */
  toggleSelection(letter: string): void {
    if (this.disabled || this.isSubmitted()) return;
    
    const selected = new Set(this.selectedLetters());
    if (selected.has(letter)) {
      selected.delete(letter);
    } else {
      selected.add(letter);
    }
    this.selectedLetters.set(selected);
    
    // Émettre les réponses sélectionnées (par texte, pas par lettre)
    const selectedTexts = this.getSelectedTexts();
    this.answerSelected.emit(selectedTexts);
  }

  /**
   * Retourne les textes des propositions sélectionnées
   */
  private getSelectedTexts(): string[] {
    const selected = this.selectedLetters();
    const shuffled = this.shuffledPropositions();
    return shuffled
      .filter(prop => selected.has(prop.letter))
      .map(prop => prop.text);
  }

  /**
   * Valide la réponse
   */
  validate(): void {
    if (this.isSubmitted() || this.selectedLetters().size === 0) return;
    
    const selectedTexts = this.getSelectedTexts();
    const correctAnswers = [...this.qcmData.reponses_valides];
    
    // Vérifier si toutes les réponses sélectionnées sont correctes et qu'il n'y en a pas trop
    const isValid = 
      selectedTexts.length === correctAnswers.length &&
      selectedTexts.every(text => correctAnswers.includes(text)) &&
      correctAnswers.every(answer => selectedTexts.includes(answer));
    
    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
    this.validated.emit(isValid);
  }

  /**
   * Réinitialise le jeu
   */
  reset(): void {
    this.selectedLetters.set(new Set());
    this.isSubmitted.set(false);
    this.isCorrect.set(null);
    this.shufflePropositions(); // Remélange pour un nouvel essai
    this.resetRequested.emit(); // Notifier le parent pour réinitialiser son état
  }

  /**
   * Vérifie si une proposition est correcte (après validation)
   * Ne retourne true que si la réponse globale est correcte
   */
  isPropositionCorrect(letter: string): boolean {
    if (!this.isSubmitted() || !this.showResult || !this.isCorrect()) return false;
    const shuffled = this.shuffledPropositions();
    const proposition = shuffled.find(p => p.letter === letter);
    if (!proposition) return false;
    return this.qcmData.reponses_valides.includes(proposition.text);
  }

  /**
   * Vérifie si une proposition est sélectionnée
   */
  isSelected(letter: string): boolean {
    return this.selectedLetters().has(letter);
  }

  /**
   * Vérifie si on peut valider (au moins une réponse sélectionnée)
   */
  canValidate(): boolean {
    return !this.isSubmitted() && this.selectedLetters().size > 0;
  }

}

