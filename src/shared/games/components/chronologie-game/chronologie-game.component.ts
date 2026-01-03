import { Component, Input, Output, EventEmitter, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import type { ChronologieData } from '../../types/game-data';
import { GameErrorActionsComponent } from '../game-error-actions/game-error-actions.component';

@Component({
  selector: 'app-chronologie-game',
  standalone: true,
  imports: [CommonModule, DragDropModule, GameErrorActionsComponent],
  templateUrl: './chronologie-game.component.html',
  styleUrl: './chronologie-game.component.scss',
})
export class ChronologieGameComponent implements OnInit {
  @Input({ required: true }) chronologieData!: ChronologieData;
  @Input() showResult = false; // Pour afficher les résultats après validation
  @Input() disabled = false; // Pour désactiver l'interaction
  @Input() aides: string[] | null = null; // Aides pour le jeu
  @Input() instructions: string | null = null; // Instructions pour le jeu
  @Input() question: string | null = null; // Question pour le jeu
  
  @Output() orderChanged = new EventEmitter<string[]>();
  @Output() validated = new EventEmitter<boolean>();
  @Output() nextRequested = new EventEmitter<void>();
  @Output() resetRequested = new EventEmitter<void>();

  // Mots dans l'ordre actuel (mélangés initialement)
  currentOrder = signal<string[]>([]);
  
  // État de validation
  isSubmitted = signal<boolean>(false);
  isCorrect = signal<boolean | null>(null);
  
  // État pour afficher/masquer les aides
  showAides = signal<boolean>(false);

  ngOnInit(): void {
    this.shuffleMots();
  }

  /**
   * Mélange les mots de manière aléatoire au départ
   */
  private shuffleMots(): void {
    const mots = [...this.chronologieData.mots];
    
    // Mélanger avec Fisher-Yates
    for (let i = mots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mots[i], mots[j]] = [mots[j], mots[i]];
    }
    
    this.currentOrder.set(mots);
  }

  /**
   * Gère le drop lors du drag and drop
   */
  drop(event: CdkDragDrop<string[]>): void {
    if (this.disabled || this.isSubmitted()) return;
    
    const newOrder = [...this.currentOrder()];
    moveItemInArray(newOrder, event.previousIndex, event.currentIndex);
    this.currentOrder.set(newOrder);
    
    // Émettre le nouvel ordre
    this.orderChanged.emit(newOrder);
  }

  /**
   * Valide la réponse
   */
  validate(): void {
    if (this.isSubmitted()) return;
    
    const currentOrder = this.currentOrder();
    const correctOrder = [...this.chronologieData.ordre_correct];
    
    // Comparer les deux tableaux
    const isValid = 
      currentOrder.length === correctOrder.length &&
      currentOrder.every((mot, index) => mot === correctOrder[index]);
    
    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
    this.validated.emit(isValid);
  }

  /**
   * Réinitialise le jeu
   */
  reset(): void {
    this.isSubmitted.set(false);
    this.isCorrect.set(null);
    this.shuffleMots(); // Remélange pour un nouvel essai
    // Émettre l'événement vers le parent pour qu'il réinitialise aussi son état
    this.resetRequested.emit();
  }

  /**
   * Vérifie si un mot est à la bonne position (après validation)
   * Ne retourne true que si la réponse globale est correcte
   */
  isWordCorrect(index: number): boolean {
    if (!this.isSubmitted() || !this.showResult || !this.isCorrect()) return false;
    const currentOrder = this.currentOrder();
    const correctOrder = this.chronologieData.ordre_correct;
    return currentOrder[index] === correctOrder[index];
  }

  toggleAides(): void {
    this.showAides.update(v => !v);
  }
}

