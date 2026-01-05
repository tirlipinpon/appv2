import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AideMediaModalComponent } from '../aide-media-modal/aide-media-modal.component';

@Component({
  selector: 'app-aide-section',
  standalone: true,
  imports: [CommonModule, MatTooltipModule, AideMediaModalComponent],
  templateUrl: './aide-section.component.html',
  styleUrl: './aide-section.component.scss',
})
export class AideSectionComponent {
  @Input() aides: string[] | null = null;
  @Input() aideImageUrl: string | null = null;
  @Input() aideVideoUrl: string | null = null;
  @Output() aideToggle = new EventEmitter<boolean>();

  showAides = signal<boolean>(false);
  readonly showMediaModal = signal<boolean>(false);
  readonly mediaTypeToShow = signal<'image' | 'video' | null>(null);

  readonly hasAideMedia = computed(() => !!(this.aideImageUrl || this.aideVideoUrl));
  readonly hasAideText = computed(() => !!(this.aides && this.aides.length > 0));
  readonly shouldShow = computed(() => this.hasAideText() || this.hasAideMedia());
  readonly hasImage = computed(() => !!this.aideImageUrl);
  readonly hasVideo = computed(() => !!this.aideVideoUrl);

  toggleAides(): void {
    this.showAides.update(v => !v);
    this.aideToggle.emit(this.showAides());
  }

  openImageModal(): void {
    this.mediaTypeToShow.set('image');
    this.showMediaModal.set(true);
  }

  openVideoModal(): void {
    this.mediaTypeToShow.set('video');
    this.showMediaModal.set(true);
  }

  closeMediaModal(): void {
    this.showMediaModal.set(false);
    this.mediaTypeToShow.set(null);
  }
}
