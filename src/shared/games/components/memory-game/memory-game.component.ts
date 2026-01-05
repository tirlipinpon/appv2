import { Component, Input, Output, EventEmitter, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { MemoryData } from '../../types/game-data';
import { GameErrorActionsComponent } from '../game-error-actions/game-error-actions.component';
import { AideSectionComponent } from '../../../components/aide-section/aide-section.component';

interface MemoryCard {
  id: number;
  content: string;
  type: 'question' | 'reponse';
  pairId: number; // ID de la paire (même pour question et réponse)
  isFlipped: boolean;
  isMatched: boolean;
}

@Component({
  selector: 'app-memory-game',
  standalone: true,
  imports: [CommonModule, GameErrorActionsComponent, AideSectionComponent],
  templateUrl: './memory-game.component.html',
  styleUrl: './memory-game.component.scss',
})
export class MemoryGameComponent implements OnInit {
  @Input({ required: true }) memoryData!: MemoryData;
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

  cards = signal<MemoryCard[]>([]);
  flippedCards = signal<number[]>([]); // IDs des cartes actuellement retournées (max 2)
  matchedPairs = signal<Set<number>>(new Set()); // IDs des paires trouvées
  isSubmitted = signal<boolean>(false);
  isCorrect = signal<boolean | null>(null);
  

  // Calcul du nombre de colonnes optimal pour l'affichage (responsive)
  gridColumns = computed(() => {
    const totalCards = this.cards().length;
    if (totalCards === 0) return 2;
    
    // Calculer le nombre optimal de colonnes pour avoir environ 2-3 lignes
    // Pour 4 cartes (2 paires) : 2 colonnes = 2 lignes de 2
    // Pour 6 cartes (3 paires) : 3 colonnes = 2 lignes de 3
    // Pour 8 cartes (4 paires) : 4 colonnes = 2 lignes de 4
    // Pour 12 cartes (6 paires) : 4 colonnes = 3 lignes de 4
    if (totalCards <= 4) return 2;
    if (totalCards <= 6) return 3;
    if (totalCards <= 8) return 4;
    if (totalCards <= 12) return 4;
    if (totalCards <= 16) return 4;
    return 4;
  });


  constructor() {
    // Effet pour gérer le retournement de 2 cartes
    effect(() => {
      const flipped = this.flippedCards();
      if (flipped.length === 2) {
        // Attendre un peu pour que l'utilisateur voie les 2 cartes
        setTimeout(() => {
          this.checkPair();
        }, 1000);
      }
    });
  }

  ngOnInit(): void {
    this.initializeCards();
  }

  /**
   * Initialise les cartes à partir des paires
   */
  private initializeCards(): void {
    const cards: MemoryCard[] = [];
    let cardId = 0;

    // Créer une carte pour chaque question et chaque réponse
    this.memoryData.paires.forEach((paire, pairIndex) => {
      // Carte question
      cards.push({
        id: cardId++,
        content: paire.question,
        type: 'question',
        pairId: pairIndex,
        isFlipped: false,
        isMatched: false,
      });

      // Carte réponse
      cards.push({
        id: cardId++,
        content: paire.reponse,
        type: 'reponse',
        pairId: pairIndex,
        isFlipped: false,
        isMatched: false,
      });
    });

    // Mélanger les cartes
    this.shuffleCards(cards);
    this.cards.set(cards);
  }

  /**
   * Mélange les cartes de manière aléatoire (algorithme de Fisher-Yates)
   */
  private shuffleCards(cards: MemoryCard[]): void {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }

  /**
   * Retourne une carte
   */
  flipCard(cardId: number): void {
    if (this.disabled || this.isSubmitted()) return;
    
    const card = this.cards().find(c => c.id === cardId);
    if (!card || card.isMatched || card.isFlipped) return;

    const flipped = this.flippedCards();
    
    // Ne pas retourner si déjà 2 cartes retournées
    if (flipped.length >= 2) return;

    // Retourner la carte
    const updatedCards = this.cards().map(c => 
      c.id === cardId ? { ...c, isFlipped: true } : c
    );
    this.cards.set(updatedCards);
    this.flippedCards.set([...flipped, cardId]);
  }

  /**
   * Vérifie si les 2 cartes retournées forment une paire
   */
  private checkPair(): void {
    const flipped = this.flippedCards();
    if (flipped.length !== 2) return;

    const card1 = this.cards().find(c => c.id === flipped[0]);
    const card2 = this.cards().find(c => c.id === flipped[1]);

    if (!card1 || !card2) return;

    // Vérifier si c'est une paire (même pairId)
    if (card1.pairId === card2.pairId) {
      // Paire trouvée !
      const matchedPairs = new Set(this.matchedPairs());
      matchedPairs.add(card1.pairId);

      const updatedCards = this.cards().map(c => 
        c.pairId === card1.pairId 
          ? { ...c, isMatched: true, isFlipped: true }
          : c
      );
      this.cards.set(updatedCards);
      this.matchedPairs.set(matchedPairs);

      // Vérifier si toutes les paires sont trouvées
      if (matchedPairs.size === this.memoryData.paires.length) {
        this.completeGame();
      }
    } else {
      // Pas une paire, retourner les cartes
      const updatedCards = this.cards().map(c => 
        flipped.includes(c.id) 
          ? { ...c, isFlipped: false }
          : c
      );
      this.cards.set(updatedCards);
    }

    // Réinitialiser les cartes retournées
    this.flippedCards.set([]);
  }

  /**
   * Marque le jeu comme terminé (toutes les paires trouvées)
   */
  private completeGame(): void {
    this.isSubmitted.set(true);
    this.isCorrect.set(true);
    this.validated.emit(true);
  }

  /**
   * Réinitialise le jeu
   */
  reset(): void {
    this.flippedCards.set([]);
    this.matchedPairs.set(new Set());
    this.isSubmitted.set(false);
    this.isCorrect.set(null);
    this.initializeCards();
    // Émettre l'événement vers le parent pour qu'il réinitialise aussi son état
    this.resetRequested.emit();
  }

  /**
   * Retourne la classe CSS pour une carte
   */
  getCardClass(card: MemoryCard): string {
    let classes = 'memory-card';
    if (card.isFlipped) classes += ' flipped';
    if (card.isMatched) classes += ' matched';
    if (card.type === 'question') classes += ' question-card';
    if (card.type === 'reponse') classes += ' reponse-card';
    return classes;
  }

  /**
   * Retourne le nombre de paires trouvées
   */
  getProgress(): number {
    return this.matchedPairs().size;
  }

  /**
   * Retourne le nombre total de paires
   */
  getTotalPairs(): number {
    return this.memoryData.paires.length;
  }

}

