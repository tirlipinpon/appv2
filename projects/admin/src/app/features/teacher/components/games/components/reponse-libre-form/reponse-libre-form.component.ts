import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import type { ReponseLibreData } from '@shared/games';

@Component({
  selector: 'app-reponse-libre-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reponse-libre-form.component.html',
  styleUrls: ['./reponse-libre-form.component.scss'],
})
export class ReponseLibreFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() initialData: ReponseLibreData | null = null;
  @Output() dataChange = new EventEmitter<ReponseLibreData>();
  @Output() validityChange = new EventEmitter<boolean>();

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      reponse_valide: ['', Validators.required],
    });

    this.form.valueChanges.subscribe(() => {
      if (this.form.valid) {
        this.dataChange.emit(this.form.value as ReponseLibreData);
      }
      this.validityChange.emit(this.form.valid);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData']) {
      if (this.initialData) {
        // Charger les données existantes (mode édition)
        this.form.patchValue(this.initialData);
      } else {
        // Réinitialiser le formulaire (mode création)
        this.form.patchValue({ reponse_valide: '' });
        this.validityChange.emit(false);
      }
    }
  }
}

