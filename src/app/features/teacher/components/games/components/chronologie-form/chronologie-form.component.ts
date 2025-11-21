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
      ordre_correct: this.fb.array<FormControl<number>>([]),
    });

    this.form.valueChanges.subscribe(() => {
      if (this.form.valid) {
        const chronologieData: ChronologieData = {
          mots: this.motsArray.value.filter((m: string) => m && m.trim()),
          ordre_correct: this.ordreCorrectArray.value
            .map((o: number | null) => o ?? 0)
            .filter((o: number) => typeof o === 'number' && o >= 0),
        };
        this.dataChange.emit(chronologieData);
      }
      this.validityChange.emit(this.form.valid);
    });
  }

  get motsArray(): FormArray<FormControl<string>> {
    return this.form.get('mots') as FormArray<FormControl<string>>;
  }

  get ordreCorrectArray(): FormArray<FormControl<number>> {
    return this.form.get('ordre_correct') as FormArray<FormControl<number>>;
  }

  addMot(): void {
    const newIndex = this.motsArray.length;
    this.motsArray.push(new FormControl<string>('', { nonNullable: true }));
    // Ajouter automatiquement l'index à l'ordre correct
    this.ordreCorrectArray.push(new FormControl<number>(newIndex, { nonNullable: true }));
  }

  removeMot(index: number): void {
    this.motsArray.removeAt(index);
    this.ordreCorrectArray.removeAt(index);
    // Réajuster les indices dans ordre_correct
    this.ordreCorrectArray.controls.forEach((control, i) => {
      const currentValue = control.value;
      if (currentValue > index) {
        control.patchValue(currentValue - 1);
      } else if (currentValue === index) {
        control.patchValue(i);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.initialData) {
      this.motsArray.clear();
      this.ordreCorrectArray.clear();

      this.initialData.mots.forEach((mot, index) => {
        this.motsArray.push(new FormControl<string>(mot, { nonNullable: true }));
        const ordreIndex = this.initialData!.ordre_correct[index] ?? index;
        this.ordreCorrectArray.push(new FormControl<number>(ordreIndex, { nonNullable: true }));
      });
    }
  }
}

