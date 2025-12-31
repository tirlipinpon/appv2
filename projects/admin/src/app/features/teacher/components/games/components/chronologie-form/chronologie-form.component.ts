import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import type { ChronologieData } from '@shared/games';

@Component({
  selector: 'app-chronologie-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DragDropModule],
  templateUrl: './chronologie-form.component.html',
  styleUrls: ['./chronologie-form.component.scss'],
})
export class ChronologieFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() initialData: ChronologieData | null = null;
  @Output() dataChange = new EventEmitter<ChronologieData>();
  @Output() validityChange = new EventEmitter<boolean>();

  form: FormGroup;
  private isInitializing = false;

  constructor() {
    this.form = this.fb.group({
      mots: this.fb.array<FormControl<string>>([]),
    });

    this.form.valueChanges.subscribe(() => {
      // Ignorer les émissions pendant l'initialisation pour éviter les boucles infinies
      if (this.isInitializing) {
        return;
      }
      const mots = this.motsArray.value.filter((m: string) => m && m.trim());
      
      // L'ordre correct est simplement l'ordre des mots dans le FormArray
      const ordreCorrect = [...mots];
      
      const isValid = mots.length > 0;

      if (isValid) {
        const chronologieData: ChronologieData = {
          mots: mots,
          ordre_correct: ordreCorrect, // L'ordre correct = l'ordre des mots
        };
        this.dataChange.emit(chronologieData);
      }
      this.validityChange.emit(isValid);
    });
  }

  get motsArray(): FormArray<FormControl<string>> {
    return this.form.get('mots') as FormArray<FormControl<string>>;
  }

  addMot(): void {
    const newMot = '';
    this.motsArray.push(new FormControl<string>(newMot, { nonNullable: true }));
  }

  removeMot(index: number): void {
    this.motsArray.removeAt(index);
  }

  /**
   * Gère le drop lors du drag and drop pour réordonner les mots
   */
  drop(event: CdkDragDrop<FormArray>): void {
    if (event.previousIndex === event.currentIndex) {
      return; // Pas de changement
    }
    
    // Réordonner les FormControls dans le FormArray
    moveItemInArray(this.motsArray.controls, event.previousIndex, event.currentIndex);
    
    // Forcer la détection de changement pour que le template se mette à jour
    this.cdr.detectChanges();
    
    // Déclencher valueChanges pour sauvegarder le nouvel ordre
    // On utilise patchValue avec les valeurs actuelles pour forcer l'émission
    const wasInitializing = this.isInitializing;
    this.isInitializing = false; // S'assurer que valueChanges peut s'exécuter
    const values = this.motsArray.controls.map(control => control.value);
    this.motsArray.patchValue(values, { emitEvent: true });
    this.isInitializing = wasInitializing;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.initialData) {
      // Activer le flag pour ignorer les émissions pendant l'initialisation
      this.isInitializing = true;
      this.motsArray.clear();

      // Charger les mots dans l'ordre correct
      // Si ordre_correct existe, utiliser cet ordre, sinon utiliser l'ordre des mots
      const ordreCorrect = this.initialData.ordre_correct;
      if (ordreCorrect && ordreCorrect.length > 0) {
        // Si ce sont des numbers (ancien format), convertir en strings
        if (typeof ordreCorrect[0] === 'number') {
          const ordreAsNumbers = ordreCorrect as unknown as number[];
          ordreAsNumbers.forEach((index) => {
            const mot = this.initialData!.mots[index];
            if (mot) {
              this.motsArray.push(new FormControl<string>(mot, { nonNullable: true }));
            }
          });
        } else {
          // Nouveau format : utiliser l'ordre correct pour charger les mots
          ordreCorrect.forEach((mot) => {
            this.motsArray.push(new FormControl<string>(mot, { nonNullable: true }));
          });
        }
      } else {
        // Si pas d'ordre défini, utiliser l'ordre des mots
        this.initialData.mots.forEach((mot) => {
          this.motsArray.push(new FormControl<string>(mot, { nonNullable: true }));
        });
      }
      
      // Désactiver le flag après le chargement initial
      // Utiliser setTimeout pour s'assurer que tous les valueChanges sont ignorés
      setTimeout(() => {
        this.isInitializing = false;
      }, 0);
    }
  }
}

