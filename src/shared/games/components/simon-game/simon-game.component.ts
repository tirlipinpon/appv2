import { Component, Input, Output, EventEmitter, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { SimonData } from '../../types/game-data';
import { GameErrorActionsComponent } from '../game-error-actions/game-error-actions.component';
import { AideSectionComponent } from '../../../components/aide-section/aide-section.component';

interface SimonElement {
  id: number;
  value: string;
  displayValue: string;
  color?: string; // Pour les couleurs
}

@Component({
  selector: 'app-simon-game',
  standalone: true,
  imports: [CommonModule, GameErrorActionsComponent, AideSectionComponent],
  templateUrl: './simon-game.component.html',
  styleUrl: './simon-game.component.scss',
})
export class SimonGameComponent implements OnInit, OnDestroy {
  @Input({ required: true }) simonData!: SimonData;
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

  // Éléments disponibles selon le type
  availableElements = signal<SimonElement[]>([]);
  
  // Séquence générée par l'ordinateur
  sequence = signal<number[]>([]);
  
  // Séquence actuelle (sous-séquence à reproduire)
  currentSequenceIndex = signal<number>(0);
  
  // Séquence de l'utilisateur
  userSequence = signal<number[]>([]);
  
  // État du jeu
  isPlaying = signal<boolean>(false); // En train de jouer
  isAnimating = signal<boolean>(false); // Animation de la séquence en cours
  isGameOver = signal<boolean>(false);
  isCorrect = signal<boolean | null>(null);
  currentLevel = signal<number>(1);
  
  // Élément actuellement illuminé (pour l'animation)
  highlightedElement = signal<number | null>(null);
  
  
  private animationTimeouts: number[] = [];

  // Couleurs par défaut pour le type "couleurs"
  private readonly defaultColors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8844', '#8844ff', '#44ff88', '#ff4488'];
  
  // Couleurs pour chaque type d'élément
  private readonly elementColors: Record<string, string[]> = {
    couleurs: ['#ff4444', '#44ff44', '#4444ff', '#ffff44'],
    chiffres: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe', '#00b894', '#00cec9'],
    lettres: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#16a085', '#27ae60'],
    symboles: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe', '#00b894', '#00cec9'],
  };

  ngOnInit(): void {
    this.initializeElements();
    this.startGame();
  }

  ngOnDestroy(): void {
    // Nettoyer tous les timeouts
    this.animationTimeouts.forEach(timeout => clearTimeout(timeout));
    this.animationTimeouts = [];
  }

  /**
   * Mélange un tableau de manière aléatoire (algorithme de Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Initialise les éléments disponibles selon le type
   */
  private initializeElements(): void {
    const elements: SimonElement[] = [];
    const type = this.simonData.type_elements;
    const nombreElements = this.simonData.nombre_elements;
    
    if (type === 'personnalise' && this.simonData.elements && this.simonData.elements.length > 0) {
      // Mode personnalisé : utiliser les éléments fournis et mélanger
      const shuffledElements = this.shuffleArray([...this.simonData.elements]);
      // Utiliser une seule couleur pour tous les éléments en mode personnalisé
      const singleColor = this.elementColors['chiffres'][0]; // Utiliser la première couleur disponible
      
      shuffledElements.slice(0, nombreElements).forEach((el, index) => {
        elements.push({
          id: index,
          value: el,
          displayValue: el,
          color: singleColor,
        });
      });
    } else {
      // Mode prédéfini
      let baseElements: { value: string; displayValue: string }[] = [];
      let colorsToUse: string[] = [];
      
      switch (type) {
        case 'couleurs':
          // Pour le mode couleurs, mapper directement les noms aux couleurs
          const colorNames = ['rouge', 'vert', 'bleu', 'jaune', 'violet', 'orange', 'rose', 'cyan', 'marron', 'gris'];
          const colorMap: Record<string, string> = {
            'rouge': '#ff4444',
            'vert': '#44ff44',
            'bleu': '#4444ff',
            'jaune': '#ffff44',
            'violet': '#8844ff',
            'orange': '#ff8844',
            'rose': '#ff4488',
            'cyan': '#44ffff',
            'marron': '#8b4513',
            'gris': '#888888'
          };
          
          colorNames.slice(0, nombreElements).forEach((name, index) => {
            elements.push({
              id: index,
              value: name,
              displayValue: name,
              color: colorMap[name] || this.elementColors['couleurs'][index % this.elementColors['couleurs'].length],
            });
          });
          break;
          
        case 'chiffres':
          colorsToUse = this.elementColors['chiffres'];
          baseElements = Array.from({ length: nombreElements }, (_, i) => ({
            value: String(i),
            displayValue: String(i),
          }));
          break;
          
        case 'lettres':
          colorsToUse = this.elementColors['lettres'];
          const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
          baseElements = letters.slice(0, nombreElements).map(letter => ({
            value: letter,
            displayValue: letter,
          }));
          break;
          
        case 'symboles':
          colorsToUse = this.elementColors['symboles'];
          const symbols = ['+', '-', '×', '÷', '=', '≠', '<', '>', '≤', '≥'];
          baseElements = symbols.slice(0, nombreElements).map(symbol => ({
            value: symbol,
            displayValue: symbol,
          }));
          break;
      }
      
      // Pour les modes autres que couleurs, mélanger les éléments et assigner les couleurs
      if (type !== 'couleurs') {
        const shuffledColors = this.shuffleArray([...colorsToUse]);
        const shuffledBaseElements = this.shuffleArray(baseElements);
        
        shuffledBaseElements.forEach((el, index) => {
          elements.push({
            id: index,
            value: el.value,
            displayValue: el.displayValue,
            color: shuffledColors[index % shuffledColors.length],
          });
        });
      }
    }
    
    // Mélanger une dernière fois l'ordre final des éléments (sauf pour le mode couleurs qui est déjà correct)
    if (type !== 'couleurs') {
      const finalShuffled = this.shuffleArray(elements);
      // Réassigner les IDs pour qu'ils soient séquentiels
      finalShuffled.forEach((el, index) => {
        el.id = index;
      });
      this.availableElements.set(finalShuffled);
    } else {
      // Pour le mode couleurs, juste mélanger l'ordre mais garder les couleurs correctes
      const finalShuffled = this.shuffleArray(elements);
      finalShuffled.forEach((el, index) => {
        el.id = index;
      });
      this.availableElements.set(finalShuffled);
    }
  }

  /**
   * Démarre une nouvelle partie
   */
  startGame(): void {
    this.sequence.set([]);
    this.userSequence.set([]);
    this.currentSequenceIndex.set(0);
    this.currentLevel.set(1);
    this.isGameOver.set(false);
    this.isCorrect.set(null);
    this.isPlaying.set(true);
    this.nextRound();
  }

  /**
   * Passe au round suivant
   */
  nextRound(): void {
    if (this.isGameOver()) return;
    
    // Ajouter un nouvel élément aléatoire à la séquence
    const elements = this.availableElements();
    const randomIndex = Math.floor(Math.random() * elements.length);
    const newSequence = [...this.sequence(), randomIndex];
    this.sequence.set(newSequence);
    
    // Réinitialiser la séquence utilisateur
    this.userSequence.set([]);
    this.currentSequenceIndex.set(0);
    
    // Démarrer l'animation de la séquence
    this.playSequence();
  }

  /**
   * Joue la séquence animée
   */
  playSequence(): void {
    this.isAnimating.set(true);
    const seq = this.sequence();
    let delay = 500; // Délai initial (500ms)
    
    // Réduire le délai progressivement selon le niveau (plus rapide aux niveaux élevés)
    const speedFactor = Math.max(0.7, 1 - (this.currentLevel() - 1) * 0.05);
    const baseDelay = 500 * speedFactor;
    
    seq.forEach((elementId, index) => {
      const timeout = window.setTimeout(() => {
        // Illuminer l'élément
        this.highlightedElement.set(elementId);
        
        // Éteindre après 400ms
        const timeout2 = window.setTimeout(() => {
          this.highlightedElement.set(null);
          
          // Si c'est le dernier élément, permettre l'interaction
          if (index === seq.length - 1) {
            const timeout3 = window.setTimeout(() => {
              this.isAnimating.set(false);
            }, 200);
            this.animationTimeouts.push(timeout3);
          }
        }, 400);
        this.animationTimeouts.push(timeout2);
      }, delay);
      
      this.animationTimeouts.push(timeout);
      delay += baseDelay + 200; // Délai entre chaque élément
    });
  }

  /**
   * Gère le clic sur un élément
   */
  onElementClick(elementId: number): void {
    if (this.disabled || this.isAnimating() || this.isGameOver() || !this.isPlaying()) {
      return;
    }
    
    // Illuminer brièvement l'élément cliqué
    this.highlightedElement.set(elementId);
    setTimeout(() => {
      this.highlightedElement.set(null);
    }, 200);
    
    // Ajouter à la séquence utilisateur
    const userSeq = [...this.userSequence(), elementId];
    this.userSequence.set(userSeq);
    
    // Vérifier si c'est correct
    const seq = this.sequence();
    const expectedElement = seq[userSeq.length - 1];
    
    if (elementId !== expectedElement) {
      // Erreur !
      this.handleError();
      return;
    }
    
    // Vérifier si la séquence est complète
    if (userSeq.length === seq.length) {
      // Séquence complète et correcte !
      this.handleSuccess();
    }
  }

  /**
   * Gère une séquence correcte
   */
  private handleSuccess(): void {
    // Attendre un peu avant de passer au niveau suivant
    setTimeout(() => {
      this.currentLevel.update(level => level + 1);
      this.nextRound();
    }, 800);
  }

  /**
   * Gère une erreur
   */
  private handleError(): void {
    this.isGameOver.set(true);
    this.isPlaying.set(false);
    this.isCorrect.set(false);
    this.validated.emit(false);
  }

  /**
   * Réinitialise le jeu
   */
  reset(): void {
    // Nettoyer les timeouts
    this.animationTimeouts.forEach(timeout => clearTimeout(timeout));
    this.animationTimeouts = [];
    
    this.startGame();
    // Émettre l'événement vers le parent pour qu'il réinitialise aussi son état
    this.resetRequested.emit();
  }

  /**
   * Obtient l'élément par son ID
   */
  getElement(elementId: number): SimonElement | undefined {
    return this.availableElements().find(el => el.id === elementId);
  }

  /**
   * Vérifie si un élément est actuellement illuminé
   */
  isElementHighlighted(elementId: number): boolean {
    return this.highlightedElement() === elementId;
  }

  /**
   * Obtient la classe CSS pour un élément
   */
  getElementClass(elementId: number): string {
    const classes = ['simon-element'];
    if (this.isElementHighlighted(elementId)) {
      classes.push('highlighted');
    }
    if (this.isAnimating() || this.isGameOver() || !this.isPlaying()) {
      classes.push('disabled');
    }
    return classes.join(' ');
  }

  /**
   * Obtient le style pour un élément (couleur de fond)
   */
  getElementStyle(element: SimonElement): Record<string, string> {
    const style: Record<string, string> = {};
    if (element.color) {
      style['background-color'] = element.color;
      style['border-color'] = element.color;
    }
    return style;
  }

  /**
   * Vérifie si on est en mode couleurs (pour masquer le texte)
   */
  isColorMode(): boolean {
    return this.simonData.type_elements === 'couleurs';
  }

}

