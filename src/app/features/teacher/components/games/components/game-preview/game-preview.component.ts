import { Component, Input, Output, EventEmitter, signal, computed, AfterViewInit, AfterViewChecked, ViewChild, ElementRef, OnDestroy, effect, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import type { CaseVideData, ReponseLibreData, LiensData, ChronologieData, QcmData, VraiFauxData, MemoryData, SimonData } from '../../../../types/game-data';
import type { GameGlobalFieldsData } from '../game-global-fields/game-global-fields.component';
import { QcmGameComponent } from '../qcm-game/qcm-game.component';
import { ChronologieGameComponent } from '../chronologie-game/chronologie-game.component';
import { MemoryGameComponent } from '../memory-game/memory-game.component';
import { SimonGameComponent } from '../simon-game/simon-game.component';
import { LetterByLetterInputComponent } from '../../../../../../shared/components/letter-by-letter-input/letter-by-letter-input.component';

@Component({
  selector: 'app-game-preview',
  standalone: true,
  imports: [CommonModule, DragDropModule, QcmGameComponent, ChronologieGameComponent, MemoryGameComponent, SimonGameComponent, LetterByLetterInputComponent],
  templateUrl: './game-preview.component.html',
  styleUrl: './game-preview.component.scss',
})
export class GamePreviewComponent implements AfterViewInit, AfterViewChecked, OnDestroy {
  // Utiliser input() pour créer un signal qui réagit aux changements
  isOpen = input<boolean>(false);
  @Input() gameTypeName = '';
  @Input() globalFields: GameGlobalFieldsData | null = null;
  @Input() gameData: CaseVideData | ReponseLibreData | LiensData | ChronologieData | QcmData | VraiFauxData | MemoryData | SimonData | null = null;
  
  @Output() closed = new EventEmitter<void>();

  @ViewChild('liensGrid', { static: false }) liensGridRef?: ElementRef<HTMLDivElement>;
  @ViewChild('linksSvg', { static: false }) linksSvgRef?: ElementRef<SVGSVGElement>;

  private resizeObserver?: ResizeObserver;
  private updateLinksTimeout?: number;


  // Pour Case Vide et Réponse Libre - réponse saisie (ancien format)
  userAnswer = signal<string>('');

  // Pour Case Vide (nouveau format drag and drop) - réponses par index de case
  userCaseVideAnswers = signal<Map<number, string>>(new Map());
  // Banque de mots mélangée pour Case Vide
  shuffledBanqueMots = signal<string[]>([]);
  // Mots disponibles dans la banque (mutable pour CDK drag-drop)
  availableWords = signal<string[]>([]);
  // Tableaux mutables pour chaque case vide (pour CDK drag-drop)
  caseDropLists = signal<Map<number, string[]>>(new Map());
  
  // Flag pour éviter les initialisations multiples
  private caseVideInitialized = signal<boolean>(false);
  // Mots utilisés (retirés de la banque)
  usedWords = signal<Set<string>>(new Set());

  // Texte parsé avec cases (computed pour réactivité)
  parsedTexteParts = signal<{ type: 'text' | 'case'; content: string; index?: number }[]>([]);

  // Pour Liens - associations faites par l'utilisateur (mot -> reponse)
  userLinks = signal<Map<string, string>>(new Map());

  // Lignes SVG pour les liens
  linkPaths = signal<{ mot: string; reponse: string; path: string }[]>([]);

  // Ordre mélangé pour l'affichage (mots et réponses dans un ordre aléatoire)
  shuffledMots = signal<string[]>([]);
  shuffledReponses = signal<string[]>([]);

  // Pour Vrai/Faux - réponses de l'utilisateur (énoncé → réponse)
  userVraiFauxAnswers = signal<Map<string, boolean>>(new Map());
  
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

    // Effet pour parser le texte quand les données changent
    effect(() => {
      const data = this.caseVideData;
      if (data && data.texte) {
        this.parsedTexteParts.set(this.parseTexteWithCasesInternal(data.texte));
      } else {
        this.parsedTexteParts.set([]);
      }
    });

    // Effet pour initialiser Case Vide quand la modal s'ouvre ET que les données sont disponibles
    effect(() => {
      const isOpen = this.isOpen();
      const data = this.caseVideData;
      const alreadyInitialized = this.caseVideInitialized();
      
      // Si la modal est fermée, réinitialiser le flag
      if (!isOpen) {
        this.caseVideInitialized.set(false);
        return;
      }
      
      // Si la modal est ouverte et que les données sont disponibles et pas encore initialisé
      if (isOpen && data && data.texte && data.banque_mots && !alreadyInitialized) {
        // Initialiser immédiatement (sans délai pour éviter les problèmes d'affichage)
        this.initializeCaseVide();
        this.caseVideInitialized.set(true);
      }
    });
  }

  close(): void {
    this.closed.emit();
    this.reset();
    this.caseVideInitialized.set(false);
  }

  reset(): void {
    // Les composants de jeu se réinitialisent automatiquement via leur propre reset()
    this.userAnswer.set('');
    this.userLinks.set(new Map());
    this.selectedMotForLink.set(null);
    this.userVraiFauxAnswers.set(new Map());
    this.userCaseVideAnswers.set(new Map());
    this.usedWords.set(new Set());
    this.caseDropLists.set(new Map());
    this.isSubmitted.set(false);
    this.isCorrect.set(null);
    // Remélanger les mots et réponses
    this.shuffleLiensData();
    // Remélanger les énoncés Vrai/Faux
    this.shuffleVraiFauxData();
    // Remélanger la banque de mots Case Vide
    if (this.caseVideData && this.caseVideData.banque_mots) {
      this.shuffleBanqueMots();
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
    if (this.isSubmitted()) return;
    const caseVideData = this.caseVideData;
    if (!caseVideData) return;

    // Vérifier si c'est le nouveau format (drag and drop) ou l'ancien format
    if (caseVideData.texte && caseVideData.cases_vides) {
      // Nouveau format : valider toutes les cases vides
      const allFilled = caseVideData.cases_vides.every(caseVide => 
        this.userCaseVideAnswers().has(caseVide.index)
      );
      
      if (!allFilled) {
        // Toutes les cases doivent être remplies
        return;
      }

      const allCorrect = caseVideData.cases_vides.every(caseVide => {
        const userAnswer = this.userCaseVideAnswers().get(caseVide.index);
        return userAnswer?.toLowerCase().trim() === caseVide.reponse_correcte.toLowerCase().trim();
      });

      this.isSubmitted.set(true);
      this.isCorrect.set(allCorrect);
    } else if (caseVideData.debut_phrase && caseVideData.fin_phrase && caseVideData.reponse_valide) {
      // Ancien format : validation simple
      const isValid = this.userAnswer().trim().toLowerCase() === caseVideData.reponse_valide.trim().toLowerCase();
      this.isSubmitted.set(true);
      this.isCorrect.set(isValid);
    }
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

  // Getters pour éviter les castings dans le template
  get qcmData(): QcmData | null {
    return this.gameTypeName.toLowerCase() === 'qcm' && this.gameData ? this.gameData as QcmData : null;
  }

  get caseVideData(): CaseVideData | null {
    return this.gameTypeName.toLowerCase() === 'case vide' && this.gameData ? this.gameData as CaseVideData : null;
  }

  get reponseLibreData(): ReponseLibreData | null {
    return this.gameTypeName.toLowerCase() === 'reponse libre' && this.gameData ? this.gameData as ReponseLibreData : null;
  }

  get liensData(): LiensData | null {
    return this.gameTypeName.toLowerCase() === 'liens' && this.gameData ? this.gameData as LiensData : null;
  }

  get chronologieData(): ChronologieData | null {
    return this.gameTypeName.toLowerCase() === 'chronologie' && this.gameData ? this.gameData as ChronologieData : null;
  }

  get vraiFauxData(): VraiFauxData | null {
    return this.gameTypeName.toLowerCase() === 'vrai/faux' && this.gameData ? this.gameData as VraiFauxData : null;
  }

  get memoryData(): MemoryData | null {
    return this.gameTypeName.toLowerCase() === 'memory' && this.gameData ? this.gameData as MemoryData : null;
  }

  get simonData(): SimonData | null {
    return this.gameTypeName.toLowerCase() === 'simon' && this.gameData ? this.gameData as SimonData : null;
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
  selectVraiFauxAnswer(texte: string, reponse: boolean): void {
    if (this.isSubmitted()) return;
    const answers = new Map(this.userVraiFauxAnswers());
    answers.set(texte, reponse);
    this.userVraiFauxAnswers.set(answers);
  }

  submitVraiFaux(): void {
    if (this.isSubmitted()) return;
    const vraiFauxData = this.vraiFauxData;
    if (!vraiFauxData) return;

    const userAnswers = this.userVraiFauxAnswers();
    const allEnonces = vraiFauxData.enonces;
    
    // Vérifier que tous les énoncés ont une réponse
    if (userAnswers.size !== allEnonces.length) {
      return;
    }

    // Vérifier si toutes les réponses sont correctes
    const isValid = allEnonces.every(enonce => {
      const userAnswer = userAnswers.get(enonce.texte);
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

  isVraiFauxAnswerSelected(texte: string, reponse: boolean): boolean {
    return this.userVraiFauxAnswers().get(texte) === reponse;
  }

  getVraiFauxUserAnswer(texte: string): boolean | null {
    return this.userVraiFauxAnswers().get(texte) ?? null;
  }

  isVraiFauxCorrect(texte: string): boolean | null {
    if (!this.isSubmitted()) return null;
    const vraiFauxData = this.vraiFauxData;
    if (!vraiFauxData) return null;
    const enonce = vraiFauxData.enonces.find(e => e.texte === texte);
    if (!enonce) return null;
    const userAnswer = this.userVraiFauxAnswers().get(texte);
    if (userAnswer === undefined) return null;
    return userAnswer === enonce.reponse_correcte;
  }

  // Méthode pour initialiser complètement Case Vide
  private initializeCaseVide(): void {
    const caseVideData = this.caseVideData;
    if (!caseVideData) return;
    
    // Parser le texte avec cases
    if (caseVideData.texte) {
      this.parsedTexteParts.set(this.parseTexteWithCasesInternal(caseVideData.texte));
    }
    
    // Réinitialiser l'état utilisateur AVANT de mélanger
    this.userCaseVideAnswers.set(new Map());
    this.usedWords.set(new Set());
    this.isSubmitted.set(false);
    this.isCorrect.set(null);
    
    // Mélanger la banque de mots (cela initialise aussi les caseDropLists)
    if (caseVideData.banque_mots) {
      this.shuffleBanqueMots();
    } else {
      // Si pas de banque de mots, initialiser quand même les caseDropLists
      const caseLists = new Map<number, string[]>();
      if (caseVideData.cases_vides) {
        caseVideData.cases_vides.forEach(caseVide => {
          caseLists.set(caseVide.index, []);
        });
      }
      this.caseDropLists.set(caseLists);
    }
    
    // Réinitialiser les mots disponibles avec tous les mots mélangés
    const shuffled = this.shuffledBanqueMots();
    if (shuffled.length > 0) {
      this.availableWords.set([...shuffled]);
    }
  }

  // Méthodes pour Case Vide (nouveau format drag and drop)
  shuffleBanqueMots(): void {
    const caseVideData = this.caseVideData;
    if (caseVideData && caseVideData.banque_mots) {
      const shuffled = this.shuffleArray([...caseVideData.banque_mots]);
      this.shuffledBanqueMots.set(shuffled);
      // Initialiser les mots disponibles avec tous les mots
      this.availableWords.set([...shuffled]);
      this.usedWords.set(new Set());
      
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

  getAvailableWords(): string[] {
    return this.availableWords();
  }

  updateAvailableWords(): void {
    const shuffled = this.shuffledBanqueMots();
    const used = this.usedWords();
    const available = shuffled.filter(word => !used.has(word));
    this.availableWords.set(available);
  }

  parseTexteWithCases(): { type: 'text' | 'case'; content: string; index?: number }[] {
    return this.parsedTexteParts();
  }

  private parseTexteWithCasesInternal(texte: string): { type: 'text' | 'case'; content: string; index?: number }[] {
    if (!texte) {
      return [];
    }

    const parts: { type: 'text' | 'case'; content: string; index?: number }[] = [];
    const placeholderRegex = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = placeholderRegex.exec(texte)) !== null) {
      // Ajouter le texte avant le placeholder
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: texte.substring(lastIndex, match.index),
        });
      }
      // Ajouter la case vide
      const caseIndex = parseInt(match[1], 10);
      parts.push({
        type: 'case',
        content: match[0],
        index: caseIndex,
      });
      lastIndex = match.index + match[0].length;
    }

    // Ajouter le texte restant
    if (lastIndex < texte.length) {
      parts.push({
        type: 'text',
        content: texte.substring(lastIndex),
      });
    }

    // Si aucun placeholder n'a été trouvé, retourner le texte entier
    if (parts.length === 0) {
      parts.push({
        type: 'text',
        content: texte,
      });
    }

    return parts;
  }

  onWordDrop(event: CdkDragDrop<string[]>, caseIndex: number): void {
    if (this.isSubmitted()) return;

    // Utiliser transferArrayItem pour que CDK fasse le transfert visuel
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex >= 0 ? event.currentIndex : 0
    );

    // Maintenant synchroniser nos états avec les arrays modifiés par CDK
    const answers = new Map(this.userCaseVideAnswers());
    const used = new Set(this.usedWords());
    const available = [...this.availableWords()];
    const caseLists = new Map(this.caseDropLists());

    // Si on drop depuis la banque vers une case
    if (event.previousContainer.id === 'banque-mots') {
      const word = event.container.data[0]; // Le mot qui vient d'être déposé
      if (!word) return;
      
      // Si cette case avait déjà un mot, le remettre dans la banque
      const previousWord = answers.get(caseIndex);
      if (previousWord && previousWord !== word) {
        used.delete(previousWord);
        available.push(previousWord);
        answers.delete(caseIndex);
      }

      // Mettre à jour avec le nouveau mot
      answers.set(caseIndex, word);
      used.add(word);
      
      // Retirer le mot de la banque disponible
      const wordIndex = available.indexOf(word);
      if (wordIndex > -1) {
        available.splice(wordIndex, 1);
      }

      // Mettre à jour les listes de drop pour cette case
      caseLists.set(caseIndex, [word]);

      // Mettre à jour tous les signals
      this.userCaseVideAnswers.set(answers);
      this.usedWords.set(used);
      this.availableWords.set(available);
      this.caseDropLists.set(caseLists);
    }
    // Si on drop depuis une case vers une autre case (échange)
    else if (event.previousContainer.id.startsWith('case-')) {
      const previousCaseIndex = parseInt(event.previousContainer.id.replace('case-', ''), 10);
      const wordFromPrevious = event.container.data[0];
      const wordInNewCase = event.previousContainer.data[0]; // L'autre mot (s'il existe)
      
      if (wordFromPrevious) {
        // Échanger les mots entre les deux cases
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
    if (this.isSubmitted()) return;

    const answers = new Map(this.userCaseVideAnswers());
    const used = new Set(this.usedWords());
    const caseLists = new Map(this.caseDropLists());

    const word = answers.get(caseIndex);
    if (word) {
      answers.delete(caseIndex);
      used.delete(word);
      caseLists.set(caseIndex, []);
      
      // Remettre le mot dans la banque
      const available = [...this.availableWords()];
      available.push(word);
      this.availableWords.set(available);
      
      this.userCaseVideAnswers.set(answers);
      this.usedWords.set(used);
      this.caseDropLists.set(caseLists);
    }
  }

  getWordInCase(caseIndex: number): string | undefined {
    return this.userCaseVideAnswers().get(caseIndex);
  }

  getCaseDropListData(caseIndex: number): string[] {
    const caseLists = this.caseDropLists();
    
    // Retourner la liste existante (même référence pour CDK)
    // Si la liste n'existe pas, retourner un tableau vide
    // L'initialisation se fait dans initializeCaseVide(), pas ici
    return caseLists.get(caseIndex) || [];
  }

  // Computed signal pour tous les IDs des drop lists (banque + toutes les cases)
  readonly connectedDropListIds = computed(() => {
    const caseVideData = this.caseVideData;
    const ids: string[] = ['banque-mots'];
    
    if (caseVideData && caseVideData.cases_vides) {
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
    if (!this.isSubmitted()) return null;
    const caseVideData = this.caseVideData;
    if (!caseVideData || !caseVideData.cases_vides) return null;

    const caseVide = caseVideData.cases_vides.find(c => c.index === caseIndex);
    if (!caseVide) return null;

    const userAnswer = this.userCaseVideAnswers().get(caseIndex);
    return userAnswer?.toLowerCase().trim() === caseVide.reponse_correcte.toLowerCase().trim();
  }

  getCaseVideReponseValide(): string {
    const caseVideData = this.caseVideData;
    if (!caseVideData) return '';
    
    // Ancien format
    if (caseVideData.reponse_valide) {
      return caseVideData.reponse_valide;
    }
    
    // Nouveau format - retourner toutes les réponses correctes
    if (caseVideData.cases_vides) {
      return caseVideData.cases_vides.map(c => c.reponse_correcte).join(', ');
    }
    
    return '';
  }
}

