import { Component, Input, Output, EventEmitter, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ReponseLibreData } from '../../types/game-data';
import { GameErrorActionsComponent } from '../game-error-actions/game-error-actions.component';
import { LetterByLetterInputComponent } from '../../../components/letter-by-letter-input/letter-by-letter-input.component';
import { AideSectionComponent } from '../../../components/aide-section/aide-section.component';

@Component({
  selector: 'app-reponse-libre-game',
  standalone: true,
  imports: [CommonModule, GameErrorActionsComponent, LetterByLetterInputComponent, AideSectionComponent],
  templateUrl: './reponse-libre-game.component.html',
  styleUrl: './reponse-libre-game.component.scss',
})
export class ReponseLibreGameComponent implements OnInit {
  @Input({ required: true }) reponseLibreData!: ReponseLibreData;
  @Input() showResult = false; // Pour afficher les résultats après validation
  @Input() disabled = false; // Pour désactiver l'interaction
  @Input() aides: string[] | null = null; // Aides pour le jeu
  @Input() aideImageUrl: string | null = null; // URL de l'image d'aide
  @Input() aideVideoUrl: string | null = null; // URL de la vidéo d'aide
  @Input() instructions: string | null = null; // Instructions pour le jeu
  @Input() question: string | null = null; // Question pour le jeu
  
  @Output() answerChanged = new EventEmitter<string>();
  @Output() validated = new EventEmitter<boolean>();
  @Output() resetRequested = new EventEmitter<void>();
  @Output() nextRequested = new EventEmitter<void>();

  
  // Réponse de l'utilisateur
  userAnswer = signal<string>('');
  
  // État de validation
  isSubmitted = signal<boolean>(false);
  isCorrect = signal<boolean | null>(null);

  ngOnInit(): void {
    // Initialisation si nécessaire
  }

  /**
   * Gère le changement de mot dans l'input
   */
  onWordChange(word: string): void {
    if (this.disabled || this.isSubmitted()) return;
    this.userAnswer.set(word);
    this.answerChanged.emit(word);
  }

  /**
   * Gère la complétion automatique du mot (quand il est correct)
   */
  onWordComplete(): void {
    if (this.disabled || this.isSubmitted()) return;
    // Si le mot est complet et correct, on valide automatiquement
    this.validate();
  }

  /**
   * Valide la réponse
   */
  validate(): void {
    if (this.isSubmitted() || !this.userAnswer().trim()) return;
    
    const userAnswer = this.userAnswer().trim().toLowerCase();
    const correctAnswer = this.reponseLibreData.reponse_valide.trim().toLowerCase();
    
    const isValid = userAnswer === correctAnswer;
    
    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
    this.validated.emit(isValid);
  }

  /**
   * Réinitialise le jeu
   */
  reset(): void {
    this.userAnswer.set('');
    this.isSubmitted.set(false);
    this.isCorrect.set(null);
    this.resetRequested.emit(); // Notifier le parent pour réinitialiser son état
  }

  /**
   * Vérifie si on peut valider (au moins une lettre saisie)
   */
  canValidate(): boolean {
    return !this.isSubmitted() && this.userAnswer().trim().length > 0;
  }

  /**
   * Obtient la réponse valide
   */
  getReponseValide(): string {
    return this.reponseLibreData?.reponse_valide || '';
  }
}
