import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import { isValidVideoUrl } from '@shared/utils/video-url.util';

export interface GameGlobalFieldsData {
  instructions: string | null;
  question: string | null;
  aides: string[] | null;
  aideImageFile?: File | null; // Nouveau fichier à uploader
  aideImageUrl?: string | null; // URL existante
  aideVideoUrl?: string | null;
}

@Component({
  selector: 'app-game-global-fields',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './game-global-fields.component.html',
  styleUrls: ['./game-global-fields.component.scss'],
})
export class GameGlobalFieldsComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() initialData: GameGlobalFieldsData | null = null;
  @Output() dataChange = new EventEmitter<GameGlobalFieldsData>();
  @Output() validityChange = new EventEmitter<boolean>();

  form: FormGroup;
  private isInitializing = false;
  
  // Propriétés pour l'image d'aide
  aideImageFile: File | null = null;
  aideImagePreview: string | null = null;
  aideImageUrl: string | null = null; // URL existante en mode édition

  constructor() {
    this.form = this.fb.group({
      instructions: [''], // Toujours activé par défaut
      question: [''],
      aides: this.fb.array<FormControl<string>>([]),
      aideVideoUrl: ['', [this.videoUrlValidator]],
    });

    // S'assurer que les contrôles sont toujours activés
    this.form.get('instructions')?.enable();
    this.form.get('question')?.enable();

    // Émettre les changements
    this.form.valueChanges.subscribe(() => {
      // Ignorer les émissions pendant l'initialisation pour éviter les boucles infinies
      if (this.isInitializing) {
        return;
      }
      const instructions = this.form.get('instructions')?.value?.trim() || null;
      const question = this.form.get('question')?.value?.trim() || null;
      const aides = this.aidesArray.value
        .map((a: string) => a?.trim())
        .filter((a: string) => a && a.length > 0);

      const aideVideoUrl = this.form.get('aideVideoUrl')?.value?.trim() || null;

      const data: GameGlobalFieldsData = {
        instructions: instructions || null,
        question: question || null,
        aides: aides.length > 0 ? aides : null,
        aideImageFile: this.aideImageFile,
        aideImageUrl: this.aideImageUrl,
        aideVideoUrl: aideVideoUrl || null,
      };

      this.dataChange.emit(data);
      this.validityChange.emit(this.form.valid);
    });
  }

  get aidesArray(): FormArray<FormControl<string>> {
    return this.form.get('aides') as FormArray<FormControl<string>>;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.initialData) {
      // Activer le flag pour ignorer les émissions pendant l'initialisation
      this.isInitializing = true;
      this.form.patchValue({
        instructions: this.initialData.instructions || '',
        question: this.initialData.question || '',
        aideVideoUrl: this.initialData.aideVideoUrl || '',
      }, { emitEvent: false });

      // Charger les aides
      this.aidesArray.clear();
      if (this.initialData.aides && this.initialData.aides.length > 0) {
        this.initialData.aides.forEach(aide => {
          this.aidesArray.push(new FormControl<string>(aide, { nonNullable: true }));
        });
      }

      // Charger l'image existante si présente
      this.aideImageUrl = this.initialData.aideImageUrl || null;
      this.aideImageFile = this.initialData.aideImageFile || null;
      if (this.aideImageUrl) {
        this.aideImagePreview = this.aideImageUrl;
      } else if (this.aideImageFile) {
        this.createImagePreview(this.aideImageFile);
      } else {
        this.aideImagePreview = null;
      }
      
      // Désactiver le flag après le chargement initial
      setTimeout(() => {
        this.isInitializing = false;
      }, 0);
    }
  }

  addAide(): void {
    this.aidesArray.push(new FormControl<string>('', { nonNullable: true }));
  }

  removeAide(index: number): void {
    this.aidesArray.removeAt(index);
  }

  /**
   * Gère la sélection d'un fichier image
   */
  onAideImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Vérifier le type de fichier
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        alert(`Type de fichier non autorisé. Types acceptés : ${allowedTypes.join(', ')}`);
        input.value = '';
        return;
      }

      // Vérifier la taille (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`Fichier trop volumineux. Taille maximale : ${maxSize / 1024 / 1024}MB`);
        input.value = '';
        return;
      }

      this.aideImageFile = file;
      this.createImagePreview(file);
      
      // Réinitialiser l'URL existante si on upload une nouvelle image
      this.aideImageUrl = null;
      
      // Émettre le changement
      this.emitDataChange();
    }
  }

  /**
   * Crée un aperçu de l'image sélectionnée
   */
  private createImagePreview(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.aideImagePreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Supprime l'image sélectionnée
   */
  removeAideImage(): void {
    this.aideImageFile = null;
    this.aideImageUrl = null;
    this.aideImagePreview = null;
    
    // Réinitialiser l'input file
    const fileInput = document.getElementById('aide-image-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    
    // Émettre le changement
    this.emitDataChange();
  }

  /**
   * Valide l'URL vidéo
   */
  validateVideoUrl(url: string): boolean {
    if (!url || url.trim().length === 0) {
      return true; // Vide est valide (champ optionnel)
    }
    return isValidVideoUrl(url);
  }

  /**
   * Validator personnalisé pour l'URL vidéo
   */
  private videoUrlValidator = (control: FormControl<string>): { [key: string]: any } | null => {
    const url = control.value;
    if (!url || url.trim().length === 0) {
      return null; // Vide est valide (champ optionnel)
    }
    return isValidVideoUrl(url) ? null : { invalidVideoUrl: true };
  };

  /**
   * Émet les changements de données
   */
  private emitDataChange(): void {
    if (this.isInitializing) {
      return;
    }

    const instructions = this.form.get('instructions')?.value?.trim() || null;
    const question = this.form.get('question')?.value?.trim() || null;
    const aides = this.aidesArray.value
      .map((a: string) => a?.trim())
      .filter((a: string) => a && a.length > 0);
    const aideVideoUrl = this.form.get('aideVideoUrl')?.value?.trim() || null;

    const data: GameGlobalFieldsData = {
      instructions: instructions || null,
      question: question || null,
      aides: aides.length > 0 ? aides : null,
      aideImageFile: this.aideImageFile,
      aideImageUrl: this.aideImageUrl,
      aideVideoUrl: aideVideoUrl || null,
    };

    this.dataChange.emit(data);
    this.validityChange.emit(this.form.valid);
  }
}

