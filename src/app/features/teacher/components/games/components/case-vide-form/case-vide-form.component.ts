import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import type { CaseVideData } from '../../../../types/game-data';

@Component({
  selector: 'app-case-vide-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './case-vide-form.component.html',
  styleUrls: ['./case-vide-form.component.scss'],
})
export class CaseVideFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() initialData: CaseVideData | null = null;
  @Output() dataChange = new EventEmitter<CaseVideData>();
  @Output() validityChange = new EventEmitter<boolean>();

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      debut_phrase: ['', Validators.required],
      fin_phrase: ['', Validators.required],
      reponse_valide: ['', Validators.required],
    });

    // Émettre les changements de données et de validité
    this.form.valueChanges.subscribe(() => {
      if (this.form.valid) {
        this.dataChange.emit(this.form.value as CaseVideData);
      }
      this.validityChange.emit(this.form.valid);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.initialData) {
      this.form.patchValue(this.initialData);
    }
  }
}

