import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges, OnInit } from '@angular/core';
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
export class ReponseLibreFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() initialData: ReponseLibreData | null = null;
  @Output() dataChange = new EventEmitter<ReponseLibreData>();
  @Output() validityChange = new EventEmitter<boolean>();

  form: FormGroup;
  private isInitializing = false;

  constructor() {
    this.form = this.fb.group({
      reponse_valide: ['', Validators.required],
    });

    this.form.valueChanges.subscribe(() => {
      if (this.isInitializing) {
        return;
      }
      if (this.form.valid) {
        this.dataChange.emit(this.form.value as ReponseLibreData);
      }
      this.validityChange.emit(this.form.valid);
    });
  }

  ngOnInit(): void {
    // S'assurer que la validité est émise au démarrage si aucune donnée initiale
    if (!this.initialData) {
      this.isInitializing = true;
      setTimeout(() => {
        this.isInitializing = false;
        this.validityChange.emit(this.form.valid);
      }, 0);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData']) {
      this.isInitializing = true;
      
      if (this.initialData) {
        // Charger les données existantes (mode édition)
        this.form.patchValue(this.initialData);
      } else {
        // Réinitialiser le formulaire (mode création)
        this.form.reset({ reponse_valide: '' });
      }
      
      setTimeout(() => {
        this.isInitializing = false;
        // Émettre la validité après l'initialisation
        this.validityChange.emit(this.form.valid);
      }, 0);
    }
  }
}

