import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit, inject, signal, computed, ViewChild, ElementRef, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ConfirmationDialogService } from '../../../../../../shared';
import type { PuzzleData, PuzzlePiece } from '@shared/games';
import { PuzzleValidationService } from '../../../../services/puzzle/puzzle-validation.service';
import { PuzzleImageOptimizerService } from '../../../../services/puzzle/puzzle-image-optimizer.service';
import { PuzzlePieceGeneratorService } from '../../../../services/puzzle/puzzle-piece-generator.service';
import { PuzzleStorageService } from '../../../../services/puzzle/puzzle-storage.service';

interface PieceInEdit {
  id: string;
  name?: string;
  polygon_points: { x: number; y: number }[]; // Points en coordonnées relatives (0-1)
  original_x: number; // Position X originale relative (0-1)
  original_y: number; // Position Y originale relative (0-1)
  image_url?: string; // URL de la pièce générée (optionnel, défini après génération)
}

// Interface étendue pour les données en cours d'édition avec le fichier File
export interface PuzzleDataWithFile extends PuzzleData {
  imageFile?: File; // Fichier à uploader lors de la sauvegarde
  oldImageUrl?: string; // URL de l'ancienne image à supprimer si on remplace l'image
}

@Component({
  selector: 'app-puzzle-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './puzzle-form.component.html',
  styleUrls: ['./puzzle-form.component.scss'],
})
export class PuzzleFormComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly confirmationDialog = inject(ConfirmationDialogService);
  private readonly puzzleValidation = inject(PuzzleValidationService);
  private readonly imageOptimizer = inject(PuzzleImageOptimizerService);
  private readonly pieceGenerator = inject(PuzzlePieceGeneratorService);
  private readonly storageService = inject(PuzzleStorageService);

  @Input() initialData: PuzzleData | null = null;
  @Output() dataChange = new EventEmitter<PuzzleDataWithFile>();
  @Output() validityChange = new EventEmitter<boolean>();

  @ViewChild('imageContainer', { static: false }) imageContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('imageElement', { static: false }) imageElement!: ElementRef<HTMLImageElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;

  form: FormGroup;
  private isInitializing = false;
  private lastInitialDataHash: string | null = null;

  // État de l'image
  readonly imageUrl = signal<string | null>(null);
  readonly imageWidth = signal<number>(0);
  readonly imageHeight = signal<number>(0);
  readonly displayedImageWidth = signal<number>(0);
  readonly displayedImageHeight = signal<number>(0);
  readonly imageOffsetX = signal<number>(0);
  readonly imageOffsetY = signal<number>(0);
  private imageLoaded = signal<boolean>(false);

  // Signal qui devient true quand TOUS les éléments sont prêts pour dessiner
  private readonly isReadyToDraw = computed(() => {
    return (
      this.imageLoaded() &&
      this.displayedImageWidth() > 0 &&
      this.displayedImageHeight() > 0 &&
      this.ctx() !== null &&
      this.imageUrl() !== null &&
      this.pieces().length >= 0 // Juste pour que Angular recalcule quand les pièces changent
    );
  });

  // Fichier sélectionné
  private imageFile = signal<File | null>(null);
  private oldImageUrl = signal<string | null>(null);

  // Pièces
  readonly pieces = signal<PieceInEdit[]>([]);
  readonly selectedPieceId = signal<string | null>(null);

  // Polygone en cours de création
  readonly polygonPoints = signal<{ x: number; y: number }[]>([]);
  readonly isCreatingPolygon = signal<boolean>(false);

  // Canvas pour affichage - MAINTENANT UN SIGNAL pour que Angular le track
  private ctx = signal<CanvasRenderingContext2D | null>(null);
  private resizeObserver?: ResizeObserver;

  constructor() {
    this.form = this.fb.group({});
    
    // Auto-redessinage quand tout est prêt
    // Cette fonction s'exécutera automatiquement chaque fois que isReadyToDraw change
    effect(() => {
      if (this.isReadyToDraw()) {
        // Petit délai pour s'assurer que le DOM est complètement rendu
        setTimeout(() => {
          this.drawCanvas();
        }, 10);
      }
    });
  }

  ngOnInit(): void {
    if (this.initialData) {
      this.loadInitialData();
    }
  }

  ngAfterViewInit(): void {
    if (this.canvasElement?.nativeElement) {
      this.ctx.set(this.canvasElement.nativeElement.getContext('2d'));
    }

    if (this.imageContainer?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateImageDimensions();
      });
      this.resizeObserver.observe(this.imageContainer.nativeElement);
    }

    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Charger les données initiales si elles existent et que le composant est prêt
    if (this.initialData) {
      const dataHash = this.getDataHash(this.initialData);
      if (dataHash !== this.lastInitialDataHash || this.pieces().length === 0) {
        this.lastInitialDataHash = dataHash;
        setTimeout(() => {
          this.loadInitialData();
        }, 100);
      } else {
        setTimeout(() => this.updateImageDimensions(), 100);
      }
    } else {
      // Juste appeler updateImageDimensions
      // Le signal computed isReadyToDraw s'occupera du redessinage automatiquement
      setTimeout(() => {
        this.updateImageDimensions();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    window.removeEventListener('resize', this.handleResize.bind(this));

    const imageUrl = this.imageUrl();
    if (imageUrl && imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData']) {
      // Créer un hash des données pour détecter les changements même si la référence ne change pas
      const dataHash = this.initialData ? this.getDataHash(this.initialData) : null;
      
      if (dataHash !== this.lastInitialDataHash && this.initialData && !this.isInitializing) {
        this.lastInitialDataHash = dataHash;
        this.loadInitialData();
      }
    }
  }
  
  private getDataHash(data: PuzzleData): string {
    // Créer un hash simple basé sur les propriétés importantes
    try {
      return JSON.stringify({
        image_url: data.image_url,
        image_width: data.image_width,
        image_height: data.image_height,
        pieces_count: data.pieces?.length || 0,
        pieces_ids: data.pieces?.map(p => p.id).sort().join(',') || '',
      });
    } catch {
      return '';
    }
  }

  private loadInitialData(): void {
    if (!this.initialData) {
      return;
    }

    this.isInitializing = true;
    this.oldImageUrl.set(this.initialData.image_url);
    this.imageUrl.set(this.initialData.image_url);
    this.imageWidth.set(this.initialData.image_width);
    this.imageHeight.set(this.initialData.image_height);
    this.imageFile.set(null);

    // Faire une copie profonde des pièces pour éviter les problèmes de référence
    const pieces: PieceInEdit[] = (this.initialData.pieces || []).map(piece => ({
      id: piece.id || crypto.randomUUID(),
      name: piece.name,
      // Copie profonde du tableau polygon_points
      polygon_points: Array.isArray(piece.polygon_points) 
        ? piece.polygon_points.map(p => ({ x: p.x, y: p.y }))
        : [],
      original_x: piece.original_x ?? 0,
      original_y: piece.original_y ?? 0,
      image_url: piece.image_url,
    }));

    this.pieces.set(pieces);
    this.isInitializing = false;
    
    // SIMPLIFIÉ : Juste mettre à jour les dimensions
    // Le signal computed isReadyToDraw s'occupera du redessinage automatiquement
    setTimeout(() => {
      this.updateImageDimensions();
      
      // Vérifier si l'image est déjà chargée (cache)
      const img = this.imageElement?.nativeElement;
      if (img && img.complete && img.naturalWidth > 0) {
        this.imageLoaded.set(true);
      }
      // Sinon, onImageLoad() sera appelé quand l'image se chargera
    }, 100);
    
    this.emitDataChange();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      // Optimiser l'image
      const optimizedFile = await this.imageOptimizer.optimizeUploadImage(file);
      const dimensions = await this.imageOptimizer.getImageDimensions(optimizedFile);

      this.imageFile.set(optimizedFile);
      this.oldImageUrl.set(null);

      const blobUrl = URL.createObjectURL(optimizedFile);
      this.imageUrl.set(blobUrl);
      this.imageWidth.set(dimensions.width);
      this.imageHeight.set(dimensions.height);

      // Réinitialiser les pièces
      this.pieces.set([]);
      this.polygonPoints.set([]);
      this.isCreatingPolygon.set(false);
      this.imageLoaded.set(false);

      this.updateImageDimensions();
      this.emitDataChange();
    } catch (error) {
      console.error('Erreur lors de l\'optimisation de l\'image:', error);
    }
  }

  updateImageDimensions(): void {
    if (!this.imageElement?.nativeElement || !this.imageContainer?.nativeElement) {
      return;
    }

    const img = this.imageElement.nativeElement;
    const container = this.imageContainer.nativeElement;

    if (!img.complete || img.naturalWidth === 0) {
      if (!img.src) {
        return;
      }
      // Attendre que l'image soit chargée, puis redessiner
      img.onload = () => {
        this.imageLoaded.set(true);
        this.updateImageDimensions();
        // Le signal computed isReadyToDraw s'occupera du redessinage automatiquement
      };
      return;
    }

    const containerWidth = container.clientWidth;
    const originalWidth = this.imageWidth();
    const originalHeight = this.imageHeight();

    if (originalWidth === 0 || originalHeight === 0) {
      return;
    }

    const aspectRatio = originalWidth / originalHeight;
    let displayedWidth = containerWidth;
    let displayedHeight = containerWidth / aspectRatio;

    if (displayedHeight > container.clientHeight) {
      displayedHeight = container.clientHeight;
      displayedWidth = displayedHeight * aspectRatio;
    }

    this.displayedImageWidth.set(displayedWidth);
    this.displayedImageHeight.set(displayedHeight);

    const offsetX = (containerWidth - displayedWidth) / 2;
    const offsetY = (container.clientHeight - displayedHeight) / 2;
    this.imageOffsetX.set(offsetX);
    this.imageOffsetY.set(offsetY);

    // Mettre à jour le canvas
    if (this.canvasElement?.nativeElement) {
      this.canvasElement.nativeElement.width = displayedWidth;
      this.canvasElement.nativeElement.height = displayedHeight;
      // Le signal computed isReadyToDraw s'occupera du redessinage automatiquement
    }
  }

  private handleResize(): void {
    this.updateImageDimensions();
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.imageUrl() || this.isCreatingPolygon() === false) {
      return;
    }

    const rect = this.canvasElement.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convertir en coordonnées relatives
    const relativeX = x / this.displayedImageWidth();
    const relativeY = y / this.displayedImageHeight();

    this.polygonPoints.update(points => [...points, { x: relativeX, y: relativeY }]);
    this.drawCanvas();
  }

  startCreatingPolygon(): void {
    this.isCreatingPolygon.set(true);
    this.polygonPoints.set([]);
    this.selectedPieceId.set(null);
  }

  cancelPolygon(): void {
    this.isCreatingPolygon.set(false);
    this.polygonPoints.set([]);
    this.drawCanvas();
  }

  removeLastPolygonPoint(): void {
    this.polygonPoints.update(points => points.slice(0, -1));
    this.drawCanvas();
  }

  finalizePolygon(): void {
    const points = this.polygonPoints();
    if (!this.puzzleValidation.validatePolygon(points)) {
      alert('Un polygone doit avoir au moins 3 points');
      return;
    }

    if (this.puzzleValidation.hasIntersections(points)) {
      alert('Le polygone ne peut pas avoir d\'auto-intersections');
      return;
    }

    // Calculer le centre du polygone pour original_x/y
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

    const newPiece: PieceInEdit = {
      id: crypto.randomUUID(),
      polygon_points: [...points],
      original_x: centerX,
      original_y: centerY,
    };

    this.pieces.update(pieces => [...pieces, newPiece]);
    this.isCreatingPolygon.set(false);
    this.polygonPoints.set([]);
    // Le signal computed isReadyToDraw s'occupera du redessinage automatiquement
    this.emitDataChange();
  }

  deletePiece(pieceId: string): void {
    this.confirmationDialog.confirm({
      title: 'Supprimer la pièce',
      message: 'Êtes-vous sûr de vouloir supprimer cette pièce ?',
    }).then((confirmed) => {
      if (confirmed) {
        this.pieces.update(pieces => pieces.filter(p => p.id !== pieceId));
        if (this.selectedPieceId() === pieceId) {
          this.selectedPieceId.set(null);
        }
        // Le signal computed isReadyToDraw s'occupera du redessinage automatiquement
        this.emitDataChange();
      }
    });
  }

  updatePieceName(pieceId: string, name: string): void {
    this.pieces.update(pieces =>
      pieces.map(p => p.id === pieceId ? { ...p, name: name.trim() || undefined } : p)
    );
    this.emitDataChange();
  }

  onImageLoad(): void {
    this.imageLoaded.set(true);
    this.updateImageDimensions();
    // Le signal computed isReadyToDraw s'occupera du redessinage automatiquement
  }

  private drawCanvas(): void {
    if (!this.ctx() || !this.imageUrl()) {
      return;
    }

    const width = this.displayedImageWidth();
    const height = this.displayedImageHeight();

    if (width === 0 || height === 0) {
      return;
    }

    // Effacer le canvas
    this.ctx()!.clearRect(0, 0, width, height);

    // Dessiner l'image de fond
    const img = this.imageElement.nativeElement;
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      this.ctx()!.drawImage(img, 0, 0, width, height);
    } else {
      // Si l'image n'est pas encore chargée, attendre et redessiner
      if (img && img.src) {
        img.onload = () => {
          if (this.ctx() && width > 0 && height > 0) {
            this.ctx()!.clearRect(0, 0, width, height);
            this.ctx()!.drawImage(img, 0, 0, width, height);
            // Redessiner les polygones après le chargement de l'image
            this.drawPolygons();
          }
        };
        return;
      }
    }

    // Dessiner les polygones
    this.drawPolygons();
  }

  private drawPolygons(): void {
    if (!this.ctx()) {
      return;
    }

    // Dessiner les pièces validées
    const pieces = this.pieces();
    pieces.forEach(piece => {
      if (piece.polygon_points && piece.polygon_points.length > 0) {
        this.drawPolygon(piece.polygon_points, piece.id === this.selectedPieceId() ? '#00ff00' : '#ff0000');
      }
    });

    // Dessiner le polygone en cours de création
    if (this.isCreatingPolygon()) {
      const points = this.polygonPoints();
      if (points.length > 0) {
        this.drawPolygon(points, '#00aaff');
      }
    }
  }

  private drawPolygon(points: { x: number; y: number }[], color: string): void {
    if (!this.ctx() || points.length < 2) {
      return;
    }

    const width = this.displayedImageWidth();
    const height = this.displayedImageHeight();

    if (width === 0 || height === 0) {
      return;
    }

    // Vérifier le format des points (relatif 0-1 ou absolu)
    // Si les points sont > 1, ils sont probablement en coordonnées absolues
    // et doivent être convertis en coordonnées relatives
    const firstPoint = points[0];
    const isAbsolute = firstPoint.x > 1 || firstPoint.y > 1;

    this.ctx()!.strokeStyle = color;
    this.ctx()!.lineWidth = 2;
    this.ctx()!.beginPath();

    points.forEach((p, i) => {
      let x: number;
      let y: number;
      
      if (isAbsolute) {
        // Convertir des coordonnées absolues (pixels) vers les coordonnées du canvas
        // Les points sont en pixels de l'image originale, on doit les convertir
        const scaleX = width / this.imageWidth();
        const scaleY = height / this.imageHeight();
        x = p.x * scaleX;
        y = p.y * scaleY;
      } else {
        // Coordonnées relatives (0-1), conversion directe
        x = p.x * width;
        y = p.y * height;
      }
      
      if (i === 0) {
        this.ctx()!.moveTo(x, y);
      } else {
        this.ctx()!.lineTo(x, y);
      }
    });

    this.ctx()!.closePath();
    this.ctx()!.stroke();

    // Dessiner les points
    points.forEach(p => {
      let x: number;
      let y: number;
      
      if (isAbsolute) {
        const scaleX = width / this.imageWidth();
        const scaleY = height / this.imageHeight();
        x = p.x * scaleX;
        y = p.y * scaleY;
      } else {
        x = p.x * width;
        y = p.y * height;
      }
      
      this.ctx()!.fillStyle = color;
      this.ctx()!.beginPath();
      this.ctx()!.arc(x, y, 5, 0, 2 * Math.PI);
      this.ctx()!.fill();
    });
  }

  private emitDataChange(): void {
    if (this.isInitializing) {
      return;
    }

    const imageUrl = this.imageUrl();
    const imageFile = this.imageFile();
    const pieces = this.pieces();

    if (!imageUrl) {
      this.validityChange.emit(false);
      return;
    }

    // Convertir les pièces en format PuzzlePiece (sans image_url pour l'instant, sera généré plus tard)
    const puzzlePieces: PuzzlePiece[] = pieces.map(piece => ({
      id: piece.id,
      name: piece.name,
      polygon_points: piece.polygon_points,
      original_x: piece.original_x,
      original_y: piece.original_y,
      image_url: piece.image_url || '', // Sera rempli après génération des PNG
    }));

    const puzzleData: PuzzleDataWithFile = {
      image_url: imageUrl.startsWith('blob:') ? '' : imageUrl,
      image_width: this.imageWidth(),
      image_height: this.imageHeight(),
      pieces: puzzlePieces,
      imageFile: imageFile || undefined,
      oldImageUrl: this.oldImageUrl() || undefined,
    };

    this.dataChange.emit(puzzleData);
    this.validityChange.emit(pieces.length > 0);
  }

  readonly canFinalizePolygon = computed(() => {
    return this.isCreatingPolygon() && this.polygonPoints().length >= 3;
  });
}
