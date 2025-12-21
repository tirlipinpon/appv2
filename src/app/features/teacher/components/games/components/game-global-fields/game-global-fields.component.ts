import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl } from '@angular/forms';

export interface GameGlobalFieldsData {
  instructions: string | null;
  question: string | null;
  aides: string[] | null;
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

  constructor() {
    this.form = this.fb.group({
      instructions: [''], // Toujours activé par défaut
      question: [''],
      aides: this.fb.array<FormControl<string>>([]),
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

      const data: GameGlobalFieldsData = {
        instructions: instructions || null,
        question: question || null,
        aides: aides.length > 0 ? aides : null,
      };

      this.dataChange.emit(data);
      this.validityChange.emit(true); // Toujours valide (champs optionnels)
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
      }, { emitEvent: false });

      // Charger les aides
      this.aidesArray.clear();
      if (this.initialData.aides && this.initialData.aides.length > 0) {
        this.initialData.aides.forEach(aide => {
          this.aidesArray.push(new FormControl<string>(aide, { nonNullable: true }));
        });
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
}

