import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import type { SimonData } from '@shared/games';

@Component({
  selector: 'app-simon-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './simon-form.component.html',
  styleUrls: ['./simon-form.component.scss'],
})
export class SimonFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() initialData: SimonData | null = null;
  @Output() dataChange = new EventEmitter<SimonData>();
  @Output() validityChange = new EventEmitter<boolean>();

  form: FormGroup;
  private isInitializing = false;

  readonly typeElementsOptions = [
    { value: 'couleurs', label: 'Couleurs (rouge, vert, bleu, jaune)' },
    { value: 'chiffres', label: 'Chiffres (0-9)' },
    { value: 'lettres', label: 'Lettres (A-Z)' },
    { value: 'symboles', label: 'Symboles (+, -, ×, ÷, etc.)' },
    { value: 'personnalise', label: 'Personnalisé (choisir les éléments)' },
  ];

  readonly defaultElements: Record<string, string[]> = {
    couleurs: ['rouge', 'vert', 'bleu', 'jaune'],
    chiffres: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    lettres: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
    symboles: ['+', '-', '×', '÷', '=', '≠', '<', '>', '≤', '≥'],
  };

  constructor() {
    this.form = this.fb.group({
      nombre_elements: [4], // Fixé à 4, pas de validation nécessaire
      type_elements: ['couleurs', [Validators.required]],
      elements: this.fb.array<FormControl<string>>([]),
    });

    // Initialiser avec les éléments par défaut pour couleurs
    this.initializeDefaultElements('couleurs');

    // Écouter les changements de type_elements pour mettre à jour les éléments
    this.form.get('type_elements')?.valueChanges.subscribe((type) => {
      if (!this.isInitializing && type !== 'personnalise') {
        this.initializeDefaultElements(type);
      } else if (!this.isInitializing && type === 'personnalise') {
        // En mode personnalisé, ajuster à 4 éléments
        this.adjustPersonnaliseElements();
      }
    });

    this.form.valueChanges.subscribe(() => {
      // Ignorer les émissions pendant l'initialisation pour éviter les boucles infinies
      if (this.isInitializing) {
        return;
      }
      if (this.form.valid) {
        const typeElements = this.form.get('type_elements')?.value;
        const simonData: SimonData = {
          nombre_elements: 4, // Toujours 4
          type_elements: typeElements,
        };

        // Si personnalisé, inclure les éléments
        if (typeElements === 'personnalise') {
          const elements = this.elementsArray.value
            .filter((el: string) => el && el.trim())
            .map((el: string) => el.trim());
          simonData.elements = elements;
        }

        this.dataChange.emit(simonData);
      }
      this.validityChange.emit(this.form.valid);
    });
  }

  get elementsArray(): FormArray<FormControl<string>> {
    return this.form.get('elements') as FormArray<FormControl<string>>;
  }

  get isPersonnalise(): boolean {
    return this.form.get('type_elements')?.value === 'personnalise';
  }

  getTypeLabel(): string {
    const type = this.form.get('type_elements')?.value;
    const option = this.typeElementsOptions.find(opt => opt.value === type);
    return option ? option.label : type || '';
  }

  initializeDefaultElements(type: string): void {
    const defaultEls = this.defaultElements[type] || [];
    // Toujours 4 éléments
    const elementsToShow = defaultEls.slice(0, 4);

    this.elementsArray.clear();
    elementsToShow.forEach(el => {
      this.elementsArray.push(new FormControl<string>(el, { nonNullable: true }));
    });
  }

  addElement(): void {
    this.elementsArray.push(new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }));
  }

  removeElement(index: number): void {
    this.elementsArray.removeAt(index);
  }

  adjustPersonnaliseElements(): void {
    // Toujours 4 éléments
    const currentLength = this.elementsArray.length;

    if (currentLength < 4) {
      // Ajouter des éléments manquants
      for (let i = currentLength; i < 4; i++) {
        this.elementsArray.push(new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }));
      }
    } else if (currentLength > 4) {
      // Supprimer les éléments en trop (depuis la fin)
      for (let i = currentLength - 1; i >= 4; i--) {
        this.elementsArray.removeAt(i);
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData']) {
      this.isInitializing = true;

      if (this.initialData) {
        const typeElements = this.initialData.type_elements || 'couleurs';

        this.form.patchValue({
          nombre_elements: 4, // Toujours 4
          type_elements: typeElements,
        }, { emitEvent: false });

        // Charger les éléments
        if (typeElements === 'personnalise') {
          // Mode personnalisé : charger les éléments personnalisés ou ajuster selon nombre_elements
          this.elementsArray.clear();
          if (this.initialData.elements && this.initialData.elements.length > 0) {
            // Charger les éléments existants
            this.initialData.elements.forEach((el: string) => {
              this.elementsArray.push(new FormControl<string>(el, { nonNullable: true, validators: [Validators.required] }));
            });
            // Ajuster à 4 éléments si nécessaire (après le setTimeout pour éviter les conflits)
            setTimeout(() => {
              if (!this.isInitializing) {
                this.adjustPersonnaliseElements();
              }
            }, 0);
          } else {
            // Pas d'éléments existants, créer 4 éléments
            setTimeout(() => {
              if (!this.isInitializing) {
                this.adjustPersonnaliseElements();
              }
            }, 0);
          }
        } else {
          // Mode prédéfini : initialiser avec les éléments par défaut
          this.initializeDefaultElements(typeElements);
        }
      } else {
        // Réinitialiser avec les valeurs par défaut
        this.form.patchValue({
          nombre_elements: 4, // Toujours 4
          type_elements: 'couleurs',
        }, { emitEvent: false });
        this.initializeDefaultElements('couleurs');
      }

      setTimeout(() => {
        this.isInitializing = false;
        // Émettre les données après l'initialisation
        if (this.form.valid) {
          const typeElements = this.form.get('type_elements')?.value;
          const simonData: SimonData = {
            nombre_elements: this.form.get('nombre_elements')?.value,
            type_elements: typeElements,
          };

          if (typeElements === 'personnalise') {
            const elements = this.elementsArray.value
              .filter((el: string) => el && el.trim())
              .map((el: string) => el.trim());
            simonData.elements = elements;
          }

          this.dataChange.emit(simonData);
          this.validityChange.emit(this.form.valid);
        }
      }, 0);
    }
  }
}
