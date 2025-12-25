import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit, inject, signal, computed, effect, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import type { ImageInteractiveData, ImageInteractiveZone } from '../../../../types/game-data';

interface ZoneInEdit {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_correct: boolean;
  name?: string;
}

// Interface étendue pour les données en cours d'édition avec le fichier File
export interface ImageInteractiveDataWithFile extends ImageInteractiveData {
  imageFile?: File; // Fichier à uploader lors de la sauvegarde
  oldImageUrl?: string; // URL de l'ancienne image à supprimer si on remplace l'image
}

@Component({
  selector: 'app-image-interactive-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  // Configuration de validation
  readonly requireAllCorrectZones = signal<boolean>(true); // Par défaut, toutes les zones correctes sont requises

  // Mode édition
  readonly editMode = signal<'none' | 'draw' | 'select'>('draw');

  // ResizeObserver pour détecter les changements de taille
  private resizeObserver?: ResizeObserver;

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
  }

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
    
    // Mettre à jour les dimensions après l'initialisation de la vue
    if (this.initialData) {
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
      console.log('[ImageInteractiveForm] Pas de données initiales');
      return;
    }
    
    console.log('[ImageInteractiveForm] Chargement des données initiales:', this.initialData);
    
    this.isInitializing = true;
    
    // Stocker l'URL de l'image existante pour pouvoir la supprimer si on la remplace
    this.oldImageUrl.set(this.initialData.image_url);
    this.imageUrl.set(this.initialData.image_url);
    this.imageWidth.set(this.initialData.image_width);
    this.imageHeight.set(this.initialData.image_height);
    this.imageFile.set(null); // Pas de nouveau fichier
    
    // Charger la configuration de validation (défaut: true pour rétrocompatibilité)
    const requireAll = this.initialData.require_all_correct_zones ?? true;
    console.log('[ImageInteractiveForm] Chargement require_all_correct_zones:', requireAll, 'depuis initialData:', this.initialData.require_all_correct_zones);
    this.requireAllCorrectZones.set(requireAll);
    
    // Convertir les zones depuis les coordonnées relatives
    const zones: ZoneInEdit[] = this.initialData.zones.map(zone => ({
      id: zone.id,
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
      is_correct: zone.is_correct,
      name: zone.name,
    }));
    this.zones.set(zones);

    console.log('[ImageInteractiveForm] Zones chargées:', zones.length);

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
    if (this.editMode() !== 'draw' || !this.imageUrl()) return;

    const rect = this.imageContainer.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left - this.imageOffsetX();
    const y = event.clientY - rect.top - this.imageOffsetY();

    // Vérifier que le clic est dans l'image
    if (x < 0 || y < 0 || x > this.displayedImageWidth() || y > this.displayedImageHeight()) {
      return;
    }

    // Limiter les coordonnées à l'intérieur de l'image
    const clampedX = Math.max(0, Math.min(x, this.displayedImageWidth()));
    const clampedY = Math.max(0, Math.min(y, this.displayedImageHeight()));

    this.isDrawing.set(true);
    this.drawingStart.set({ x: clampedX, y: clampedY });
    this.drawingCurrent.set({ x: clampedX, y: clampedY });
  }

  /**
   * Gère le mouvement de la souris pendant le dessin
   */
  onMouseMove(event: MouseEvent): void {
    if (!this.isDrawing() || !this.drawingStart()) {
      // Réinitialiser la position actuelle si on ne dessine pas
      this.drawingCurrent.set(null);
      return;
    }

    const rect = this.imageContainer.nativeElement.getBoundingClientRect();
    const currentX = event.clientX - rect.left - this.imageOffsetX();
    const currentY = event.clientY - rect.top - this.imageOffsetY();

    // Limiter les coordonnées à l'intérieur de l'image
    const clampedX = Math.max(0, Math.min(currentX, this.displayedImageWidth()));
    const clampedY = Math.max(0, Math.min(currentY, this.displayedImageHeight()));

    // Mettre à jour la position actuelle pour le preview
    this.drawingCurrent.set({ x: clampedX, y: clampedY });
  }

  /**
   * Gère la fin du dessin d'une zone
   */
  onMouseUp(event: MouseEvent): void {
    if (!this.isDrawing() || !this.drawingStart()) return;

    const rect = this.imageContainer.nativeElement.getBoundingClientRect();
    const endX = event.clientX - rect.left - this.imageOffsetX();
    const endY = event.clientY - rect.top - this.imageOffsetY();

    // Limiter les coordonnées à l'intérieur de l'image
    const clampedEndX = Math.max(0, Math.min(endX, this.displayedImageWidth()));
    const clampedEndY = Math.max(0, Math.min(endY, this.displayedImageHeight()));

    const start = this.drawingStart()!;
    
    // Calculer les coordonnées du rectangle
    const x = Math.min(start.x, clampedEndX);
    const y = Math.min(start.y, clampedEndY);
    const width = Math.abs(clampedEndX - start.x);
    const height = Math.abs(clampedEndY - start.y);

    // Ignorer les zones trop petites
    if (width < 10 || height < 10) {
      this.isDrawing.set(false);
      this.drawingStart.set(null);
      this.drawingCurrent.set(null);
      return;
    }

    // Convertir en coordonnées relatives
    const relativeX = x / this.displayedImageWidth();
    const relativeY = y / this.displayedImageHeight();
    const relativeWidth = width / this.displayedImageWidth();
    const relativeHeight = height / this.displayedImageHeight();

    // Créer une nouvelle zone
    const newZone: ZoneInEdit = {
      id: `zone-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      x: relativeX,
      y: relativeY,
      width: relativeWidth,
      height: relativeHeight,
      is_correct: true, // Par défaut, la zone est correcte
      name: `Zone ${this.zones().length + 1}`,
    };

    this.zones.update(zones => [...zones, newZone]);
    this.isDrawing.set(false);
    this.drawingStart.set(null);
    this.drawingCurrent.set(null);
    this.emitData();
  }

  /**
   * Gère la sortie de la souris du conteneur pendant le dessin
   */
  onMouseLeave(): void {
    if (this.isDrawing()) {
      // Ne pas annuler le dessin, juste arrêter le preview
      this.drawingCurrent.set(null);
    }
  }

  /**
   * Calcule la position et les dimensions de la zone en cours de dessin pour le preview
   */
  getDrawingPreview(): { x: number; y: number; width: number; height: number } | null {
    const start = this.drawingStart();
    const current = this.drawingCurrent();
    
    if (!start || !current) return null;

    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    return { x, y, width, height };
  }

  /**
   * Sélectionne une zone
   */
  selectZone(zoneId: string): void {
    if (this.editMode() === 'select') {
      this.selectedZoneId.set(zoneId);
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
    console.log('[ImageInteractiveForm] Changement require_all_correct_zones:', value);
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
    console.log('[ImageInteractiveForm] Émission données avec require_all_correct_zones:', requireAll);
    
    const data: ImageInteractiveDataWithFile = {
      image_url: imageUrl,
      image_width: this.imageWidth(),
      image_height: this.imageHeight(),
      zones: zones.map(z => ({
        id: z.id,
        x: z.x,
        y: z.y,
        width: z.width,
        height: z.height,
        is_correct: z.is_correct,
        name: z.name,
      })),
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
   */
  getAbsolutePosition(zone: ZoneInEdit): { x: number; y: number; width: number; height: number } {
    return {
      x: zone.x * this.displayedImageWidth() + this.imageOffsetX(),
      y: zone.y * this.displayedImageHeight() + this.imageOffsetY(),
      width: zone.width * this.displayedImageWidth(),
      height: zone.height * this.displayedImageHeight(),
    };
  }

  /**
   * Vérifie si une zone est sélectionnée
   */
  isZoneSelected(zoneId: string): boolean {
    return this.selectedZoneId() === zoneId;
  }
}

