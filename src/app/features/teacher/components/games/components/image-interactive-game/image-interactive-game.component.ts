import { Component, Input, Output, EventEmitter, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ImageInteractiveData, ImageInteractiveZone } from '../../../../types/game-data';

@Component({
  selector: 'app-image-interactive-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-interactive-game.component.html',
  styleUrl: './image-interactive-game.component.scss',
})
export class ImageInteractiveGameComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) imageData!: ImageInteractiveData;
  @Input() showResult = false; // Pour afficher les résultats après validation
  @Input() disabled = false; // Pour désactiver l'interaction

  @Output() answerSelected = new EventEmitter<string[]>();
  @Output() validated = new EventEmitter<boolean>();

  @ViewChild('imageContainer', { static: false }) imageContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('imageElement', { static: false }) imageElement!: ElementRef<HTMLImageElement>;

  // État de l'image
  readonly displayedImageWidth = signal<number>(0);
  readonly displayedImageHeight = signal<number>(0);
  readonly imageOffsetX = signal<number>(0);
  readonly imageOffsetY = signal<number>(0);

  // Zones cliquées
  readonly clickedZoneIds = signal<Set<string>>(new Set());

  // État de validation
  readonly isSubmitted = signal<boolean>(false);
  readonly isCorrect = signal<boolean | null>(null);

  // ResizeObserver pour détecter les changements de taille
  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    // Initialiser les zones cliquées
    this.clickedZoneIds.set(new Set());
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

    // Mettre à jour les dimensions après le chargement de l'image
    setTimeout(() => this.updateImageDimensions(), 100);
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    window.removeEventListener('resize', this.handleResize.bind(this));
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
    const originalWidth = this.imageData.image_width;
    const originalHeight = this.imageData.image_height;

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
   * Gère le clic sur l'image
   */
  onImageClick(event: MouseEvent): void {
    if (this.disabled || this.isSubmitted()) return;

    const rect = this.imageContainer.nativeElement.getBoundingClientRect();
    const clickX = event.clientX - rect.left - this.imageOffsetX();
    const clickY = event.clientY - rect.top - this.imageOffsetY();

    // Vérifier que le clic est dans l'image
    if (clickX < 0 || clickY < 0 || clickX > this.displayedImageWidth() || clickY > this.displayedImageHeight()) {
      return;
    }

    // Convertir en coordonnées relatives
    const relativeX = clickX / this.displayedImageWidth();
    const relativeY = clickY / this.displayedImageHeight();

    // Trouver la zone cliquée
    const clickedZone = this.imageData.zones.find(zone => {
      return (
        relativeX >= zone.x &&
        relativeX <= zone.x + zone.width &&
        relativeY >= zone.y &&
        relativeY <= zone.y + zone.height
      );
    });

    if (clickedZone) {
      const clicked = new Set(this.clickedZoneIds());
      if (clicked.has(clickedZone.id)) {
        clicked.delete(clickedZone.id);
      } else {
        clicked.add(clickedZone.id);
      }
      this.clickedZoneIds.set(clicked);

      // Émettre les zones cliquées
      const clickedZones = Array.from(clicked);
      this.answerSelected.emit(clickedZones);
    }
  }

  /**
   * Valide la réponse
   */
  validate(): void {
    if (this.isSubmitted()) return;

    const clicked = this.clickedZoneIds();
    const correctZones = this.imageData.zones.filter(z => z.is_correct);
    const requireAll = this.imageData.require_all_correct_zones ?? true; // Par défaut: true (rétrocompatibilité)

    // Vérifier qu'aucune zone incorrecte n'a été cliquée
    const incorrectZones = this.imageData.zones.filter(z => !z.is_correct);
    const noIncorrectClicked = incorrectZones.every(zone => !clicked.has(zone.id));

    let isValid = false;

    if (requireAll) {
      // Mode "toutes les zones correctes sont obligatoires"
      // Vérifier que toutes les zones correctes ont été cliquées
      const allCorrectClicked = correctZones.every(zone => clicked.has(zone.id));
      // Vérifier qu'exactement toutes les zones correctes (et seulement elles) ont été cliquées
      isValid = allCorrectClicked && noIncorrectClicked && clicked.size === correctZones.length;
    } else {
      // Mode "une seule zone correcte suffit"
      // Vérifier qu'au moins une zone correcte a été cliquée
      const atLeastOneCorrectClicked = correctZones.some(zone => clicked.has(zone.id));
      // Vérifier qu'aucune zone incorrecte n'a été cliquée
      isValid = atLeastOneCorrectClicked && noIncorrectClicked;
    }

    this.isSubmitted.set(true);
    this.isCorrect.set(isValid);
    this.validated.emit(isValid);
  }

  /**
   * Réinitialise le jeu
   */
  reset(): void {
    this.clickedZoneIds.set(new Set());
    this.isSubmitted.set(false);
    this.isCorrect.set(null);
  }

  /**
   * Convertit les coordonnées relatives en absolues pour l'affichage
   */
  getAbsolutePosition(zone: ImageInteractiveZone): { x: number; y: number; width: number; height: number } {
    return {
      x: zone.x * this.displayedImageWidth() + this.imageOffsetX(),
      y: zone.y * this.displayedImageHeight() + this.imageOffsetY(),
      width: zone.width * this.displayedImageWidth(),
      height: zone.height * this.displayedImageHeight(),
    };
  }

  /**
   * Vérifie si une zone a été cliquée
   */
  isZoneClicked(zoneId: string): boolean {
    return this.clickedZoneIds().has(zoneId);
  }

  /**
   * Vérifie si une zone est correcte
   */
  isZoneCorrect(zoneId: string): boolean {
    const zone = this.imageData.zones.find(z => z.id === zoneId);
    return zone?.is_correct || false;
  }

  /**
   * Vérifie si on peut valider (au moins une zone cliquée)
   */
  canValidate(): boolean {
    return !this.isSubmitted() && this.clickedZoneIds().size > 0;
  }

  /**
   * Retourne le message de résultat
   */
  readonly resultMessage = computed(() => {
    if (!this.isSubmitted() || !this.showResult) return null;
    
    if (this.isCorrect()) {
      return 'Bravo ! Vous avez trouvé toutes les bonnes zones !';
    } else {
      return 'Ce n\'est pas correct. Essayez encore !';
    }
  });

  /**
   * Retourne le nombre de zones correctes
   */
  getCorrectZonesCount(): number {
    return this.imageData.zones.filter((z: ImageInteractiveZone) => z.is_correct).length;
  }
}

