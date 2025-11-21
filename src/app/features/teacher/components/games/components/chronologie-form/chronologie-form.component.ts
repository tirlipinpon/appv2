import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import type { ChronologieData } from '../../../../types/game-data';

@Component({
  selector: 'app-chronologie-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chronologie-form.component.html',
  styleUrls: ['./chronologie-form.component.scss'],
})
export class ChronologieFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() initialData: ChronologieData | null = null;
  @Output() dataChange = new EventEmitter<ChronologieData>();
  @Output() validityChange = new EventEmitter<boolean>();

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      mots: this.fb.array<FormControl<string>>([]),
      ordre_correct: this.fb.array<FormControl<string>>([]),
    });

    this.form.valueChanges.subscribe(() => {
      const mots = this.motsArray.value.filter((m: string) => m && m.trim());
      const ordreCorrect = this.ordreCorrectArray.value
        .filter((m: string | null) => m && m.trim()) as string[];

      // Valider que tous les mots sont dans l'ordre correct
      const isValid = mots.length > 0 && 
                      ordreCorrect.length === mots.length &&
                      mots.every(mot => ordreCorrect.includes(mot));

      if (isValid) {
        const chronologieData: ChronologieData = {
          mots: mots,
          ordre_correct: ordreCorrect, // Stocker les strings dans l'ordre correct
        };
        this.dataChange.emit(chronologieData);
      }
      this.validityChange.emit(isValid);
    });
  }

  get motsArray(): FormArray<FormControl<string>> {
    return this.form.get('mots') as FormArray<FormControl<string>>;
  }

  get ordreCorrectArray(): FormArray<FormControl<string>> {
    return this.form.get('ordre_correct') as FormArray<FormControl<string>>;
  }

  addMot(): void {
    const newMot = '';
    this.motsArray.push(new FormControl<string>(newMot, { nonNullable: true }));
    // Ajouter automatiquement le mot à l'ordre correct (même position)
    this.ordreCorrectArray.push(new FormControl<string>(newMot, { nonNullable: true }));
  }

  removeMot(index: number): void {
    const motASupprimer = this.motsArray.at(index).value;
    this.motsArray.removeAt(index);
    
    // Supprimer le mot de l'ordre correct
    const ordreIndex = this.ordreCorrectArray.value.findIndex((m: string) => m === motASupprimer);
    if (ordreIndex !== -1) {
      this.ordreCorrectArray.removeAt(ordreIndex);
    }
    
    // Réajuster : si un mot a été supprimé, mettre à jour les références dans ordre_correct
    // Mais comme on utilise maintenant des strings, pas besoin de réajuster les index
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.initialData) {
      this.motsArray.clear();
      this.ordreCorrectArray.clear();

      // Charger les mots
      this.initialData.mots.forEach((mot) => {
        this.motsArray.push(new FormControl<string>(mot, { nonNullable: true }));
      });

      // Charger l'ordre correct (peut être des strings ou des numbers pour rétrocompatibilité)
      const ordreCorrect = this.initialData.ordre_correct;
      if (ordreCorrect && ordreCorrect.length > 0) {
        // Si ce sont des numbers (ancien format), convertir en strings
        if (typeof ordreCorrect[0] === 'number') {
          const ordreAsNumbers = ordreCorrect as unknown as number[];
          ordreAsNumbers.forEach((index) => {
            const mot = this.initialData!.mots[index];
            if (mot) {
              this.ordreCorrectArray.push(new FormControl<string>(mot, { nonNullable: true }));
            }
          });
        } else {
          // Nouveau format : strings directement
          ordreCorrect.forEach((mot) => {
            this.ordreCorrectArray.push(new FormControl<string>(mot, { nonNullable: true }));
          });
        }
      } else {
        // Si pas d'ordre défini, utiliser l'ordre par défaut (ordre d'ajout)
        this.initialData.mots.forEach((mot) => {
          this.ordreCorrectArray.push(new FormControl<string>(mot, { nonNullable: true }));
        });
      }
    }
  }
}

