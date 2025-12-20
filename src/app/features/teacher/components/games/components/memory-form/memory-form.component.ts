import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import type { MemoryData } from '../../../../types/game-data';

@Component({
  selector: 'app-memory-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './memory-form.component.html',
  styleUrls: ['./memory-form.component.scss'],
})
export class MemoryFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() initialData: MemoryData | null = null;
  @Output() dataChange = new EventEmitter<MemoryData>();
  @Output() validityChange = new EventEmitter<boolean>();

  form: FormGroup;
  private isInitializing = false;

  constructor() {
    this.form = this.fb.group({
      paires: this.fb.array<FormGroup>([]),
    });

    this.form.valueChanges.subscribe(() => {
      // Ignorer les émissions pendant l'initialisation pour éviter les boucles infinies
      if (this.isInitializing) {
        return;
      }
      
      const isValid = this.form.valid && this.pairesArray.length >= 4 && this.pairesArray.length <= 20;
      
      if (isValid) {
        const paires = this.pairesArray.value
          .filter((p: { question: string; reponse: string }) => p.question && p.reponse && p.question.trim() && p.reponse.trim())
          .map((p: { question: string; reponse: string }) => ({
            question: p.question.trim(),
            reponse: p.reponse.trim(),
          }));
        
        const memoryData: MemoryData = {
          paires: paires,
        };
        this.dataChange.emit(memoryData);
      }
      this.validityChange.emit(isValid);
    });
  }

  get pairesArray(): FormArray<FormGroup> {
    return this.form.get('paires') as FormArray<FormGroup>;
  }

  addPaire(): void {
    const paireGroup = this.fb.group({
      question: ['', [Validators.required, Validators.minLength(1)]],
      reponse: ['', [Validators.required, Validators.minLength(1)]],
    });
    this.pairesArray.push(paireGroup);
  }

  removePaire(index: number): void {
    this.pairesArray.removeAt(index);
  }

  ngOnInit(): void {
    // Initialiser avec une paire vide si aucune donnée initiale
    // Cette méthode est appelée avant ngOnChanges pour la première fois
    if (!this.initialData && this.pairesArray.length === 0) {
      this.isInitializing = true;
      this.addPaire();
      setTimeout(() => {
        this.isInitializing = false;
      }, 0);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData']) {
      // Activer le flag pour ignorer les émissions pendant l'initialisation
      this.isInitializing = true;
      this.pairesArray.clear();

      if (this.initialData && this.initialData.paires && this.initialData.paires.length > 0) {
        this.initialData.paires.forEach((paire) => {
          const paireGroup = this.fb.group({
            question: [paire.question, [Validators.required, Validators.minLength(1)]],
            reponse: [paire.reponse, [Validators.required, Validators.minLength(1)]],
          });
          this.pairesArray.push(paireGroup);
        });
      } else if (!changes['initialData'].previousValue && this.pairesArray.length === 0) {
        // Si c'est la première fois et qu'il n'y a pas de données, ajouter une paire vide
        this.addPaire();
      }
      
      // Désactiver le flag après le chargement initial
      setTimeout(() => {
        this.isInitializing = false;
      }, 0);
    }
  }
}

