import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-avatar-pin-generator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './avatar-pin-generator.component.html',
  styleUrl: './avatar-pin-generator.component.scss'
})
export class AvatarPinGeneratorComponent implements OnInit, OnChanges {
  private readonly sanitizer = inject(DomSanitizer);
  
  @Input() initialAvatarSeed: string | null = null;
  @Input() initialAvatarStyle: 'fun-emoji' | 'bottts' | null = null;
  @Input() initialLoginPin: string | null = null;
  @Input() childId: string | null = null;
  @Output() avatarSeedChange = new EventEmitter<string | null>();
  @Output() avatarStyleChange = new EventEmitter<'fun-emoji' | 'bottts'>();
  @Output() loginPinChange = new EventEmitter<string | null>();
  @Output() validationChange = new EventEmitter<boolean>();

  // Form control pour le PIN
  pinControl = new FormControl('', [
    Validators.required,
    Validators.pattern(/^\d{4}$/),
    Validators.minLength(4),
    Validators.maxLength(4)
  ]);

  // Signal pour le seed de l'avatar
  readonly avatarSeed = signal<string | null>(null);
  
  // Signal pour le style d'avatar choisi
  readonly selectedStyle = signal<'fun-emoji' | 'bottts'>('fun-emoji');
  
  // Signal pour suivre la validité du FormControl
  private readonly pinControlValid = signal<boolean>(false);
  
  // Computed pour l'URL de l'avatar généré (sécurisée avec DomSanitizer)
  readonly avatarUrl = computed<SafeUrl | null>(() => {
    const seed = this.avatarSeed();
    const style = this.selectedStyle();
    
    if (!seed) {
      return null;
    }
    
    // Construire l'URL de l'API DiceBear avec le style choisi
    const baseUrl = `https://api.dicebear.com/9.x/${style}/svg`;
    const params = new URLSearchParams();
    params.set('seed', seed);
    params.set('size', '200');
    
    const apiUrl = `${baseUrl}?${params.toString()}`;
    
    // Sécuriser l'URL avec DomSanitizer pour qu'Angular l'accepte
    return this.sanitizer.bypassSecurityTrustUrl(apiUrl);
  });

  // Computed pour vérifier si le formulaire est valide
  readonly isValid = computed(() => {
    return this.pinControlValid() && this.avatarSeed() !== null;
  });

  ngOnInit(): void {
    // Initialiser avec les valeurs existantes ou générer un nouveau seed
    if (this.initialAvatarSeed) {
      this.avatarSeed.set(this.initialAvatarSeed);
    } else {
      this.generateNewAvatar();
    }

    // Initialiser le style d'avatar
    if (this.initialAvatarStyle) {
      this.selectedStyle.set(this.initialAvatarStyle);
    }
    // Émettre le style initial
    this.avatarStyleChange.emit(this.selectedStyle());

    if (this.initialLoginPin) {
      this.pinControl.setValue(this.initialLoginPin);
    }

    // Mettre à jour le signal de validité initial
    this.updatePinControlValid();

    // Écouter les changements du formulaire
    this.pinControl.valueChanges.subscribe(() => {
      this.onPinChange();
    });

    // Écouter les changements de statut de validation
    this.pinControl.statusChanges.subscribe(() => {
      this.updatePinControlValid();
    });

    // Émettre l'état initial de validation
    this.emitValidationState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialAvatarSeed'] && !changes['initialAvatarSeed'].firstChange) {
      if (this.initialAvatarSeed) {
        this.avatarSeed.set(this.initialAvatarSeed);
      }
      this.emitValidationState();
    }

    if (changes['initialAvatarStyle'] && !changes['initialAvatarStyle'].firstChange) {
      if (this.initialAvatarStyle) {
        this.selectedStyle.set(this.initialAvatarStyle);
      }
    }

    if (changes['initialLoginPin'] && !changes['initialLoginPin'].firstChange) {
      if (this.initialLoginPin) {
        this.pinControl.setValue(this.initialLoginPin);
        this.updatePinControlValid();
      }
      this.emitValidationState();
    }
  }

  /**
   * Génère un nouveau seed pour l'avatar
   */
  generateNewAvatar(): void {
    // Générer un seed unique basé sur timestamp + random
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const newSeed = `${timestamp}-${random}`;
    
    // Si on a un childId, on peut l'inclure pour plus de stabilité
    const seed = this.childId 
      ? `${this.childId}-${timestamp}-${random}`
      : newSeed;
    
    this.avatarSeed.set(seed);
    this.avatarSeedChange.emit(seed);
    this.emitValidationState();
  }

  /**
   * Gère les changements du style d'avatar
   */
  onStyleChange(style: 'fun-emoji' | 'bottts'): void {
    this.selectedStyle.set(style);
    this.avatarStyleChange.emit(style);
  }

  /**
   * Gère les changements du PIN
   */
  onPinChange(): void {
    const pinValue = this.pinControl.value;
    this.updatePinControlValid();
    this.loginPinChange.emit(pinValue || null);
    this.emitValidationState();
  }

  /**
   * Filtre les caractères non numériques lors de la saisie
   */
  onPinInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Remplacer tout ce qui n'est pas un chiffre par une chaîne vide
    const numericValue = input.value.replace(/\D/g, '');
    
    // Limiter à 4 chiffres
    const limitedValue = numericValue.slice(0, 4);
    
    // Mettre à jour la valeur du contrôle
    if (input.value !== limitedValue) {
      this.pinControl.setValue(limitedValue, { emitEvent: false });
      // Mettre à jour la valeur de l'input directement pour éviter le flash
      input.value = limitedValue;
    }
    
    // Émettre les changements
    this.onPinChange();
  }

  /**
   * Empêche la saisie de caractères non numériques
   */
  onPinKeyPress(event: KeyboardEvent): boolean {
    // Autoriser seulement les chiffres (0-9)
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  /**
   * Met à jour le signal de validité du FormControl
   */
  private updatePinControlValid(): void {
    this.pinControlValid.set(this.pinControl.valid);
  }

  /**
   * Émet l'état de validation
   */
  private emitValidationState(): void {
    this.validationChange.emit(this.isValid());
  }

  /**
   * Vérifie si le PIN est invalide et a été touché
   */
  get pinInvalid(): boolean {
    return this.pinControl.invalid && (this.pinControl.touched || this.pinControl.dirty);
  }

  /**
   * Retourne le message d'erreur du PIN
   */
  get pinErrorMessage(): string {
    if (this.pinControl.hasError('required')) {
      return 'Le code PIN est requis';
    }
    if (this.pinControl.hasError('pattern') || this.pinControl.hasError('minlength') || this.pinControl.hasError('maxlength')) {
      return 'Le code PIN doit contenir exactement 4 chiffres';
    }
    return '';
  }
}

