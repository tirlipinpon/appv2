import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import type { VraiFauxData } from '../../../../types/game-data';

@Component({
  selector: 'app-vrai-faux-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vrai-faux-form.component.html',
  styleUrls: ['./vrai-faux-form.component.scss'],
})
export class VraiFauxFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() initialData: VraiFauxData | null = null;
  @Output() dataChange = new EventEmitter<VraiFauxData>();
  @Output() validityChange = new EventEmitter<boolean>();

  form: FormGroup;
  private isInitializing = false;

  constructor() {
    this.form = this.fb.group({
      enonces: this.fb.array<FormGroup>([]),
    });

    this.form.valueChanges.subscribe(() => {
      // Ignorer les émissions pendant l'initialisation pour éviter les boucles infinies
      if (this.isInitializing) {
        return;
      }
      const enonces = this.enoncesArray.value
        .filter((e: { texte: string; reponse_correcte: boolean }) => e.texte && e.texte.trim())
        .map((e: { texte: string; reponse_correcte: boolean }) => ({
          texte: e.texte.trim(),
          reponse_correcte: e.reponse_correcte,
        }));
      
      const isValid = enonces.length > 0;

      if (isValid) {
        const vraiFauxData: VraiFauxData = {
          enonces: enonces,
        };
        this.dataChange.emit(vraiFauxData);
      }
      this.validityChange.emit(isValid);
    });
  }

  ngOnInit(): void {
    // Ajouter un énoncé par défaut si aucune donnée initiale n'est fournie
    if (!this.initialData && this.enoncesArray.length === 0) {
      this.addEnonce();
    }
  }

  get enoncesArray(): FormArray<FormGroup> {
    return this.form.get('enonces') as FormArray<FormGroup>;
  }

  addEnonce(): void {
    const enonceGroup = this.fb.group({
      texte: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
      reponse_correcte: new FormControl<boolean>(true, { nonNullable: true }),
    });
    this.enoncesArray.push(enonceGroup);
  }

  removeEnonce(index: number): void {
    this.enoncesArray.removeAt(index);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData']) {
      // Activer le flag pour ignorer les émissions pendant l'initialisation
      this.isInitializing = true;
      this.enoncesArray.clear();

      if (this.initialData && this.initialData.enonces.length > 0) {
        // Charger les données initiales
        this.initialData.enonces.forEach(enonce => {
          const enonceGroup = this.fb.group({
            texte: new FormControl<string>(enonce.texte, { nonNullable: true, validators: [Validators.required] }),
            reponse_correcte: new FormControl<boolean>(enonce.reponse_correcte, { nonNullable: true }),
          });
          this.enoncesArray.push(enonceGroup);
        });
      } else {
        // Ajouter un énoncé par défaut si aucune donnée
        this.addEnonce();
      }
      
      // Désactiver le flag après le chargement initial
      setTimeout(() => {
        this.isInitializing = false;
      }, 0);
    }
  }
}

