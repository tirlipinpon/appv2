import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit, inject, signal, computed, effect, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DragDropModule, CdkDragMove, CdkDragEnd } from '@angular/cdk/drag-drop';
import type { ImageInteractiveData, ImageInteractiveZone } from '../../../../types/game-data';

interface ZoneInEdit {
  id: string;
  is_correct: boolean;
  name?: string;
  // Format rectangle (rétrocompatibilité)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // Format polygone (nouveau)
  points?: Array<{ x: number; y: number }>;
}

// Interface étendue pour les données en cours d'édition avec le fichier File
export interface ImageInteractiveDataWithFile extends ImageInteractiveData {
  imageFile?: File; // Fichier à uploader lors de la sauvegarde
  oldImageUrl?: string; // URL de l'ancienne image à supprimer si on remplace l'image
}

@Component({
  selector: 'app-image-interactive-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DragDropModule],
  templateUrl: './image-interactive-form.component.html',
  styleUrls: ['./image-interactive-form.component.scss'],
})
export class ImageInteractiveFormComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);

  @Input() initialData: ImageInteractiveData | null = null;
  @Output() dataChange = new EventEmitter<ImageInteractiveDataWithFile>();
  @Output() validityChange = new EventEmitter<boolean>();

  @ViewChild('imageContainer', { static: false }) imageContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('imageElement', { static: false }) imageElement!: ElementRef<HTMLImageElement>;
  @ViewChild('zonesOverlay', { static: false }) zonesOverlay!: ElementRef<HTMLDivElement>;

  form: FormGroup;
  private isInitializing = false;

  // État de l'image
  readonly imageUrl = signal<string | null>(null); // URL blob ou URL existante
  readonly imageWidth = signal<number>(0);
  readonly imageHeight = signal<number>(0);
  readonly displayedImageWidth = signal<number>(0);
  readonly displayedImageHeight = signal<number>(0);
  readonly imageOffsetX = signal<number>(0);
  readonly imageOffsetY = signal<number>(0);
  
  // Fichier sélectionné (pour upload ultérieur)
  private imageFile = signal<File | null>(null);
  private oldImageUrl = signal<string | null>(null); // URL de l'ancienne image si on remplace

  // Zones
  readonly zones = signal<ZoneInEdit[]>([]);
  readonly selectedZoneId = signal<string | null>(null);
  readonly isDrawing = signal<boolean>(false);
  readonly drawingStart = signal<{ x: number; y: number } | null>(null);
  readonly drawingCurrent = signal<{ x: number; y: number } | null>(null);
  
  // Polygone en cours de création
  readonly polygonPoints = signal<Array<{ x: number; y: number }>>([]);
  readonly isCreatingPolygon = signal<boolean>(false);

  // Déplacement et redimensionnement
  readonly isMoving = signal<boolean>(false);
  readonly moveStart = signal<{ x: number; y: number; zoneStartX: number; zoneStartY: number } | null>(null);
  readonly isResizing = signal<boolean>(false);
  readonly resizeHandle = signal<'nw' | 'ne' | 'sw' | 'se' | null>(null);
  readonly resizeStart = signal<{ x: number; y: number; zoneX: number; zoneY: number; zoneWidth: number; zoneHeight: number } | null>(null);
  
  // Déplacement d'un point de polygone
  readonly isDraggingPoint = signal<boolean>(false);
  readonly draggingPoint = signal<{ zoneId: string; pointIndex: number; startX: number; startY: number; startRelativeX: number; startRelativeY: number } | null>(null);
  
  // Cache des positions absolues pendant le drag (pour mise à jour immédiate)
  readonly draggingPointAbsolutePosition = signal<{ x: number; y: number } | null>(null);

  // Configuration de validation
  readonly requireAllCorrectZones = signal<boolean>(true); // Par défaut, toutes les zones correctes sont requises

  // Mode édition
  readonly editMode = signal<'none' | 'draw' | 'select'>('draw');
  
  // Computed pour mémoriser les points absolus de chaque zone (évite les recalculs excessifs)
  // Utilise un identifiant unique pour chaque point pour un tracking stable
  readonly absolutePolygonPointsCache = computed(() => {
    const zones = this.zones();
    const displayedWidth = this.displayedImageWidth();
    const displayedHeight = this.displayedImageHeight();
    const offsetX = this.imageOffsetX();
    const offsetY = this.imageOffsetY();
    
    // #region agent log
    if (this.isDraggingPoint()) {
      fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'image-interactive-form.component.ts:90',message:'absolutePolygonPointsCache recalculating during drag',data:{zonesCount:zones.length,displayedWidth,displayedHeight,offsetX,offsetY},timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'I'})}).catch(()=>{});
    }
    // #endregion
    
    // Retourner un objet simple avec des points qui incluent un ID unique
    const cache: Record<string, Array<{ id: string; x: number; y: number }>> = {};
    
    for (const zone of zones) {
      if (zone.points && zone.points.length > 0) {
        const points = zone.points.map((point, index) => ({
          id: `${zone.id}-point-${index}`, // ID unique pour chaque point
          x: point.x * displayedWidth + offsetX,
          y: point.y * displayedHeight + offsetY,
        }));
        cache[zone.id] = points;
        
        // #region agent log
        if (this.isDraggingPoint() && this.draggingPoint()?.zoneId === zone.id) {
          const dragInfo = this.draggingPoint()!;
          fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'image-interactive-form.component.ts:107',message:'absolutePolygonPointsCache point calculated',data:{zoneId:zone.id,pointIndex:dragInfo.pointIndex,calculatedPoint:points[dragInfo.pointIndex],originalPoint:zone.points[dragInfo.pointIndex]},timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'I'})}).catch(()=>{});
        }
        // #endregion
      }
    }
    
    return cache;
  });
  
  constructor() {
    this.form = this.fb.group({
      imageFile: [null],
    });

    // Observer les changements de taille du conteneur
    effect(() => {
      if (this.imageContainer?.nativeElement) {
        this.updateImageDimensions();
      }
    });
    
    // Annuler le polygone en cours si on change de mode
    effect(() => {
      if (this.editMode() !== 'draw' && this.isCreatingPolygon()) {
        this.cancelPolygon();
      }
    });
    
    // Recalculer les dimensions quand on crée un polygone (pour éviter que le menu fasse bouger l'image)
    effect(() => {
      if (this.isCreatingPolygon()) {
        // Attendre que le DOM se mette à jour puis recalculer
        setTimeout(() => {
          this.updateImageDimensions();
        }, 50);
      }
    });
  }

  // ResizeObserver pour détecter les changements de taille
  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    // Charger les données initiales si elles sont déjà présentes
    if (this.initialData) {
      this.loadInitialData();
    }
  }

  ngAfterViewInit(): void {
    // Observer les changements de taille du conteneur
    if (this.imageContainer?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateImageDimensions();
      });
      this.resizeObserver.observe(this.imageContainer.nativeElement);
    }

    // Observer les changements de taille de la fenêtre
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Listener global pour mouseup (pour terminer le drag même si la souris sort du cercle)
    window.addEventListener('mouseup', this.handleGlobalMouseUp.bind(this));
    
    // Listener global pour mousemove (pour capturer le drag même si pointer-events est none)
    window.addEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
    
    // Mettre à jour les dimensions après l'initialisation de la vue
    if (this.initialData) {
      setTimeout(() => {
        this.updateImageDimensions();
      }, 100);
    }
  }
  
  /**
   * Gère le mouseup global (pour terminer le drag même si la souris sort du cercle)
   */
  private handleGlobalMouseUp(event: MouseEvent): void {
    if (this.isDraggingPoint()) {
      this.onMouseUp(event);
    }
  }
  
  /**
   * Gère le mousemove global (pour capturer le drag même si pointer-events est none)
   */
  private handleGlobalMouseMove(event: MouseEvent): void {
    if (this.isDraggingPoint()) {
      this.onCircleMouseMove(event);
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    window.removeEventListener('resize', this.handleResize.bind(this));
    window.removeEventListener('mouseup', this.handleGlobalMouseUp.bind(this));
    window.removeEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
    
    // Libérer l'URL blob si elle existe
    const imageUrl = this.imageUrl();
    if (imageUrl && imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.initialData) {
      this.loadInitialData();
    }
  }

  /**
   * Charge les données initiales dans le formulaire
   */
  private loadInitialData(): void {
    if (!this.initialData) {
      return;
    }
    
    
    this.isInitializing = true;
    
    // Stocker l'URL de l'image existante pour pouvoir la supprimer si on la remplace
    this.oldImageUrl.set(this.initialData.image_url);
    this.imageUrl.set(this.initialData.image_url);
    this.imageWidth.set(this.initialData.image_width);
    this.imageHeight.set(this.initialData.image_height);
    this.imageFile.set(null); // Pas de nouveau fichier
    
    // Charger la configuration de validation (défaut: true pour rétrocompatibilité)
    const requireAll = this.initialData.require_all_correct_zones ?? true;
    this.requireAllCorrectZones.set(requireAll);
    
    // Convertir les zones depuis les coordonnées relatives
    // Supporte les deux formats : rectangle (ancien) et polygone (nouveau)
    const zones: ZoneInEdit[] = this.initialData.zones.map(zone => {
      if (zone.points && zone.points.length > 0) {
        // Format polygone
        return {
          id: zone.id,
          points: zone.points,
          is_correct: zone.is_correct,
          name: zone.name,
        };
      } else {
        // Format rectangle (rétrocompatibilité)
        return {
          id: zone.id,
          x: zone.x,
          y: zone.y,
          width: zone.width,
          height: zone.height,
          is_correct: zone.is_correct,
          name: zone.name,
        };
      }
    });
    this.zones.set(zones);


    setTimeout(() => {
      this.isInitializing = false;
      this.updateImageDimensions();
      this.emitData();
    }, 0);
  }

  /**
   * Met à jour les dimensions affichées de l'image
   */
  updateImageDimensions(): void {
    if (!this.imageElement?.nativeElement || !this.imageContainer?.nativeElement) {
      return;
    }

    const img = this.imageElement.nativeElement;
    const container = this.imageContainer.nativeElement;

    // Attendre que l'image soit chargée
    if (!img.complete || img.naturalWidth === 0) {
      img.onload = () => this.updateImageDimensions();
      return;
    }

    const containerWidth = container.clientWidth;
    const originalWidth = this.imageWidth();
    const originalHeight = this.imageHeight();

    if (originalWidth === 0 || originalHeight === 0) {
      return;
    }

    // Calculer les dimensions affichées en conservant le ratio
    const aspectRatio = originalWidth / originalHeight;
    let displayedWidth = containerWidth;
    let displayedHeight = containerWidth / aspectRatio;

    // Si l'image est plus haute que large, ajuster
    if (displayedHeight > container.clientHeight) {
      displayedHeight = container.clientHeight;
      displayedWidth = displayedHeight * aspectRatio;
    }

    this.displayedImageWidth.set(displayedWidth);
    this.displayedImageHeight.set(displayedHeight);

    // Calculer les offsets pour centrer l'image
    const offsetX = (containerWidth - displayedWidth) / 2;
    const offsetY = (container.clientHeight - displayedHeight) / 2;
    this.imageOffsetX.set(offsetX);
    this.imageOffsetY.set(offsetY);
  }

  private handleResize(): void {
    this.updateImageDimensions();
  }

  /**
   * Gère la sélection d'un fichier image
   * Ne fait pas l'upload immédiatement, crée juste une URL blob pour la prévisualisation
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Valider le type de fichier
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert(`Type de fichier non autorisé. Types acceptés : ${allowedTypes.join(', ')}`);
      input.value = ''; // Réinitialiser l'input
      return;
    }

    // Valider la taille (10MB)
    const maxFileSize = 10 * 1024 * 1024;
    if (file.size > maxFileSize) {
      alert(`Fichier trop volumineux. Taille maximale : ${maxFileSize / 1024 / 1024}MB`);
      input.value = ''; // Réinitialiser l'input
      return;
    }

    // Si on remplace une image existante, garder l'ancienne URL pour la supprimer plus tard
    const currentUrl = this.imageUrl();
    if (currentUrl && !currentUrl.startsWith('blob:')) {
      this.oldImageUrl.set(currentUrl);
    }

    // Créer une URL blob pour la prévisualisation
    const blobUrl = URL.createObjectURL(file);
    
    // Libérer l'ancienne URL blob si elle existe
    const previousUrl = this.imageUrl();
    if (previousUrl && previousUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previousUrl);
    }

    // Charger l'image pour obtenir ses dimensions
    const img = new Image();
    img.onload = () => {
      this.imageUrl.set(blobUrl);
      this.imageWidth.set(img.naturalWidth);
      this.imageHeight.set(img.naturalHeight);
      this.imageFile.set(file); // Stocker le fichier pour l'upload ultérieur
      this.zones.set([]); // Réinitialiser les zones

      setTimeout(() => {
        this.updateImageDimensions();
        this.emitData();
      }, 100);
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      alert('Erreur lors du chargement de l\'image');
      input.value = ''; // Réinitialiser l'input
    };
    img.src = blobUrl;
  }

  /**
   * Gère le début du dessin d'une zone
   */
  onMouseDown(event: MouseEvent): void {
    if (!this.imageUrl()) return;

    // Obtenir les dimensions actuelles de l'image affichée
    const displayedWidth = this.displayedImageWidth();
    const displayedHeight = this.displayedImageHeight();
    const offsetX = this.imageOffsetX();
    const offsetY = this.imageOffsetY();

    if (displayedWidth === 0 || displayedHeight === 0) {
      return;
    }

    // Coordonnées du clic par rapport à la fenêtre
    const clientX = event.clientX;
    const clientY = event.clientY;

    // Obtenir la position du conteneur
    const containerRect = this.imageContainer.nativeElement.getBoundingClientRect();
    
    // Coordonnées par rapport au conteneur
    const containerX = clientX - containerRect.left;
    const containerY = clientY - containerRect.top;
    
    // Coordonnées par rapport à l'image (soustraire les offsets)
    const imageX = containerX - offsetX;
    const imageY = containerY - offsetY;

    // Vérifier que le clic est dans l'image
    if (imageX < 0 || imageY < 0 || imageX > displayedWidth || imageY > displayedHeight) {
      return;
    }

    // Limiter les coordonnées à l'intérieur de l'image
    const clampedX = Math.max(0, Math.min(imageX, displayedWidth));
    const clampedY = Math.max(0, Math.min(imageY, displayedHeight));

    // Mode dessin : création de polygone par clics successifs
    if (this.editMode() === 'draw') {
      // Convertir en coordonnées relatives (0-1) par rapport à l'image affichée
      // Ces coordonnées seront converties en coordonnées relatives par rapport à l'image native lors de la sauvegarde
      const relativeX = clampedX / displayedWidth;
      const relativeY = clampedY / displayedHeight;
      
      // Si on est déjà en train de créer un polygone, ajouter un point
      if (this.isCreatingPolygon()) {
        const newPoint = {
          x: relativeX,
          y: relativeY,
        };
        this.polygonPoints.update(points => [...points, newPoint]);
        return;
      }
      
      // Sinon, commencer un nouveau polygone
      this.isCreatingPolygon.set(true);
      const firstPoint = {
        x: relativeX,
        y: relativeY,
      };
      this.polygonPoints.set([firstPoint]);
      return;
    }

    // Mode sélection : gérer le déplacement
    if (this.editMode() === 'select') {
      const selectedId = this.selectedZoneId();
      if (selectedId) {
        const zone = this.zones().find(z => z.id === selectedId);
        if (zone) {
          // Vérifier si le clic est dans la zone (rectangle ou polygone)
          const isInside = this.isRectangle(zone)
            ? this.isPointInRectangle(clampedX, clampedY, zone)
            : this.isPointInPolygon(clampedX, clampedY, zone);
          
          if (isInside) {
            // Pour les rectangles, démarrer le déplacement
            if (this.isRectangle(zone) && zone.x !== undefined && zone.y !== undefined) {
              this.isMoving.set(true);
              this.moveStart.set({
                x: clampedX,
                y: clampedY,
                zoneStartX: zone.x,
                zoneStartY: zone.y
              });
              event.preventDefault();
              event.stopPropagation();
            }
            // Pour les polygones, le déplacement sera géré différemment (déplacement de tous les points)
          }
        }
      }
    }
  }

  /**
   * Gère le mouvement de la souris pendant le dessin, déplacement ou redimensionnement
   */
  onMouseMove(event: MouseEvent): void {
    // Si on est en train de déplacer un point, laisser onCircleMouseMove gérer
    if (this.isDraggingPoint()) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'image-interactive-form.component.ts:431',message:'onMouseMove delegating to onCircleMouseMove',data:{isDraggingPoint:this.isDraggingPoint()},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      this.onCircleMouseMove(event);
      return;
    }
    
    // Ignorer les événements provenant des cercles (points de contrôle) ou du SVG
    const target = event.target as HTMLElement;
    if (target?.tagName === 'circle' || target?.tagName === 'polygon' || target?.tagName === 'polyline' || target?.tagName === 'svg' || target?.tagName === 'g') {
      // En mode sélection avec une zone sélectionnée, ignorer les événements du SVG
      if (this.editMode() === 'select' && this.selectedZoneId()) {
        return;
      }
    }
    
    const rect = this.imageContainer.nativeElement.getBoundingClientRect();
    const currentX = event.clientX - rect.left - this.imageOffsetX();
    const currentY = event.clientY - rect.top - this.imageOffsetY();

    // Limiter les coordonnées à l'intérieur de l'image
    const clampedX = Math.max(0, Math.min(currentX, this.displayedImageWidth()));
    const clampedY = Math.max(0, Math.min(currentY, this.displayedImageHeight()));

    // Mode dessin
    if (this.isDrawing() && this.drawingStart()) {
      this.drawingCurrent.set({ x: clampedX, y: clampedY });
      return;
    }

    // Mode déplacement (uniquement pour les rectangles)
    if (this.isMoving() && this.moveStart()) {
      const moveStart = this.moveStart()!;
      const selectedId = this.selectedZoneId();
      if (selectedId) {
        const zone = this.zones().find(z => z.id === selectedId);
        // Le déplacement n'est disponible que pour les rectangles
        if (zone && this.isRectangle(zone) && zone.x !== undefined && zone.y !== undefined && zone.width !== undefined && zone.height !== undefined) {
          const deltaX = (clampedX - moveStart.x) / this.displayedImageWidth();
          const deltaY = (clampedY - moveStart.y) / this.displayedImageHeight();
          
          let newX = moveStart.zoneStartX + deltaX;
          let newY = moveStart.zoneStartY + deltaY;

          // Limiter pour que la zone reste dans l'image
          newX = Math.max(0, Math.min(newX, 1 - zone.width));
          newY = Math.max(0, Math.min(newY, 1 - zone.height));

          this.zones.update(zones =>
            zones.map(z =>
              z.id === selectedId ? { ...z, x: newX, y: newY } : z
            )
          );
        }
      }
      return;
    }

    // Mode redimensionnement (uniquement pour les rectangles)
    if (this.isResizing() && this.resizeStart() && this.resizeHandle()) {
      const resizeStart = this.resizeStart()!;
      const handle = this.resizeHandle()!;
      const selectedId = this.selectedZoneId();
      
      if (selectedId) {
        const zone = this.zones().find(z => z.id === selectedId);
        // Le redimensionnement n'est disponible que pour les rectangles
        if (zone && this.isRectangle(zone) && zone.x !== undefined && zone.y !== undefined && zone.width !== undefined && zone.height !== undefined) {
          const deltaX = (clampedX - resizeStart.x) / this.displayedImageWidth();
          const deltaY = (clampedY - resizeStart.y) / this.displayedImageHeight();

          let newX = resizeStart.zoneX;
          let newY = resizeStart.zoneY;
          let newWidth = resizeStart.zoneWidth;
          let newHeight = resizeStart.zoneHeight;

          // Ajuster selon la poignée utilisée
          switch (handle) {
            case 'nw': // Coin nord-ouest
              newX = Math.max(0, resizeStart.zoneX + deltaX);
              newY = Math.max(0, resizeStart.zoneY + deltaY);
              newWidth = Math.max(0.01, resizeStart.zoneWidth - deltaX);
              newHeight = Math.max(0.01, resizeStart.zoneHeight - deltaY);
              break;
            case 'ne': // Coin nord-est
              newY = Math.max(0, resizeStart.zoneY + deltaY);
              newWidth = Math.max(0.01, resizeStart.zoneWidth + deltaX);
              newHeight = Math.max(0.01, resizeStart.zoneHeight - deltaY);
              if (newX + newWidth > 1) newWidth = 1 - newX;
              break;
            case 'sw': // Coin sud-ouest
              newX = Math.max(0, resizeStart.zoneX + deltaX);
              newWidth = Math.max(0.01, resizeStart.zoneWidth - deltaX);
              newHeight = Math.max(0.01, resizeStart.zoneHeight + deltaY);
              if (newY + newHeight > 1) newHeight = 1 - newY;
              break;
            case 'se': // Coin sud-est
              newWidth = Math.max(0.01, resizeStart.zoneWidth + deltaX);
              newHeight = Math.max(0.01, resizeStart.zoneHeight + deltaY);
              if (newX + newWidth > 1) newWidth = 1 - newX;
              if (newY + newHeight > 1) newHeight = 1 - newY;
              break;
          }

          this.zones.update(zones =>
            zones.map(z =>
              z.id === selectedId ? { ...z, x: newX, y: newY, width: newWidth, height: newHeight } : z
            )
          );
        }
      }
      return;
    }
  }

  /**
   * Gère la fin du dessin d'une zone, du déplacement ou du redimensionnement
   */
  onMouseUp(event: MouseEvent): void {
    // Fin du déplacement d'un point
    if (this.isDraggingPoint()) {
      this.isDraggingPoint.set(false);
      this.draggingPoint.set(null);
      this.draggingPointAbsolutePosition.set(null);
      this.emitData();
      return;
    }
    
    // Fin du déplacement
    if (this.isMoving()) {
      this.isMoving.set(false);
      this.moveStart.set(null);
      this.emitData();
      return;
    }

    // Fin du redimensionnement
    if (this.isResizing()) {
      this.isResizing.set(false);
      this.resizeHandle.set(null);
      this.resizeStart.set(null);
      this.emitData();
      return;
    }
  }

  /**
   * Finalise le polygone en cours de création
   */
  finalizePolygon(): void {
    const points = this.polygonPoints();
    
    // Un polygone doit avoir au moins 3 points
    if (points.length < 3) {
      this.cancelPolygon();
      return;
    }

    // Créer une nouvelle zone polygone
    const newZone: ZoneInEdit = {
      id: `zone-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      points: [...points], // Copie du tableau de points
      is_correct: true, // Par défaut, la zone est correcte
      name: `Zone ${this.zones().length + 1}`,
    };

    this.zones.update(zones => [...zones, newZone]);
    this.cancelPolygon();
    this.emitData();
  }

  /**
   * Annule la création du polygone en cours
   */
  cancelPolygon(): void {
    this.isCreatingPolygon.set(false);
    this.polygonPoints.set([]);
  }

  /**
   * Supprime le dernier point du polygone en cours de création
   */
  removeLastPolygonPoint(): void {
    this.polygonPoints.update(points => {
      if (points.length > 0) {
        return points.slice(0, -1);
      }
      return points;
    });
    
    // Si plus de points, annuler la création
    if (this.polygonPoints().length === 0) {
      this.cancelPolygon();
    }
  }

  /**
   * Sélectionne une zone
   */
  selectZone(zoneId: string): void {
    if (this.editMode() === 'select' && !this.isMoving() && !this.isResizing()) {
      this.selectedZoneId.set(zoneId);
    }
  }

  /**
   * Gère le mouvement d'un point avec CDK Drag
   */
  onCdkDragMoved(event: CdkDragMove, zoneId: string, pointIndex: number): void {
    const displayedWidth = this.displayedImageWidth();
    const displayedHeight = this.displayedImageHeight();
    const offsetX = this.imageOffsetX();
    const offsetY = this.imageOffsetY();
    
    // Position actuelle du drag (relative au foreignObject)
    const position = event.source.getFreeDragPosition();
    const foreignObjectX = this.absolutePolygonPointsCache()[zoneId][pointIndex].x - 6;
    const foreignObjectY = this.absolutePolygonPointsCache()[zoneId][pointIndex].y - 6;
    
    // Position absolue = position du foreignObject + position relative du drag
    const absoluteX = foreignObjectX + position.x + 6;
    const absoluteY = foreignObjectY + position.y + 6;
    
    // Coordonnées par rapport à l'image (soustraire les offsets)
    const imageX = absoluteX - offsetX;
    const imageY = absoluteY - offsetY;
    
    // Limiter à l'intérieur de l'image
    const clampedX = Math.max(0, Math.min(imageX, displayedWidth));
    const clampedY = Math.max(0, Math.min(imageY, displayedHeight));
    
    // Convertir en coordonnées relatives (0-1)
    const relativeX = clampedX / displayedWidth;
    const relativeY = clampedY / displayedHeight;
    
    // Mettre à jour le point dans la zone
    const updatedZones = this.zones().map(zone => {
      if (zone.id === zoneId && zone.points) {
        const newPoints = [...zone.points];
        newPoints[pointIndex] = {
          x: relativeX,
          y: relativeY,
        };
        return { ...zone, points: newPoints };
      }
      return zone;
    });
    this.zones.set(updatedZones);
    
    // Réinitialiser la position relative du drag (car le foreignObject se repositionne)
    event.source.setFreeDragPosition({ x: 0, y: 0 });
  }

  /**
   * Gère la fin du drag d'un point avec CDK Drag
   */
  onCdkDragEnded(event: CdkDragEnd, zoneId: string, pointIndex: number): void {
    this.emitData();
  }

  /**
   * Gère le clic sur un cercle (point de contrôle) - méthode legacy, remplacée par CDK Drag
   */
  onCircleMouseDown(event: MouseEvent, zoneId: string, pointIndex: number): void {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'image-interactive-form.component.ts:658',message:'onCircleMouseDown called',data:{zoneId,pointIndex,editMode:this.editMode()},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    event.preventDefault();
    event.stopPropagation();
    
    if (this.editMode() !== 'select') return;
    
    const zone = this.zones().find(z => z.id === zoneId);
    if (!zone || !zone.points || pointIndex >= zone.points.length) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'image-interactive-form.component.ts:665',message:'onCircleMouseDown zone not found',data:{zoneId,pointIndex,hasZone:!!zone,pointsLength:zone?.points?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      return;
    }
    
    const point = zone.points[pointIndex];
    const rect = this.imageContainer.nativeElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Convertir en coordonnées relatives pour le stockage
    const displayedWidth = this.displayedImageWidth();
    const displayedHeight = this.displayedImageHeight();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb2b0d1b-8339-4e45-a9b3-e386906385f8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'image-interactive-form.component.ts:680',message:'onCircleMouseDown starting drag',data:{zoneId,pointIndex,mouseX,mouseY,pointRelativeX:point.x,pointRelativeY:point.y,displayedWidth,displayedHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    
    this.isDraggingPoint.set(true);
    this.draggingPoint.set({
      zoneId,
      pointIndex,
      startX: mouseX,
      startY: mouseY,
      startRelativeX: point.x,
      startRelativeY: point.y,
    });
  }

  /**
   * Gère le mouvement de la souris sur un cercle (point de contrôle)
   */
  onCircleMouseMove(event: MouseEvent): void {
    if (!this.isDraggingPoint() || !this.draggingPoint()) {
      return;
    }
    
    event.stopPropagation();
    event.preventDefault();
    
    const dragInfo = this.draggingPoint()!;
    const rect = this.imageContainer.nativeElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Calculer le déplacement en coordonnées relatives
    const displayedWidth = this.displayedImageWidth();
    const displayedHeight = this.displayedImageHeight();
    const offsetX = this.imageOffsetX();
    const offsetY = this.imageOffsetY();
    
    // Coordonnées par rapport à l'image (soustraire les offsets)
    const imageX = mouseX - offsetX;
    const imageY = mouseY - offsetY;
    
    // Limiter à l'intérieur de l'image
    const clampedX = Math.max(0, Math.min(imageX, displayedWidth));
    const clampedY = Math.max(0, Math.min(imageY, displayedHeight));
    
    // Mettre à jour la position absolue pour l'affichage immédiat
    this.draggingPointAbsolutePosition.set({
      x: clampedX + offsetX,
      y: clampedY + offsetY,
    });
    
    // Convertir en coordonnées relatives (0-1)
    const relativeX = clampedX / displayedWidth;
    const relativeY = clampedY / displayedHeight;
    
    // Mettre à jour le point dans la zone
    const updatedZones = this.zones().map(zone => {
      if (zone.id === dragInfo.zoneId && zone.points) {
        const newPoints = [...zone.points];
        newPoints[dragInfo.pointIndex] = {
          x: relativeX,
          y: relativeY,
        };
        return { ...zone, points: newPoints };
      }
      return zone;
    });
    this.zones.set(updatedZones);
  }

  /**
   * Gère le début du redimensionnement via une poignée
   */
  onResizeHandleMouseDown(event: MouseEvent, handle: 'nw' | 'ne' | 'sw' | 'se'): void {
    event.preventDefault();
    event.stopPropagation();

    const selectedId = this.selectedZoneId();
    if (!selectedId) return;

    const zone = this.zones().find(z => z.id === selectedId);
    if (!zone) return;

    // Le redimensionnement n'est disponible que pour les rectangles
    if (!this.isRectangle(zone) || zone.x === undefined || zone.y === undefined || zone.width === undefined || zone.height === undefined) {
      return;
    }

    const rect = this.imageContainer.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left - this.imageOffsetX();
    const y = event.clientY - rect.top - this.imageOffsetY();

    this.isResizing.set(true);
    this.resizeHandle.set(handle);
    this.resizeStart.set({
      x,
      y,
      zoneX: zone.x,
      zoneY: zone.y,
      zoneWidth: zone.width,
      zoneHeight: zone.height
    });
  }

  /**
   * Gère la sortie de la souris du conteneur
   */
  onMouseLeave(): void {
    // Pour le dessin, on garde juste le preview (pas d'annulation complète)
    if (this.isDrawing()) {
      this.drawingCurrent.set(null);
    }
    // Pour le déplacement et le redimensionnement, on finalise et sauvegarde
    if (this.isMoving()) {
      this.isMoving.set(false);
      this.moveStart.set(null);
      this.emitData();
    }
    if (this.isResizing()) {
      this.isResizing.set(false);
      this.resizeHandle.set(null);
      this.resizeStart.set(null);
      this.emitData();
    }
  }

  /**
   * Supprime une zone
   */
  deleteZone(zoneId: string): void {
    this.zones.update(zones => zones.filter(z => z.id !== zoneId));
    if (this.selectedZoneId() === zoneId) {
      this.selectedZoneId.set(null);
    }
    this.emitData();
  }

  /**
   * Toggle le statut correct/incorrect d'une zone
   */
  toggleZoneCorrect(zoneId: string): void {
    this.zones.update(zones =>
      zones.map(z =>
        z.id === zoneId ? { ...z, is_correct: !z.is_correct } : z
      )
    );
    this.emitData();
  }

  /**
   * Gère le changement de la configuration de validation
   */
  onRequireAllCorrectZonesChange(value: boolean): void {
    this.requireAllCorrectZones.set(value);
    this.emitData(); // Émettre les données mises à jour
  }

  /**
   * Émet les données du formulaire
   */
  private emitData(): void {
    if (this.isInitializing || !this.imageUrl()) return;

    const zones = this.zones();
    if (zones.length === 0) {
      this.validityChange.emit(false);
      return;
    }

    const file = this.imageFile();
    const oldUrl = this.oldImageUrl();
    
    // Si on a un nouveau fichier, on utilise une URL temporaire pour les données
    // L'URL finale sera définie après l'upload
    const imageUrl = file 
      ? this.imageUrl()! // URL blob temporaire
      : (this.imageUrl() || ''); // URL existante ou vide

    const requireAll = this.requireAllCorrectZones();
    
    const data: ImageInteractiveDataWithFile = {
      image_url: imageUrl,
      image_width: this.imageWidth(),
      image_height: this.imageHeight(),
      zones: zones.map(z => {
        if (z.points && z.points.length > 0) {
          // Format polygone
          return {
            id: z.id,
            points: z.points,
            is_correct: z.is_correct,
            name: z.name,
          };
        } else {
          // Format rectangle (rétrocompatibilité)
          return {
            id: z.id,
            x: z.x,
            y: z.y,
            width: z.width,
            height: z.height,
            is_correct: z.is_correct,
            name: z.name,
          };
        }
      }),
      require_all_correct_zones: requireAll,
      // Ajouter le fichier si un nouveau fichier a été sélectionné
      ...(file && { imageFile: file }),
      // Ajouter l'ancienne URL si on remplace une image existante
      ...(oldUrl && file && { oldImageUrl: oldUrl }),
    };

    this.dataChange.emit(data);
    this.validityChange.emit(true);
  }

  /**
   * Convertit les coordonnées relatives en absolues pour l'affichage
   * Retourne null si c'est un polygone (utiliser getAbsolutePolygonPoints à la place)
   */
  getAbsolutePosition(zone: ZoneInEdit): { x: number; y: number; width: number; height: number } | null {
    // Si c'est un polygone, retourner null
    if (zone.points && zone.points.length > 0) {
      return null;
    }
    
    // Format rectangle
    if (zone.x !== undefined && zone.y !== undefined && zone.width !== undefined && zone.height !== undefined) {
      return {
        x: zone.x * this.displayedImageWidth() + this.imageOffsetX(),
        y: zone.y * this.displayedImageHeight() + this.imageOffsetY(),
        width: zone.width * this.displayedImageWidth(),
        height: zone.height * this.displayedImageHeight(),
      };
    }
    
    return null;
  }

  /**
   * Convertit les points relatifs d'un polygone en coordonnées absolues pour l'affichage
   * Utilise le cache computed pour éviter les recalculs excessifs
   */
  getAbsolutePolygonPoints(zone: ZoneInEdit): Array<{ x: number; y: number }> | null {
    if (!zone.points || zone.points.length === 0) {
      return null;
    }
    
    // Utiliser le cache computed qui ne se recalcule que si les dimensions ou les zones changent
    const cache = this.absolutePolygonPointsCache();
    const points = cache[zone.id];
    if (!points) return null;
    
    // Retourner seulement x et y pour la compatibilité avec le code existant
    return points.map(p => ({ x: p.x, y: p.y }));
  }

  /**
   * Obtient les points absolus du polygone en cours de création
   */
  getCurrentPolygonAbsolutePoints(): Array<{ x: number; y: number }> {
    const relativePoints = this.polygonPoints();
    if (relativePoints.length === 0) {
      return [];
    }
    
    const displayedWidth = this.displayedImageWidth();
    const displayedHeight = this.displayedImageHeight();
    const offsetX = this.imageOffsetX();
    const offsetY = this.imageOffsetY();
    
    if (displayedWidth === 0 || displayedHeight === 0) {
      return [];
    }
    
    return relativePoints.map(point => ({
      x: point.x * displayedWidth + offsetX,
      y: point.y * displayedHeight + offsetY,
    }));
  }

  /**
   * Formate les points d'un polygone en chaîne pour l'attribut SVG points
   */
  formatPolygonPoints(points: Array<{ x: number; y: number }> | null): string {
    if (!points || points.length === 0) {
      return '';
    }
    return points.map(p => `${p.x},${p.y}`).join(' ');
  }

  /**
   * Vérifie si une zone est un rectangle ou un polygone
   */
  isRectangle(zone: ZoneInEdit): boolean {
    return !zone.points || zone.points.length === 0;
  }

  /**
   * Calcule la bounding box d'un polygone pour l'affichage et la sélection
   */
  getPolygonBounds(zone: ZoneInEdit): { x: number; y: number; width: number; height: number } | null {
    if (!zone.points || zone.points.length === 0) {
      return null;
    }
    
    const absolutePoints = this.getAbsolutePolygonPoints(zone);
    if (!absolutePoints || absolutePoints.length === 0) {
      return null;
    }
    
    const xs = absolutePoints.map(p => p.x);
    const ys = absolutePoints.map(p => p.y);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Vérifie si une zone est sélectionnée
   */
  isZoneSelected(zoneId: string): boolean {
    return this.selectedZoneId() === zoneId;
  }

  /**
   * Vérifie si un point est dans un rectangle
   */
  private isPointInRectangle(x: number, y: number, zone: ZoneInEdit): boolean {
    if (!zone.x || !zone.y || !zone.width || !zone.height) {
      return false;
    }
    
    const pos = this.getAbsolutePosition(zone);
    if (!pos) return false;
    
    return x >= pos.x && x <= pos.x + pos.width &&
           y >= pos.y && y <= pos.y + pos.height;
  }

  /**
   * Vérifie si un point est dans un polygone (algorithme ray casting)
   */
  private isPointInPolygon(x: number, y: number, zone: ZoneInEdit): boolean {
    if (!zone.points || zone.points.length < 3) {
      return false;
    }
    
    const absolutePoints = this.getAbsolutePolygonPoints(zone);
    if (!absolutePoints || absolutePoints.length < 3) {
      return false;
    }
    
    // Algorithme ray casting
    let inside = false;
    for (let i = 0, j = absolutePoints.length - 1; i < absolutePoints.length; j = i++) {
      const xi = absolutePoints[i].x;
      const yi = absolutePoints[i].y;
      const xj = absolutePoints[j].x;
      const yj = absolutePoints[j].y;
      
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    
    return inside;
  }
}

