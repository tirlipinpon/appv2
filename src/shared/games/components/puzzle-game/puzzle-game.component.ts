import { Component, Input, Output, EventEmitter, signal, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { PuzzleData, PuzzlePiece } from '../../types/game-data';
import { GameErrorActionsComponent } from '../game-error-actions/game-error-actions.component';
import { AideSectionComponent } from '../../../components/aide-section/aide-section.component';
import { calculateSnappedPosition, relativeToAbsolute, type Position } from '../../utils/puzzle-magnetism.util';
import Konva from 'konva';

interface PieceState {
  piece: PuzzlePiece;
  x: number; // Position actuelle X (pixels)
  y: number; // Position actuelle Y (pixels)
  konvaImage?: Konva.Image; // Référence à l'image Konva
  isPlaced: boolean; // Si la pièce est à sa position correcte
  targetX: number; // Position cible X (pixels)
  targetY: number; // Position cible Y (pixels)
  originalImageWidth: number; // Largeur originale de l'image de la pièce
  originalImageHeight: number; // Hauteur originale de l'image de la pièce
  isThumbnail: boolean; // Indique si la pièce est actuellement en mode vignette
  thumbnailScale: number; // Facteur d'échelle pour la vignette (0.25 pour 25%)
}

@Component({
  selector: 'app-puzzle-game',
  standalone: true,
  imports: [CommonModule, GameErrorActionsComponent, AideSectionComponent],
  templateUrl: './puzzle-game.component.html',
  styleUrl: './puzzle-game.component.scss',
})
export class PuzzleGameComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) puzzleData!: PuzzleData;
  @Input() showResult = false;
  @Input() disabled = false;
  @Input() aides: string[] | null = null;
  @Input() aideImageUrl: string | null = null; // URL de l'image d'aide
  @Input() aideVideoUrl: string | null = null; // URL de la vidéo d'aide
  @Input() instructions: string | null = null;
  @Input() question: string | null = null;

  @Output() validated = new EventEmitter<boolean>();
  @Output() nextRequested = new EventEmitter<void>();
  @Output() resetRequested = new EventEmitter<void>();

  @ViewChild('container', { static: false }) container!: ElementRef<HTMLDivElement>;

  // État du stage Konva
  private stage?: Konva.Stage;
  private backgroundLayer?: Konva.Layer;
  private mainLayer?: Konva.Layer;
  private dragLayer?: Konva.Layer;
  private backgroundImage?: Konva.Image;

  // Dimensions
  readonly containerWidth = signal<number>(0);
  readonly containerHeight = signal<number>(0);
  readonly displayedImageWidth = signal<number>(0);
  readonly displayedImageHeight = signal<number>(0);
  readonly imageOffsetX = signal<number>(0);
  readonly imageOffsetY = signal<number>(0);

  // État des pièces
  readonly piecesState = signal<PieceState[]>([]);
  readonly imagesLoaded = signal<number>(0);
  readonly totalImages = signal<number>(0);
  readonly isLoading = signal<boolean>(true);

  // État de validation
  readonly isSubmitted = signal<boolean>(false);
  readonly isCorrect = signal<boolean | null>(null);


  // Pièce en cours de drag
  private draggedPiece: PieceState | null = null;
  private draggedKonvaNode: Konva.Image | null = null;

  // Tooltip actuel
  private currentTooltip?: Konva.Label;

  // ResizeObserver
  private resizeObserver?: ResizeObserver;

  // Seuil de snap en pixels
  private readonly SNAP_THRESHOLD = 80;

  ngOnInit(): void {
    this.totalImages.set(this.puzzleData.pieces.length + 1); // +1 pour l'image de fond
    this.imagesLoaded.set(0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['puzzleData'] && !changes['puzzleData'].firstChange) {
      this.initializePuzzle();
    }
  }

  ngAfterViewInit(): void {
    if (this.container?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateDimensions();
      });
      this.resizeObserver.observe(this.container.nativeElement);
    }

    window.addEventListener('resize', this.handleResize.bind(this));
    // Initialiser Konva après que la vue soit rendue
    // Utiliser requestAnimationFrame pour s'assurer que le DOM est rendu
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.updateDimensions();
        // Vérifier que les dimensions sont calculées avant d'initialiser Konva
        if (this.container?.nativeElement?.clientWidth > 0) {
          this.initializeKonva();
        } else {
          // Réessayer si les dimensions ne sont pas encore disponibles
          setTimeout(() => {
            this.updateDimensions();
            if (!this.stage) {
              this.initializeKonva();
            }
          }, 100);
        }
      }, 50);
    });
  }

  ngOnDestroy(): void {
    this.hideTooltip();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    window.removeEventListener('resize', this.handleResize.bind(this));

    if (this.stage) {
      this.stage.destroy();
    }
  }

  private handleResize(): void {
    this.updateDimensions();
  }

  private updateDimensions(): void {
    if (!this.container?.nativeElement || !this.puzzleData) {
      return;
    }

    const container = this.container.nativeElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight || 600; // Hauteur par défaut

    this.containerWidth.set(containerWidth);
    this.containerHeight.set(containerHeight);

    const aspectRatio = this.puzzleData.image_width / this.puzzleData.image_height;
    let displayedWidth = containerWidth;
    let displayedHeight = containerWidth / aspectRatio;

    if (displayedHeight > containerHeight) {
      displayedHeight = containerHeight;
      displayedWidth = displayedHeight * aspectRatio;
    }

    this.displayedImageWidth.set(displayedWidth);
    this.displayedImageHeight.set(displayedHeight);

    const offsetX = (containerWidth - displayedWidth) / 2;
    const offsetY = (containerHeight - displayedHeight) / 2;
    this.imageOffsetX.set(offsetX);
    this.imageOffsetY.set(offsetY);

    if (this.stage) {
      this.stage.width(containerWidth);
      this.stage.height(containerHeight);
      this.updatePiecesDimensions();
      this.updateKonvaLayers();
    }
  }

  private async initializeKonva(): Promise<void> {
    if (!this.container?.nativeElement || !this.puzzleData) {
      return;
    }

    // Ne pas créer le stage s'il existe déjà
    if (this.stage) {
      return;
    }

    const container = this.container.nativeElement;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    if (width === 0 || height === 0) {
      // Réessayer après un court délai si les dimensions ne sont pas encore disponibles
      setTimeout(() => this.initializeKonva(), 100);
      return;
    }

    // Créer le stage
    this.stage = new Konva.Stage({
      container: container,
      width: width,
      height: height,
    });

    // Créer les layers
    this.backgroundLayer = new Konva.Layer();
    this.mainLayer = new Konva.Layer();
    this.dragLayer = new Konva.Layer();

    this.stage.add(this.backgroundLayer);
    this.stage.add(this.mainLayer);
    this.stage.add(this.dragLayer);

    // Initialiser le puzzle
    await this.initializePuzzle();
  }

  private async initializePuzzle(): Promise<void> {
    if (!this.puzzleData || !this.backgroundLayer || !this.mainLayer) {
      return;
    }

    this.isLoading.set(true);
    this.imagesLoaded.set(0);

    // Charger l'image de fond
    await this.loadBackgroundImage();

    // Charger et positionner les pièces
    await this.loadPieces();

    this.isLoading.set(false);
    this.updateKonvaLayers();
  }

  private async loadBackgroundImage(): Promise<void> {
    if (!this.backgroundLayer || !this.puzzleData) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const imageObj = new Image();
      imageObj.crossOrigin = 'anonymous';
      imageObj.onload = () => {
        const width = this.displayedImageWidth() || this.puzzleData.image_width;
        const height = this.displayedImageHeight() || this.puzzleData.image_height;
        const offsetX = this.imageOffsetX();
        const offsetY = this.imageOffsetY();

        this.backgroundImage = new Konva.Image({
          x: offsetX,
          y: offsetY,
          image: imageObj,
          width: width,
          height: height,
          opacity: 0.3, // Légèrement transparent pour voir les pièces
        });

        this.backgroundLayer!.add(this.backgroundImage);
        this.backgroundLayer!.draw();

        this.imagesLoaded.update(count => count + 1);
        resolve();
      };
      imageObj.onerror = () => {
        console.error('Erreur de chargement de l\'image de fond');
        reject(new Error('Erreur de chargement de l\'image de fond'));
      };
      imageObj.src = this.puzzleData.image_url;
    });
  }

  private async loadPieces(): Promise<void> {
    if (!this.mainLayer || !this.puzzleData) {
      return;
    }

    if (!this.puzzleData.pieces || this.puzzleData.pieces.length === 0) {
      return;
    }

    const width = this.displayedImageWidth() || this.puzzleData.image_width;
    const height = this.displayedImageHeight() || this.puzzleData.image_height;
    const offsetX = this.imageOffsetX();
    const offsetY = this.imageOffsetY();

    const piecesState: PieceState[] = [];

    // Créer les états des pièces avec leurs positions cibles
    for (const piece of this.puzzleData.pieces) {
      const targetPos = relativeToAbsolute(piece.original_x, piece.original_y, width, height);
      piecesState.push({
        piece,
        x: targetPos.x + offsetX, // Position actuelle = position cible au départ
        y: targetPos.y + offsetY,
        targetX: targetPos.x + offsetX,
        targetY: targetPos.y + offsetY,
        isPlaced: false,
        originalImageWidth: 0, // Sera défini lors du chargement de l'image
        originalImageHeight: 0, // Sera défini lors du chargement de l'image
        isThumbnail: false, // Sera initialisé à true dans loadPieceImage
        thumbnailScale: 0.25, // 25% de la taille
      });
    }

    this.piecesState.set(piecesState);

    // Charger toutes les images des pièces
    const loadPromises = piecesState.map((pieceState, index) => this.loadPieceImage(pieceState, index));
    await Promise.all(loadPromises);

    // Mélanger les pièces après chargement
    this.shufflePieces();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async loadPieceImage(pieceState: PieceState, _index: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!pieceState.piece.image_url) {
        console.error(`Pièce ${pieceState.piece.id} n'a pas d'URL d'image`);
        this.imagesLoaded.update(count => count + 1);
        resolve();
        return;
      }

      const imageObj = new Image();
      imageObj.crossOrigin = 'anonymous';
      imageObj.onload = () => {
        if (!this.mainLayer) {
          console.error('MainLayer non disponible lors du chargement de la pièce');
          this.imagesLoaded.update(count => count + 1);
          resolve();
          return;
        }

        // Calculer le ratio de redimensionnement de l'image de fond
        const displayedWidth = this.displayedImageWidth() || this.puzzleData.image_width;
        const displayedHeight = this.displayedImageHeight() || this.puzzleData.image_height;
        const scaleX = displayedWidth / this.puzzleData.image_width;
        const scaleY = displayedHeight / this.puzzleData.image_height;

        // Stocker les dimensions originales de l'image
        pieceState.originalImageWidth = imageObj.width;
        pieceState.originalImageHeight = imageObj.height;

        // Initialiser en mode vignette
        pieceState.isThumbnail = true;
        pieceState.thumbnailScale = 0.25;

        // Calculer la taille vignette (25% de la taille réelle)
        const thumbnailWidth = imageObj.width * scaleX * pieceState.thumbnailScale;
        const thumbnailHeight = imageObj.height * scaleY * pieceState.thumbnailScale;

        const konvaImage = new Konva.Image({
          x: pieceState.x,
          y: pieceState.y,
          image: imageObj,
          width: thumbnailWidth,
          height: thumbnailHeight,
          draggable: !this.disabled && !this.isSubmitted(),
        });

        // Ajouter des événements de drag
        konvaImage.on('dragstart', () => {
          this.onPieceDragStart(pieceState, konvaImage);
        });

        konvaImage.on('dragmove', () => {
          this.onPieceDragMove(pieceState, konvaImage);
        });

        konvaImage.on('dragend', () => {
          this.onPieceDragEnd(pieceState, konvaImage);
        });

        // Ajouter tooltip au survol (si nom défini)
        if (pieceState.piece.name) {
          konvaImage.on('mouseenter', () => {
            this.showTooltip(pieceState.piece.name!, konvaImage);
          });

          konvaImage.on('mouseleave', () => {
            this.hideTooltip();
          });
        }

        pieceState.konvaImage = konvaImage;
        this.mainLayer.add(konvaImage);
        
        // Redessiner le layer après avoir ajouté l'image
        this.mainLayer.draw();

        this.imagesLoaded.update(count => count + 1);
        resolve();
      };
      imageObj.onerror = (error) => {
        console.error(`Erreur de chargement de l'image de la pièce ${pieceState.piece.id}:`, pieceState.piece.image_url, error);
        this.imagesLoaded.update(count => count + 1);
        resolve(); // Continuer même si une image échoue
      };
      imageObj.src = pieceState.piece.image_url;
    });
  }

  private shufflePieces(): void {
    const piecesState = this.piecesState();
    if (piecesState.length === 0) {
      return;
    }

    const containerWidth = this.containerWidth();
    const containerHeight = this.containerHeight();
    const width = this.displayedImageWidth();
    const height = this.displayedImageHeight();
    const offsetX = this.imageOffsetX();
    const offsetY = this.imageOffsetY();

    // Zone à droite de l'image pour placer les pièces mélangées (plus accessible)
    const shuffleAreaPadding = 20;
    const shuffleAreaX = offsetX + width + shuffleAreaPadding;
    
    // Calculer la largeur disponible en tenant compte du padding de droite
    // S'assurer qu'il y a au moins 150px de largeur disponible
    const availableWidth = containerWidth - shuffleAreaX - shuffleAreaPadding;
    const shuffleAreaWidth = Math.max(150, availableWidth);
    
    const shuffleAreaY = offsetY;
    const shuffleAreaHeight = Math.min(height, containerHeight - shuffleAreaY - shuffleAreaPadding);

    // Mélanger les pièces et les positionner aléatoirement
    for (let i = piecesState.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [piecesState[i], piecesState[j]] = [piecesState[j], piecesState[i]];
    }

    // Positionner chaque pièce dans la zone à droite de l'image
    // Organiser les pièces en grille pour un meilleur accès
    const cols = Math.ceil(Math.sqrt(piecesState.length));
    const rows = Math.ceil(piecesState.length / cols);
    const cellWidth = shuffleAreaWidth / cols;
    const cellHeight = shuffleAreaHeight / rows;

    piecesState.forEach((pieceState, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      // Calculer la position dans la cellule
      const cellX = shuffleAreaX + col * cellWidth;
      const cellY = shuffleAreaY + row * cellHeight;
      
      // Calculer la largeur maximale d'une pièce en vignette pour cette cellule
      const maxPieceWidth = cellWidth * 0.8; // 80% de la largeur de la cellule
      
      // Position aléatoire dans la cellule, mais s'assurer qu'elle ne dépasse pas
      const randomOffsetX = Math.random() * (cellWidth * 0.6); // Réduire à 60% pour plus de marge
      const randomOffsetY = Math.random() * (cellHeight * 0.6);
      
      let randomX = cellX + randomOffsetX;
      let randomY = cellY + randomOffsetY;
      
      // S'assurer que la pièce ne dépasse pas du conteneur
      // Tenir compte de la largeur de la pièce en vignette
      if (pieceState.konvaImage) {
        const pieceWidth = pieceState.konvaImage.width() || maxPieceWidth;
        const pieceHeight = pieceState.konvaImage.height() || cellHeight * 0.8;
        
        // Ajuster la position X pour que la pièce reste dans les limites
        const maxX = containerWidth - shuffleAreaPadding - pieceWidth;
        randomX = Math.min(randomX, maxX);
        
        // Ajuster la position Y pour que la pièce reste dans les limites
        const maxY = containerHeight - shuffleAreaPadding - pieceHeight;
        randomY = Math.min(randomY, maxY);
        
        // S'assurer que la position est au moins au début de la zone
        randomX = Math.max(randomX, shuffleAreaX);
        randomY = Math.max(randomY, shuffleAreaY);
      }

      pieceState.x = randomX;
      pieceState.y = randomY;
      pieceState.isPlaced = false;

      if (pieceState.konvaImage) {
        pieceState.konvaImage.x(randomX);
        pieceState.konvaImage.y(randomY);
      }
    });

    this.piecesState.set([...piecesState]);
    this.updateKonvaLayers();
  }

  private onPieceDragStart(pieceState: PieceState, konvaImage: Konva.Image): void {
    if (this.disabled || this.isSubmitted()) {
      return;
    }

    this.draggedPiece = pieceState;
    this.draggedKonvaNode = konvaImage;

    // Si la pièce est en mode vignette, l'agrandir à taille réelle
    if (pieceState.isThumbnail) {
      const displayedWidth = this.displayedImageWidth() || this.puzzleData.image_width;
      const displayedHeight = this.displayedImageHeight() || this.puzzleData.image_height;
      const scaleX = displayedWidth / this.puzzleData.image_width;
      const scaleY = displayedHeight / this.puzzleData.image_height;

      // Calculer la taille réelle complète
      const fullWidth = pieceState.originalImageWidth * scaleX;
      const fullHeight = pieceState.originalImageHeight * scaleY;

      // Animer l'agrandissement
      const growAnim = new Konva.Tween({
        node: konvaImage,
        width: fullWidth,
        height: fullHeight,
        duration: 0.2,
        easing: Konva.Easings.EaseOut,
        onFinish: () => {
          pieceState.isThumbnail = false;
        },
      });

      growAnim.play();
    }

    // Déplacer la pièce sur le drag layer
    konvaImage.moveTo(this.dragLayer!);
    this.dragLayer!.draw();
  }

  private onPieceDragMove(pieceState: PieceState, konvaImage: Konva.Image): void {
    // Mettre à jour la position dans l'état
    pieceState.x = konvaImage.x();
    pieceState.y = konvaImage.y();
    pieceState.isPlaced = false;
  }

  private onPieceDragEnd(pieceState: PieceState, konvaImage: Konva.Image): void {
    if (!this.draggedPiece || !this.draggedKonvaNode) {
      return;
    }

    // Calculer les dimensions
    const displayedWidth = this.displayedImageWidth() || this.puzzleData.image_width;
    const displayedHeight = this.displayedImageHeight() || this.puzzleData.image_height;
    const scaleX = displayedWidth / this.puzzleData.image_width;
    const scaleY = displayedHeight / this.puzzleData.image_height;

    // Dimensions à taille réelle
    const fullWidth = pieceState.originalImageWidth * scaleX;
    const fullHeight = pieceState.originalImageHeight * scaleY;

    // Dimensions vignette
    const thumbnailWidth = fullWidth * pieceState.thumbnailScale;
    const thumbnailHeight = fullHeight * pieceState.thumbnailScale;

   // Calculer un seuil de snap dynamique basé sur la taille de la pièce
   const pieceWidth = konvaImage.width() || 50;
   const pieceHeight = konvaImage.height() || 50;
   const avgPieceSize = (pieceWidth + pieceHeight) / 2;
   const dynamicSnapThreshold = Math.max(15, avgPieceSize * 0.12); // 12% de la taille, min 15px
 
   // Calculer la position aimantée avec le seuil dynamique
   const currentPos: Position = { x: konvaImage.x(), y: konvaImage.y() };
   const targetPos: Position = { x: pieceState.targetX, y: pieceState.targetY };
   const snapped = calculateSnappedPosition(currentPos, targetPos, dynamicSnapThreshold);

    // Calculer la zone des vignettes (à droite de l'image)
    const offsetX = this.imageOffsetX();
    const shuffleAreaPadding = 20;
    const shuffleAreaX = offsetX + displayedWidth + shuffleAreaPadding;

    // Vérifier si la position finale est dans la zone des vignettes
    const isFinalPositionInThumbnailZone = snapped.x > shuffleAreaX;

    // Déterminer la taille finale selon 3 cas :
    // 1. Si snappée → taille réelle + placée
    // 2. Si dans zone vignette → taille vignette + non placée
    // 3. Sinon (relâchée ailleurs sur l'image) → taille réelle + non placée
    let finalWidth: number;
    let finalHeight: number;

    if (snapped.snapped) {
      // Cas 1 : Snappée à la bonne position
      finalWidth = fullWidth;
      finalHeight = fullHeight;
      pieceState.isThumbnail = false;
    } else if (isFinalPositionInThumbnailZone) {
      // Cas 2 : Relâchée dans la zone des vignettes (à droite)
      finalWidth = thumbnailWidth;
      finalHeight = thumbnailHeight;
      pieceState.isThumbnail = true;
    } else {
      // Cas 3 : Relâchée ailleurs sur l'image (mais pas snappée)
      // RESTER en taille réelle (ne pas revenir en vignette)
      finalWidth = fullWidth;
      finalHeight = fullHeight;
      pieceState.isThumbnail = false;
    }
 
    // Animer vers la position et la taille finale
    const anim = new Konva.Tween({
      node: konvaImage,
      x: snapped.x,
      y: snapped.y,
      width: finalWidth,
      height: finalHeight,
      duration: snapped.snapped ? 0.2 : 0.1,
      easing: Konva.Easings.EaseOut,
      onFinish: () => {
        pieceState.x = snapped.x;
        pieceState.y = snapped.y;
        pieceState.isPlaced = snapped.snapped;

        // Remettre la pièce sur le main layer
        konvaImage.moveTo(this.mainLayer!);
        this.updateKonvaLayers();
        this.checkCompletion();
      },
    });

    anim.play();

    this.draggedPiece = null;
    this.draggedKonvaNode = null;
  }

  private showTooltip(name: string, konvaImage: Konva.Image): void {
    // Supprimer le tooltip précédent s'il existe
    this.hideTooltip();

    // Créer un tooltip Konva (Label avec Tag)
    const tooltip = new Konva.Label({
      x: konvaImage.x() + 10,
      y: konvaImage.y() - 30,
    });

    tooltip.add(
      new Konva.Tag({
        fill: 'rgba(0, 0, 0, 0.8)',
        cornerRadius: 4,
        pointerDirection: 'down',
        pointerWidth: 10,
        pointerHeight: 10,
      })
    );

    tooltip.add(
      new Konva.Text({
        text: name,
        fontFamily: 'Arial',
        fontSize: 14,
        padding: 5,
        fill: 'white',
      })
    );

    this.currentTooltip = tooltip;
    this.dragLayer!.add(tooltip);
    this.dragLayer!.draw();
  }

  private hideTooltip(): void {
    if (this.currentTooltip) {
      this.currentTooltip.destroy();
      this.currentTooltip = undefined;
      if (this.dragLayer) {
        this.dragLayer.draw();
      }
    }
  }

  private updatePiecesDimensions(): void {
    const piecesState = this.piecesState();
    if (piecesState.length === 0) {
      return;
    }

    const displayedWidth = this.displayedImageWidth() || this.puzzleData.image_width;
    const displayedHeight = this.displayedImageHeight() || this.puzzleData.image_height;
    const scaleX = displayedWidth / this.puzzleData.image_width;
    const scaleY = displayedHeight / this.puzzleData.image_height;
    const offsetX = this.imageOffsetX();
    const offsetY = this.imageOffsetY();

    // Mettre à jour les dimensions et positions des pièces
    piecesState.forEach((pieceState) => {
      if (pieceState.konvaImage && pieceState.originalImageWidth > 0 && pieceState.originalImageHeight > 0) {
        let pieceWidth: number;
        let pieceHeight: number;

        if (pieceState.isThumbnail) {
          // Si en mode vignette, utiliser la taille vignette
          pieceWidth = pieceState.originalImageWidth * scaleX * pieceState.thumbnailScale;
          pieceHeight = pieceState.originalImageHeight * scaleY * pieceState.thumbnailScale;
        } else {
          // Si en mode taille réelle, utiliser la taille complète
          pieceWidth = pieceState.originalImageWidth * scaleX;
          pieceHeight = pieceState.originalImageHeight * scaleY;
        }
        
        pieceState.konvaImage.width(pieceWidth);
        pieceState.konvaImage.height(pieceHeight);

        // Mettre à jour les positions cibles
        const targetPos = relativeToAbsolute(
          pieceState.piece.original_x,
          pieceState.piece.original_y,
          displayedWidth,
          displayedHeight
        );
        pieceState.targetX = targetPos.x + offsetX;
        pieceState.targetY = targetPos.y + offsetY;
      }
    });

    this.piecesState.set([...piecesState]);
  }

  private updateKonvaLayers(): void {
    if (this.backgroundLayer) {
      this.backgroundLayer.draw();
    }
    if (this.mainLayer) {
      this.mainLayer.draw();
    }
    if (this.dragLayer) {
      this.dragLayer.draw();
    }
  }

  private checkCompletion(): void {
    const piecesState = this.piecesState();
    const allPlaced = piecesState.every(p => p.isPlaced);

    if (allPlaced && piecesState.length > 0) {
      this.validate();
    }
  }

  validate(): void {
    if (this.isSubmitted()) {
      return;
    }

    const piecesState = this.piecesState();
    const allPlaced = piecesState.every(p => p.isPlaced);

    this.isSubmitted.set(true);
    this.isCorrect.set(allPlaced);
    this.validated.emit(allPlaced);
  }

  reset(): void {
    const piecesState = this.piecesState();
    const displayedWidth = this.displayedImageWidth() || this.puzzleData.image_width;
    const displayedHeight = this.displayedImageHeight() || this.puzzleData.image_height;
    const scaleX = displayedWidth / this.puzzleData.image_width;
    const scaleY = displayedHeight / this.puzzleData.image_height;

    // Remettre toutes les pièces en mode vignette
    piecesState.forEach(pieceState => {
      pieceState.isPlaced = false;
      pieceState.isThumbnail = true;

      // Remettre les dimensions en vignette
      if (pieceState.konvaImage && pieceState.originalImageWidth > 0 && pieceState.originalImageHeight > 0) {
        const thumbnailWidth = pieceState.originalImageWidth * scaleX * pieceState.thumbnailScale;
        const thumbnailHeight = pieceState.originalImageHeight * scaleY * pieceState.thumbnailScale;
        pieceState.konvaImage.width(thumbnailWidth);
        pieceState.konvaImage.height(thumbnailHeight);
      }
    });

    this.piecesState.set([...piecesState]);
    this.isSubmitted.set(false);
    this.isCorrect.set(null);
    this.shufflePieces();
    this.resetRequested.emit();
  }

}
