import { Component, input, output, signal, computed, WritableSignal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { getEmbedUrl } from '../../utils/video-url.util';

@Component({
  selector: 'app-aide-media-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aide-media-modal.component.html',
  styleUrl: './aide-media-modal.component.scss',
})
export class AideMediaModalComponent {
  private readonly sanitizer = inject(DomSanitizer);
  
  aideImageUrl = input<string | null>(null);
  aideVideoUrl = input<string | null>(null);
  isOpen = input.required<WritableSignal<boolean>>();
  close = output<void>();

  // Computed pour déterminer le type de média à afficher
  readonly hasImage = computed(() => !!this.aideImageUrl());
  readonly hasVideo = computed(() => !!this.aideVideoUrl());
  
  // URLs sanitizées pour la sécurité Angular
  readonly safeImageUrl = computed(() => {
    const url = this.aideImageUrl();
    if (url) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
    return null;
  });
  
  readonly videoEmbedUrl = computed(() => {
    const videoUrl = this.aideVideoUrl();
    if (videoUrl) {
      const embedUrl = getEmbedUrl(videoUrl);
      if (embedUrl) {
        return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      }
    }
    return null;
  });

  /**
   * Ferme le modal
   */
  closeModal(): void {
    this.isOpen().set(false);
    this.close.emit();
  }

  /**
   * Gère le clic sur l'overlay (ferme le modal)
   */
  onOverlayClick(event: MouseEvent): void {
    // Fermer seulement si le clic est directement sur l'overlay, pas sur le contenu
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  /**
   * Gère la touche Escape pour fermer le modal
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeModal();
    }
  }
}
