import { Component, Input, Output, EventEmitter, signal, computed, OnInit, AfterViewInit, AfterViewChecked, OnDestroy, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { LiensData } from '../../types/game-data';
import { GameErrorActionsComponent } from '../game-error-actions/game-error-actions.component';

interface LinkPath {
  mot: string;
  reponse: string;
  path: string;
}

@Component({
  selector: 'app-liens-game',
  standalone: true,
  imports: [CommonModule, GameErrorActionsComponent],
  templateUrl: './liens-game.component.html',
  styleUrl: './liens-game.component.scss',
})
export class LiensGameComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  @Input({ required: true }) liensData!: LiensData;
  @Input() showResult = false;
  @Input() disabled = false;
  @Input() aides: string[] | null = null; // Aides pour le jeu
  @Input() instructions: string | null = null; // Instructions pour le jeu
  @Input() question: string | null = null; // Question pour le jeu
  
  @Output() validated = new EventEmitter<boolean>();
  @Output() nextRequested = new EventEmitter<void>();

  @ViewChild('liensGrid', { static: false }) liensGridRef?: ElementRef<HTMLDivElement>;
  @ViewChild('linksSvg', { static: false }) linksSvgRef?: ElementRef<SVGElement>;

  // Mots et réponses mélangés
  shuffledMots = signal<string[]>([]);
  shuffledReponses = signal<string[]>([]);

  // Associations faites par l'utilisateur (mot -> reponse)
  userLinks = signal<Map<string, string>>(new Map());

  // Mot sélectionné pour créer un lien
  selectedMotForLink = signal<string | null>(null);

  // Lignes SVG pour les liens
  linkPaths = signal<LinkPath[]>([]);

  // État de validation
  isSubmitted = signal<boolean>(false);
  isCorrect = signal<boolean | null>(null);
  
  // État pour afficher/masquer les aides
  showAides = signal<boolean>(false);

  private resizeObserver?: ResizeObserver;
  private updateLinksTimeout?: number;

  constructor() {
    // Effet pour réinitialiser quand showResult change
    effect(() => {
      if (this.showResult) {
        this.isSubmitted.set(true);
      }
    });
  }

  ngOnInit(): void {
    this.shuffleLiensData();
  }

  ngAfterViewInit(): void {
    this.setupResizeObserver();
    if (this.shuffledMots().length === 0) {
      this.shuffleLiensData();
    }
    setTimeout(() => this.updateLinkPaths(), 200);
  }

  ngAfterViewChecked(): void {
    // Mettre à jour les lignes après chaque vérification de vue
    if (this.liensGridRef) {
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

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  shuffleLiensData(): void {
    if (this.liensData) {
      this.shuffledMots.set(this.shuffleArray([...this.liensData.mots]));
      this.shuffledReponses.set(this.shuffleArray([...this.liensData.reponses]));
    } else {
      this.shuffledMots.set([]);
      this.shuffledReponses.set([]);
    }
  }

  getLiensMots(): string[] {
    return this.shuffledMots().length > 0 ? this.shuffledMots() : (this.liensData?.mots || []);
  }

  getLiensReponses(): string[] {
    return this.shuffledReponses().length > 0 ? this.shuffledReponses() : (this.liensData?.reponses || []);
  }

  selectMot(mot: string): void {
    if (this.disabled || this.isSubmitted()) return;
    const current = this.selectedMotForLink();
    if (current === mot) {
      this.selectedMotForLink.set(null);
    } else {
      this.selectedMotForLink.set(mot);
    }
  }

  selectReponse(reponse: string): void {
    if (this.disabled || this.isSubmitted()) return;
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
    this.selectedMotForLink.set(null);
  }

  isMotSelected(mot: string): boolean {
    return this.selectedMotForLink() === mot;
  }

  getReponseForMot(mot: string): string | null {
    return this.userLinks().get(mot) || null;
  }

  findMotForReponse(reponse: string): string {
    if (!this.liensData) return '';
    const mot = this.liensData.mots.find(m => this.userLinks().get(m) === reponse);
    return mot || '';
  }

  isLinkSelected(mot: string, reponse: string): boolean {
    return this.userLinks().get(mot) === reponse;
  }

  getLinkPaths(): LinkPath[] {
    return this.linkPaths();
  }

  updateLinkPaths(): void {
    if (!this.liensGridRef || !this.linksSvgRef || !this.liensData) {
      this.linkPaths.set([]);
      return;
    }

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

      svgElement.setAttribute('width', String(gridRect.width));
      svgElement.setAttribute('height', String(gridRect.height));
      svgElement.style.width = `${gridRect.width}px`;
      svgElement.style.height = `${gridRect.height}px`;

      const paths: LinkPath[] = [];
      const userLinksMap = this.userLinks();

      for (const [mot, reponse] of userLinksMap.entries()) {
        const motElement = gridElement.querySelector(`[data-mot="${this.escapeForSelector(mot)}"]`) as HTMLElement;
        const reponseElement = gridElement.querySelector(`[data-reponse="${this.escapeForSelector(reponse)}"]`) as HTMLElement;

        if (motElement && reponseElement) {
          const motRect = motElement.getBoundingClientRect();
          const reponseRect = reponseElement.getBoundingClientRect();

          const motCircle = motElement.querySelector('.link-circle') as HTMLElement;
          const reponseCircle = reponseElement.querySelector('.link-circle') as HTMLElement;

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
    return str.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
  }

  submitLiens(): void {
    if (this.disabled || this.isSubmitted()) return;
    if (!this.liensData) return;

    const userLinksArray = Array.from(this.userLinks().entries()).map(([mot, reponse]) => ({ mot, reponse }));
    const correctLinks = this.liensData.liens;

    const isValid = userLinksArray.length === correctLinks.length &&
      userLinksArray.every(link => 
        correctLinks.some(correct => correct.mot === link.mot && correct.reponse === link.reponse)
      );

    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
    this.validated.emit(isValid);
  }

  reset(): void {
    this.userLinks.set(new Map());
    this.selectedMotForLink.set(null);
    this.isSubmitted.set(false);
    this.isCorrect.set(null);
    this.shuffleLiensData();
  }

  canSubmit(): boolean {
    return this.userLinks().size > 0;
  }

  toggleAides(): void {
    this.showAides.update(v => !v);
  }
}

