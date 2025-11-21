import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import type { QcmData } from '../../../../types/game-data';

@Component({
  selector: 'app-qcm-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './qcm-form.component.html',
  styleUrls: ['./qcm-form.component.scss'],
})
export class QcmFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() initialData: QcmData | null = null;
  @Output() dataChange = new EventEmitter<QcmData>();
  @Output() validityChange = new EventEmitter<boolean>();

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      propositions: this.fb.array<FormControl<string>>([]),
      reponses_valides: this.fb.array<FormControl<boolean>>([]),
    });

    this.form.valueChanges.subscribe(() => {
      if (this.form.valid) {
        const propositions = this.propositionsArray.value.filter((p: string) => p && p.trim());
        const reponsesValides = this.propositionsArray.controls
          .map((control, index) => ({ value: control.value, index }))
          .filter(item => item.value && this.reponsesValidesArray.at(item.index)?.value)
          .map(item => item.value);
        
        const qcmData: QcmData = {
          propositions: propositions,
          reponses_valides: reponsesValides,
        };
        this.dataChange.emit(qcmData);
      }
      this.validityChange.emit(this.form.valid);
    });
  }

  get propositionsArray(): FormArray<FormControl<string>> {
    return this.form.get('propositions') as FormArray<FormControl<string>>;
  }

  get reponsesValidesArray(): FormArray<FormControl<boolean>> {
    return this.form.get('reponses_valides') as FormArray<FormControl<boolean>>;
  }

  addProposition(): void {
    this.propositionsArray.push(new FormControl<string>('', { nonNullable: true }));
    this.reponsesValidesArray.push(new FormControl<boolean>(false, { nonNullable: true }));
  }

  removeProposition(index: number): void {
    this.propositionsArray.removeAt(index);
    this.reponsesValidesArray.removeAt(index);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.initialData) {
      this.propositionsArray.clear();
      this.reponsesValidesArray.clear();

      this.initialData.propositions.forEach((proposition, index) => {
        this.propositionsArray.push(new FormControl<string>(proposition, { nonNullable: true }));
        const isValide = this.initialData!.reponses_valides.includes(proposition);
        this.reponsesValidesArray.push(new FormControl<boolean>(isValide, { nonNullable: true }));
      });
    }
  }
}

