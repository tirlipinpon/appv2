import { Component, Input, Output, EventEmitter, signal, computed, AfterViewInit, AfterViewChecked, ViewChild, ElementRef, OnDestroy, effect, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import type { CaseVideData, ReponseLibreData, LiensData, ChronologieData, QcmData, VraiFauxData, MemoryData, SimonData, ImageInteractiveData } from '@shared/games';
import { isGameType, isGameTypeOneOf } from '../../../../utils/game-type.util';
import type { GameGlobalFieldsData } from '../game-global-fields/game-global-fields.component';
import { QcmGameComponent, ChronologieGameComponent, MemoryGameComponent, SimonGameComponent, ImageInteractiveGameComponent, CaseVideGameComponent } from '@shared/games';
import { LetterByLetterInputComponent } from '@shared/components/letter-by-letter-input/letter-by-letter-input.component';

@Component({
  selector: 'app-game-preview',
  standalone: true,
  imports: [CommonModule, DragDropModule, QcmGameComponent, ChronologieGameComponent, MemoryGameComponent, SimonGameComponent, ImageInteractiveGameComponent, CaseVideGameComponent, LetterByLetterInputComponent],
  templateUrl: './game-preview.component.html',
  styleUrl: './game-preview.component.scss',
})
export class GamePreviewComponent implements AfterViewInit, AfterViewChecked, OnDestroy {
  // Utiliser input() pour créer un signal qui réagit aux changements
  isOpen = input<boolean>(false);
  @Input() gameTypeName = '';
  @Input() globalFields: GameGlobalFieldsData | null = null;
  @Input() gameData: CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | ImageInteractiveData | null = null;
  
  @Output() closed = new EventEmitter<void>();

  @ViewChild('liensGrid', { static: false }) liensGridRef?: ElementRef<HTMLDivElement>;
  @ViewChild('linksSvg', { static: false }) linksSvgRef?: ElementRef<SVGSVGElement>;
  @ViewChild('caseVideGame', { static: false }) caseVideGameComponent?: CaseVideGameComponent;

  private resizeObserver?: ResizeObserver;
  private updateLinksTimeout?: number;


  // Pour Case Vide et Réponse Libre - réponse saisie (ancien format)
  userAnswer = signal<string>('');


  // Pour Liens - associations faites par l'utilisateur (mot -> reponse)
  userLinks = signal<Map<string, string>>(new Map());

  // Lignes SVG pour les liens
  linkPaths = signal<{ mot: string; reponse: string; path: string }[]>([]);

  // Ordre mélangé pour l'affichage (mots et réponses dans un ordre aléatoire)
  shuffledMots = signal<string[]>([]);
  shuffledReponses = signal<string[]>([]);

  // Pour Vrai/Faux - réponses de l'utilisateur (index → réponse)
  userVraiFauxAnswers = signal<Map<number, boolean>>(new Map());
  
  // Ordre mélangé pour les énoncés Vrai/Faux
  shuffledEnonces = signal<{ texte: string; reponse_correcte: boolean }[]>([]);


  // État de validation (pour montrer si c'est correct ou non)
  isSubmitted = signal<boolean>(false);
  isCorrect = signal<boolean | null>(null);

  constructor() {
    // Effet pour mettre à jour les lignes quand les liens changent
    effect(() => {
      this.userLinks();
      this.selectedMotForLink();
      // Délai pour laisser le DOM se mettre à jour
      if (this.isOpen() && this.liensData) {
        setTimeout(() => this.updateLinkPaths(), 100);
      }
    });

    // Effet pour mélanger les données quand elles changent
    effect(() => {
      const data = this.liensData;
      if (data) {
        this.shuffleLiensData();
      }
    });

    // Effet pour remélanger quand la modal s'ouvre
    effect(() => {
      if (this.isOpen() && this.liensData) {
        // Remélanger à chaque ouverture pour un nouvel ordre aléatoire
        this.shuffleLiensData();
      }
      if (this.isOpen() && this.vraiFauxData) {
        // Remélanger les énoncés Vrai/Faux à chaque ouverture
        this.shuffleVraiFauxData();
      }
    });

    // Effet pour mélanger les énoncés Vrai/Faux quand les données changent
    effect(() => {
      const data = this.vraiFauxData;
      if (data) {
        this.shuffleVraiFauxData();
      }
    });

  }

  close(): void {
    this.closed.emit();
    this.reset();
  }

  reset(): void {
    // Les composants de jeu se réinitialisent automatiquement via leur propre reset()
    this.userAnswer.set('');
    this.userLinks.set(new Map());
    this.selectedMotForLink.set(null);
    this.userVraiFauxAnswers.set(new Map());
    this.isSubmitted.set(false);
    this.isCorrect.set(null);
    // Remélanger les mots et réponses
    this.shuffleLiensData();
    // Remélanger les énoncés Vrai/Faux
    this.shuffleVraiFauxData();
    // Case Vide se réinitialise automatiquement via son propre reset()
    if (this.caseVideGameComponent) {
      this.caseVideGameComponent.reset();
    }
    // Memory se réinitialise automatiquement via son propre reset()
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('preview-backdrop')) {
      this.close();
    }
  }

  // Méthodes pour QCM
  onQcmAnswerSelected(selectedTexts: string[]): void {
    // Les réponses sont déjà gérées par le composant qcm-game
  }

  onQcmValidated(isValid: boolean): void {
    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
  }

  // Méthodes pour Case Vide
  submitCaseVide(): void {
    if (this.caseVideGameComponent) {
      this.caseVideGameComponent.submitCaseVide();
    }
  }

  canSubmitCaseVide(): boolean {
    if (this.caseVideGameComponent) {
      return this.caseVideGameComponent.canSubmit();
    }
    return false;
  }

  onCaseVideValidated(isValid: boolean): void {
    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
  }

  // Méthodes pour Réponse Libre
  submitReponseLibre(): void {
    if (this.isSubmitted()) return;
    const reponseLibreData = this.gameData as ReponseLibreData;
    if (!reponseLibreData) return;

    const isValid = this.userAnswer().trim().toLowerCase() === reponseLibreData.reponse_valide.trim().toLowerCase();
    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
  }

  // Pour les liens - mot sélectionné pour créer un lien
  selectedMotForLink = signal<string | null>(null);

  // Méthodes pour Liens
  selectMot(mot: string): void {
    if (this.isSubmitted()) return;
    const current = this.selectedMotForLink();
    if (current === mot) {
      // Désélectionner si déjà sélectionné
      this.selectedMotForLink.set(null);
    } else {
      this.selectedMotForLink.set(mot);
    }
  }

  selectReponse(reponse: string): void {
    if (this.isSubmitted()) return;
    const selectedMot = this.selectedMotForLink();
    if (!selectedMot) return;

    const links = new Map(this.userLinks());
    // Si ce mot a déjà une réponse, on la retire
    if (links.has(selectedMot)) {
      links.delete(selectedMot);
    }
    // Si cette réponse est déjà liée à un autre mot, on retire l'ancien lien
    for (const [existingMot, existingReponse] of links.entries()) {
      if (existingReponse === reponse) {
        links.delete(existingMot);
        break;
      }
    }
    // On crée le nouveau lien
    links.set(selectedMot, reponse);
    this.userLinks.set(links);
    this.selectedMotForLink.set(null); // Réinitialiser la sélection
  }

  submitLiens(): void {
    if (this.isSubmitted()) return;
    const liensData = this.gameData as LiensData;
    if (!liensData) return;

    const userLinksArray = Array.from(this.userLinks().entries()).map(([mot, reponse]) => ({ mot, reponse }));
    const correctLinks = liensData.liens;

    const isValid = userLinksArray.length === correctLinks.length &&
      userLinksArray.every(link => 
        correctLinks.some(correct => correct.mot === link.mot && correct.reponse === link.reponse)
      );

    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
  }

  isLinkSelected(mot: string, reponse: string): boolean {
    return this.userLinks().get(mot) === reponse;
  }

  // Méthodes pour Chronologie
  onChronologieOrderChanged(order: string[]): void {
    // L'ordre est géré par le composant chronologie-game
  }

  onChronologieValidated(isValid: boolean): void {
    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
  }

  // Méthodes pour Memory
  onMemoryValidated(isValid: boolean): void {
    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
  }

  // Méthodes pour Simon
  onSimonValidated(isValid: boolean): void {
    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
  }

  // Méthodes pour Image Interactive
  onImageInteractiveValidated(isValid: boolean): void {
    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
  }

  // Getters pour éviter les castings dans le template
  get qcmData(): QcmData | null {
    return isGameType(this.gameTypeName, 'qcm') && this.gameData ? this.gameData as QcmData : null;
  }

  get caseVideData(): CaseVideData | null {
    return isGameType(this.gameTypeName, 'case vide') && this.gameData ? this.gameData as CaseVideData : null;
  }

  get reponseLibreData(): ReponseLibreData | null {
    return isGameType(this.gameTypeName, 'reponse libre') && this.gameData ? this.gameData as ReponseLibreData : null;
  }

  get liensData(): LiensData | null {
    return isGameType(this.gameTypeName, 'liens') && this.gameData ? this.gameData as LiensData : null;
  }

  get chronologieData(): ChronologieData | null {
    return isGameType(this.gameTypeName, 'chronologie') && this.gameData ? this.gameData as ChronologieData : null;
  }

  get vraiFauxData(): VraiFauxData | null {
    return isGameType(this.gameTypeName, 'vrai/faux') && this.gameData ? this.gameData as VraiFauxData : null;
  }

  get memoryData(): MemoryData | null {
    return isGameType(this.gameTypeName, 'memory') && this.gameData ? this.gameData as MemoryData : null;
  }

  get simonData(): SimonData | null {
    return isGameType(this.gameTypeName, 'simon') && this.gameData ? this.gameData as SimonData : null;
  }

  get imageInteractiveData(): ImageInteractiveData | null {
    return isGameTypeOneOf(this.gameTypeName, 'click', 'image interactive') && this.gameData ? this.gameData as ImageInteractiveData : null;
  }

  // Méthodes helper pour les liens
  getLiensMots(): string[] {
    // Retourner les mots mélangés si disponibles, sinon les mots originaux
    const shuffled = this.shuffledMots();
    return shuffled.length > 0 ? shuffled : (this.liensData?.mots || []);
  }

  getLiensReponses(): string[] {
    // Retourner les réponses mélangées si disponibles, sinon les réponses originales
    const shuffled = this.shuffledReponses();
    return shuffled.length > 0 ? shuffled : (this.liensData?.reponses || []);
  }

  // Fonction utilitaire pour mélanger un tableau (algorithme de Fisher-Yates)
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Mélanger les mots et réponses quand les données changent
  shuffleLiensData(): void {
    const liensData = this.liensData;
    if (liensData) {
      this.shuffledMots.set(this.shuffleArray(liensData.mots));
      this.shuffledReponses.set(this.shuffleArray(liensData.reponses));
    } else {
      this.shuffledMots.set([]);
      this.shuffledReponses.set([]);
    }
  }

  findMotForReponse(reponse: string): string {
    const liensData = this.liensData;
    if (!liensData) return '';
    const mot = liensData.mots.find(m => this.userLinks().get(m) === reponse);
    return mot || '';
  }

  isMotSelected(mot: string): boolean {
    return this.selectedMotForLink() === mot;
  }

  getReponseForMot(mot: string): string | null {
    return this.userLinks().get(mot) || null;
  }

  getReponseLibreReponseValide(): string {
    return this.reponseLibreData?.reponse_valide || '';
  }


  // Helper pour les aides
  hasAides(): boolean {
    return !!this.globalFields?.aides && this.globalFields.aides.length > 0;
  }

  getAides(): string[] {
    return this.globalFields?.aides || [];
  }

  // Méthodes pour les lignes SVG
  ngAfterViewInit(): void {
    this.setupResizeObserver();
    if (this.isOpen() && this.liensData) {
      // S'assurer que les données sont mélangées
      if (this.shuffledMots().length === 0) {
        this.shuffleLiensData();
      }
      setTimeout(() => this.updateLinkPaths(), 200);
    }
  }

  ngAfterViewChecked(): void {
    // Mettre à jour les lignes après chaque vérification de vue
    if (this.liensData && this.liensGridRef) {
      // Utiliser un timeout pour éviter les appels trop fréquents
      if (this.updateLinksTimeout) {
        clearTimeout(this.updateLinksTimeout);
      }
      this.updateLinksTimeout = window.setTimeout(() => {
        this.updateLinkPaths();
      }, 10);
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.updateLinksTimeout) {
      clearTimeout(this.updateLinksTimeout);
    }
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined' && this.liensGridRef) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateLinkPaths();
      });
      this.resizeObserver.observe(this.liensGridRef.nativeElement);
    }
  }

  updateLinkPaths(): void {
    if (!this.liensGridRef || !this.linksSvgRef || !this.liensData) {
      this.linkPaths.set([]);
      return;
    }

    // Utiliser requestAnimationFrame pour s'assurer que le DOM est rendu
    requestAnimationFrame(() => {
      if (!this.liensGridRef || !this.linksSvgRef) {
        return;
      }

      const gridElement = this.liensGridRef.nativeElement;
      const svgElement = this.linksSvgRef.nativeElement;
      const gridRect = gridElement.getBoundingClientRect();

      if (gridRect.width === 0 || gridRect.height === 0) {
        this.linkPaths.set([]);
        return;
      }

      // Mettre à jour la taille du SVG
      svgElement.setAttribute('width', String(gridRect.width));
      svgElement.setAttribute('height', String(gridRect.height));
      svgElement.style.width = `${gridRect.width}px`;
      svgElement.style.height = `${gridRect.height}px`;

      const paths: { mot: string; reponse: string; path: string }[] = [];
      const userLinksMap = this.userLinks();

      for (const [mot, reponse] of userLinksMap.entries()) {
        const motElement = gridElement.querySelector(`[data-mot="${this.escapeForSelector(mot)}"]`) as HTMLElement;
        const reponseElement = gridElement.querySelector(`[data-reponse="${this.escapeForSelector(reponse)}"]`) as HTMLElement;

        if (motElement && reponseElement) {
          const motRect = motElement.getBoundingClientRect();
          const reponseRect = reponseElement.getBoundingClientRect();

          // Trouver les cercles pour calculer les positions exactes
          const motCircle = motElement.querySelector('.link-circle') as HTMLElement;
          const reponseCircle = reponseElement.querySelector('.link-circle') as HTMLElement;

          // Calculer les positions relatives au grid
          // Si les cercles existent, utiliser leur centre, sinon utiliser le bord de l'élément
          let motX: number;
          let motY: number;
          let reponseX: number;
          let reponseY: number;

          if (motCircle) {
            const motCircleRect = motCircle.getBoundingClientRect();
            motX = motCircleRect.left + motCircleRect.width / 2 - gridRect.left;
            motY = motCircleRect.top + motCircleRect.height / 2 - gridRect.top;
          } else {
            motX = motRect.right - gridRect.left;
            motY = motRect.top + motRect.height / 2 - gridRect.top;
          }

          if (reponseCircle) {
            const reponseCircleRect = reponseCircle.getBoundingClientRect();
            reponseX = reponseCircleRect.left + reponseCircleRect.width / 2 - gridRect.left;
            reponseY = reponseCircleRect.top + reponseCircleRect.height / 2 - gridRect.top;
          } else {
            reponseX = reponseRect.left - gridRect.left;
            reponseY = reponseRect.top + reponseRect.height / 2 - gridRect.top;
          }

          // Créer une courbe de Bézier pour une ligne plus élégante
          const controlPoint1X = motX + (reponseX - motX) * 0.5;
          const controlPoint1Y = motY;
          const controlPoint2X = motX + (reponseX - motX) * 0.5;
          const controlPoint2Y = reponseY;

          const path = `M ${motX} ${motY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${reponseX} ${reponseY}`;

          paths.push({ mot, reponse, path });
        }
      }

      this.linkPaths.set(paths);
    });
  }

  private escapeForSelector(str: string): string {
    // Échapper les caractères spéciaux pour les sélecteurs CSS
    return str.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
  }

  getLinkPaths(): { mot: string; reponse: string; path: string }[] {
    return this.linkPaths();
  }

  // Méthodes pour Vrai/Faux
  selectVraiFauxAnswer(index: number, reponse: boolean): void {
    if (this.isSubmitted()) return;
    const answers = new Map(this.userVraiFauxAnswers());
    answers.set(index, reponse);
    this.userVraiFauxAnswers.set(answers);
  }

  submitVraiFaux(): void {
    if (this.isSubmitted()) return;
    const enonces = this.getVraiFauxEnonces();
    if (enonces.length === 0) return;

    const userAnswers = this.userVraiFauxAnswers();
    
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
  }

  getVraiFauxEnonces(): { texte: string; reponse_correcte: boolean }[] {
    // Retourner les énoncés mélangés si disponibles, sinon les énoncés originaux
    const shuffled = this.shuffledEnonces();
    return shuffled.length > 0 ? shuffled : (this.vraiFauxData?.enonces || []);
  }

  shuffleVraiFauxData(): void {
    const vraiFauxData = this.vraiFauxData;
    if (vraiFauxData) {
      this.shuffledEnonces.set(this.shuffleArray(vraiFauxData.enonces));
    } else {
      this.shuffledEnonces.set([]);
    }
  }

  isVraiFauxAnswerSelected(index: number, reponse: boolean): boolean {
    return this.userVraiFauxAnswers().get(index) === reponse;
  }

  isVraiFauxCorrect(index: number): boolean | null {
    if (!this.isSubmitted()) return null;
    const enonces = this.getVraiFauxEnonces();
    if (index < 0 || index >= enonces.length) return null;
    const enonce = enonces[index];
    if (!enonce) return null;
    const userAnswer = this.userVraiFauxAnswers().get(index);
    if (userAnswer === undefined) return null;
    return userAnswer === enonce.reponse_correcte;
  }

}

